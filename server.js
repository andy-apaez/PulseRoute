const express = require("express");
const path = require("path");

// --- Express app setup ---
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = GEMINI_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`
  : "";
const GEMINI_CONFIG = {
  generationConfig: {
    response_mime_type: "application/json",
    temperature: 0.2,
  },
};
const clarifyCache = new Map();
const CLARIFY_CACHE_MAX = 100;

app.enable("trust proxy");
// Redirect plain HTTP to HTTPS in production.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] === "http") {
    const host = req.headers.host || "";
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Triage routes ---
app.post("/api/triage", async (req, res) => {
  const { name, age, sex, duration, symptoms, vitals = {}, history = "" } = req.body || {};

  if (!symptoms || typeof symptoms !== "string") {
    return res.status(400).json({ error: "symptoms text is required" });
  }

  try {
    const aiResult = await callGemini({
      symptoms,
      age,
      vitals,
      history,
      geminiEnabled: Boolean(GEMINI_KEY),
    });

    const triage = normalizeTriage(aiResult, { name, age, sex, duration, symptoms, vitals, history });
    const forecast = buildForecast(triage.careRoute);

    res.json({ triage, forecast });
  } catch (err) {
    console.error("Triage error", err);
    res.status(500).json({ error: "Unable to triage right now." });
  }
});

app.post("/api/clarify", async (req, res) => {
  const {
    symptoms,
    clarifyingQuestions = [],
    answers = {},
    baseSeverity,
    baseRoute,
    baseWaitRange,
    patient = {},
  } = req.body || {};

  if (!symptoms || typeof symptoms !== "string") {
    return res.status(400).json({ error: "symptoms text is required" });
  }

  try {
    const { triage } = await handleClarifyRequest({
      symptoms,
      clarifyingQuestions,
      answers,
      baseSeverity,
      baseRoute,
      baseWaitRange,
      patient,
      geminiEnabled: Boolean(GEMINI_KEY),
    });

    res.json({ triage });
  } catch (err) {
    console.error("Clarify error", err);
    res.status(500).json({ error: "Unable to process clarifying answers." });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PulseRoute running on http://localhost:${PORT}`);
  });
}

// --- Gemini calls ---
async function callGemini({ symptoms, age, vitals, history, geminiEnabled }) {
  const basePrompt = [
    "You are a hospital triage assistant.",
    "Given messy symptom text and basics, emit JSON only.",
    "Field rules:",
    "- severity_score: integer 1-5 (5 is critical).",
    "- care_route: one of er|urgent_care|telehealth.",
    "- wait_range_minutes: string like \"10-30\".",
    "- extracted_features: key clinical signals from the text.",
    "- rationale: 2-3 short sentences, warm and concise, no extra advice. Plain language clear to patients and staff.",
    "- clarifying_questions: array of 1-3 short questions that would meaningfully tighten the severity score for this presentation.",
    "- Clarifying questions must be specific to the symptom story and ask for missing details (onset, location, severity, red-flag attributes). Avoid generic questions.",
    "Keep JSON lean; do not add extra keys.",
  ].join("\n");

  const prompt = `${basePrompt}

Patient input:
- Age: ${age || "unknown"}
- Vitals: ${JSON.stringify(vitals)}
- History: ${history || "none shared"}
- Symptoms: ${symptoms}

Return JSON with: severity_score, care_route, wait_range_minutes, extracted_features, rationale, clarifying_questions.`;

  if (!geminiEnabled) {
    return fallbackHeuristic({ symptoms, age });
  }

  return sendGeminiRequest({ prompt, errorLabel: "Gemini" });
}

async function callGeminiClarify({
  symptoms,
  clarifyingQuestions,
  answers,
  baseSeverity,
  baseRoute,
  baseWaitRange,
  geminiEnabled,
}) {
  const prompt = [
    "You are a hospital triage assistant tightening a severity score after follow-up questions.",
    "You will be given the original symptom story and 1-3 clarifying questions with yes/no answers.",
    "Update the severity_score (1-5), care_route (er|urgent_care|telehealth), wait_range_minutes, and provide a short rationale.",
    "Use plain language that is easy for both patients and clinical staff to read.",
    "Keep JSON lean: severity_score, care_route, wait_range_minutes, rationale.",
    "If answers increase concern, bump severity and explain why.",
    "Never introduce new questions.",
    "",
    `Symptoms: ${symptoms}`,
    `Original severity: ${baseSeverity || "unknown"}`,
    `Original route: ${baseRoute || "unknown"}`,
    `Original wait: ${baseWaitRange || "unknown"}`,
    "Clarifying Q&A:",
    ...clarifyingQuestions.map((q, idx) => `- Q${idx + 1}: ${q} | Answer: ${answers[idx] ? "yes" : "no"}`),
    "",
    "Return JSON only.",
  ].join("\n");

  if (!geminiEnabled) {
    return fallbackClarify({ baseSeverity, baseRoute, baseWaitRange, answers });
  }

  return sendGeminiRequest({ prompt, errorLabel: "Gemini clarify" });
}

// --- Fallback heuristics and normalizers ---
function fallbackClarify({ baseSeverity, baseRoute, baseWaitRange, answers }) {
  const yesCount = Object.values(answers || {}).filter(Boolean).length;
  const newSeverity = clamp((Number(baseSeverity) || 2) + yesCount, 1, 5);
  const careRoute = baseRoute || routeFromSeverity(newSeverity);
  const waitRange = baseWaitRange || waitRangeFor(careRoute, newSeverity);
  return {
    severity_score: newSeverity,
    care_route: careRoute,
    wait_range_minutes: waitRange,
    rationale: yesCount
      ? `Answers increased concern (${yesCount} yes). Severity adjusted.`
      : "No added concern from follow-ups; keeping prior severity.",
  };
}

function fallbackHeuristic({ symptoms, age }) {
  const lower = symptoms.toLowerCase();
  let severity = 2;
  let careRoute = "telehealth";

  const redFlags = [
    "chest pain",
    "shortness of breath",
    "can't breathe",
    "cannot breathe",
    "coughing up blood",
    "cough blood",
    "hemoptysis",
    "faint",
    "bleeding",
    "vision loss",
    "stroke",
    "numbness",
    "confusion",
  ];
  const urgentFlags = ["fever", "vomit", "fracture", "sprain", "severe pain", "burn", "asthma", "wheezing"];

  if (redFlags.some((term) => lower.includes(term))) {
    severity = 5;
    careRoute = "er";
  } else if (urgentFlags.some((term) => lower.includes(term))) {
    severity = 3;
    careRoute = "urgent_care";
  }

  const wait = waitRangeFor(careRoute, severity);

  return {
    severity_score: severity,
    care_route: careRoute,
    wait_range_minutes: wait,
    extracted_features: {
      age: age || "unknown",
      notable_terms: redFlags.filter((t) => lower.includes(t)).concat(urgentFlags.filter((t) => lower.includes(t))),
    },
    rationale: "Based on the symptoms provided, this level of care keeps you safest. If anything worsens, seek immediate assistance.",
    clarifying_questions: buildClarifyingQuestions({ redFlags, urgentFlags, lower }),
  };
}

function normalizeTriage(aiResult, patient) {
  const severityScore = clamp(parseSeverity(aiResult.severity_score, 2), 1, 5);
  const careRoute = mergeCareRoute(aiResult.care_route, severityScore);
  const waitRange = aiResult.wait_range_minutes || waitRangeFor(careRoute, severityScore);
  const clarifyingQuestions = Array.isArray(aiResult.clarifying_questions) ? aiResult.clarifying_questions.slice(0, 3) : [];

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    patient,
    severityScore,
    severityLabel: severityLabel(severityScore),
    careRoute,
    waitRange,
    explanation: aiResult.rationale || "Recommendation generated from reported symptoms.",
    extractedFeatures: aiResult.extracted_features || {},
    clarifyingQuestions,
  };
}

function normalizeClarify(aiResult, context) {
  const severityScore = clamp(parseSeverity(aiResult.severity_score, parseSeverity(context.baseSeverity, 2)), 1, 5);
  const careRoute = mergeCareRoute(aiResult.care_route, severityScore);
  const waitRange = aiResult.wait_range_minutes || context.baseWaitRange || waitRangeFor(careRoute, severityScore);

  return {
    severityScore,
    severityLabel: severityLabel(severityScore),
    careRoute,
    waitRange,
    explanation: aiResult.rationale || "Clarifying answers processed to update severity.",
  };
}

function routeFromSeverity(score) {
  if (score >= 4) return "er";
  if (score === 3) return "urgent_care";
  return "telehealth";
}

function waitRangeFor(route, score) {
  if (route === "er") return score >= 4 ? "10-30" : "20-60";
  if (route === "urgent_care") return score >= 3 ? "20-60" : "30-90";
  return "5-20";
}

function severityLabel(score) {
  if (score >= 5) return "Critical";
  if (score === 4) return "High";
  if (score === 3) return "Moderate";
  if (score === 2) return "Low";
  return "Minimal";
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function buildForecast(route) {
  const base = {
    er: randomRange(8, 14),
    urgent_care: randomRange(6, 12),
    telehealth: randomRange(3, 9),
  };

  base[route] += 1;

  return {
    predictedLoadNextHour: base,
  };
}

function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildClarifyingQuestions({ redFlags, urgentFlags, lower }) {
  const questions = [];
  if (redFlags.some((term) => lower.includes(term))) {
    questions.push("Is the chest pain crushing/pressure-like and radiating to arm, jaw, or back?");
  }
  if (urgentFlags.some((term) => lower.includes(term))) {
    questions.push("Have symptoms worsened over the past 24 hours or limited your ability to hydrate/eat?");
  }
  questions.push("Are there any new or worsening breathing difficulties, confusion, or fainting spells?");
  return questions.slice(0, 3);
}

module.exports = app;
module.exports._internal = {
  callGemini,
  callGeminiClarify,
  fallbackClarify,
  fallbackHeuristic,
  normalizeClarify,
  normalizeTriage,
  routeFromSeverity,
  waitRangeFor,
  severityLabel,
  clamp,
  parseSeverity,
  mergeCareRoute,
  buildForecast,
  randomRange,
  buildClarifyingQuestions,
  sendGeminiRequest,
  handleClarifyRequest,
  buildClarifyCacheKey,
  clarifyCache,
};

async function sendGeminiRequest({ prompt, errorLabel }) {
  const body = { ...GEMINI_CONFIG, contents: [{ parts: [{ text: prompt }] }] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${errorLabel} error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;
    if (!textPart) throw new Error(`No ${errorLabel} content returned`);
    try {
      return JSON.parse(textPart);
    } catch (parseErr) {
      throw new Error(`${errorLabel} JSON parse failed: ${parseErr.message}`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`${errorLabel} request timed out`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Clarify helpers ---
async function handleClarifyRequest(payload) {
  const cacheKey = buildClarifyCacheKey(payload);
  const cached = clarifyCache.get(cacheKey);
  if (cached) return cached;

  const aiResult = await callGeminiClarify({
    symptoms: payload.symptoms,
    clarifyingQuestions: payload.clarifyingQuestions,
    answers: payload.answers,
    baseSeverity: payload.baseSeverity,
    baseRoute: payload.baseRoute,
    baseWaitRange: payload.baseWaitRange,
    geminiEnabled: payload.geminiEnabled,
  });

  const triage = normalizeClarify(aiResult, payload);
  const response = { triage };
  clarifyCache.set(cacheKey, response);
  if (clarifyCache.size > CLARIFY_CACHE_MAX) {
    const firstKey = clarifyCache.keys().next().value;
    clarifyCache.delete(firstKey);
  }
  return response;
}

function buildClarifyCacheKey({
  symptoms,
  clarifyingQuestions,
  answers,
  baseRoute,
  baseWaitRange,
  patient = {},
}) {
  return JSON.stringify({
    symptoms,
    clarifyingQuestions,
    answers,
    baseRoute,
    baseWaitRange,
    patientId: patient.id || patient.name || "",
  });
}

function parseSeverity(value, fallback) {
  const labelMap = {
    critical: 5,
    high: 4,
    moderate: 3,
    medium: 3,
    low: 2,
    minimal: 1,
    mild: 2,
  };

  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const digitMatch = value.match(/[1-5]/);
    if (digitMatch) return Number(digitMatch[0]);
    const normalized = value.trim().toLowerCase();
    if (labelMap[normalized]) return labelMap[normalized];
  }
  return fallback;
}

function mergeCareRoute(aiRoute, severityScore) {
  const validRoutes = ["er", "urgent_care", "telehealth"];
  const severityRoute = routeFromSeverity(severityScore);
  if (!validRoutes.includes(aiRoute)) return severityRoute;

  const priority = { er: 3, urgent_care: 2, telehealth: 1 };
  const aiPriority = priority[aiRoute];
  const severityPriority = priority[severityRoute];

  return aiPriority >= severityPriority ? aiRoute : severityRoute;
}
