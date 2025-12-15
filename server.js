const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.enable("trust proxy");
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] === "http") {
    const host = req.headers.host || "";
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

app.listen(PORT, () => {
  console.log(`PulseRoute running on http://localhost:${PORT}`);
});

async function callGemini({ symptoms, age, vitals, history, geminiEnabled }) {
  const basePrompt = [
    "You are a hospital triage assistant.",
    "Given messy symptom text and basics, emit JSON only.",
    "Field rules:",
    "- severity_score: integer 1-5 (5 is critical).",
    "- care_route: one of er|urgent_care|telehealth.",
    "- wait_range_minutes: string like \"10-30\".",
    "- extracted_features: key clinical signals from the text.",
    "- rationale: 2-3 short sentences, warm and concise, no extra advice.",
    "- clarifying_questions: array of 1-3 short questions that would meaningfully tighten the severity score for this presentation.",
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.2,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const textPart = candidate?.content?.parts?.[0]?.text;

  if (!textPart) {
    throw new Error("No Gemini content returned");
  }

  try {
    return JSON.parse(textPart);
  } catch (err) {
    throw new Error(`Gemini JSON parse failed: ${err.message}`);
  }
}

function fallbackHeuristic({ symptoms, age }) {
  const lower = symptoms.toLowerCase();
  let severity = 2;
  let careRoute = "telehealth";

  const redFlags = ["chest pain", "shortness of breath", "faint", "bleeding", "vision loss", "stroke", "numbness", "confusion"];
  const urgentFlags = ["fever", "vomit", "fracture", "sprain", "severe pain", "burn"];

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
  const severityScore = clamp(Number(aiResult.severity_score) || 2, 1, 5);
  const careRoute = ["er", "urgent_care", "telehealth"].includes(aiResult.care_route)
    ? aiResult.care_route
    : routeFromSeverity(severityScore);
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
