const intakeForm = document.getElementById("intake-form");
const incomingList = document.getElementById("incoming-list");
const bucketBars = document.getElementById("bucket-bars");
const forecastGrid = document.getElementById("forecast-grid");
const loadPill = document.getElementById("load-pill");

const resultTitle = document.getElementById("result-title");
const resultSeverity = document.getElementById("result-severity");
const resultRoute = document.getElementById("result-route");
const resultWait = document.getElementById("result-wait");
const resultText = document.getElementById("result-explanation");
const resultFeatures = document.getElementById("result-features");

const state = {
  cases: [
    {
      name: "Samuel P.",
      age: 68,
      symptoms: "Chest tightness, sweating, nausea while climbing stairs",
      severityScore: 5,
      severityLabel: "Critical",
      careRoute: "er",
      waitRange: "10-30",
      explanation: "Chest pain + exertional shortness of breath flagged for ER evaluation.",
    },
    {
      name: "Maya L.",
      age: 31,
      symptoms: "High fever, body aches, green sputum cough for 4 days",
      severityScore: 3,
      severityLabel: "Moderate",
      careRoute: "urgent_care",
      waitRange: "30-60",
      explanation: "Persistent fever with productive cough; needs in-person assessment today.",
    },
    {
      name: "Dylan R.",
      age: 24,
      symptoms: "Rash on forearms, no fever, mild itch",
      severityScore: 2,
      severityLabel: "Low",
      careRoute: "telehealth",
      waitRange: "5-20",
      explanation: "Stable vitals and localized rash suitable for virtual care.",
    },
  ],
  forecast: {
    predictedLoadNextHour: { er: 10, urgent_care: 8, telehealth: 5 },
  },
};

renderAll();

intakeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(intakeForm);
  const payload = {
    name: form.get("name") || "Unnamed patient",
    age: form.get("age") ? Number(form.get("age")) : undefined,
    symptoms: form.get("symptoms"),
    vitals: form.get("vitals"),
    history: form.get("history"),
  };

  setResultLoading();

  try {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Server error");
    }

    const data = await res.json();
    const triage = data.triage;

    state.cases.unshift({
      name: payload.name,
      age: payload.age,
      symptoms: payload.symptoms,
      severityScore: triage.severityScore,
      severityLabel: triage.severityLabel,
      careRoute: triage.careRoute,
      waitRange: triage.waitRange,
      explanation: triage.explanation,
      extractedFeatures: triage.extractedFeatures,
    });

    state.cases.length = Math.min(state.cases.length, 12);
    state.forecast = data.forecast || state.forecast;

    renderResult(triage);
    renderAll();
  } catch (err) {
    renderError(err.message);
  }
});

function renderAll() {
  renderIncoming();
  renderBuckets();
  renderForecast();
}

function renderIncoming() {
  incomingList.innerHTML = "";
  state.cases.slice(0, 6).forEach((c) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div class="title">${c.name} ${c.age ? `• ${c.age}` : ""}</div>
        <div class="meta-line">${c.symptoms}</div>
        <div class="meta-line">${c.explanation}</div>
      </div>
      <div class="align-end">
        <div class="badge ${c.careRoute}">${routeLabel(c.careRoute)}</div>
        <div class="meta-line">${c.severityLabel} • ${c.waitRange} mins</div>
      </div>
    `;
    incomingList.appendChild(div);
  });
}

function renderBuckets() {
  bucketBars.innerHTML = "";
  const counts = { er: 0, urgent_care: 0, telehealth: 0 };

  state.cases.forEach((c) => {
    counts[c.careRoute] = (counts[c.careRoute] || 0) + 1;
  });

  [
    { key: "er", label: "Critical (ER)" },
    { key: "urgent_care", label: "Urgent" },
    { key: "telehealth", label: "Telehealth" },
  ].forEach((row) => {
    const total = Math.max(...Object.values(counts), 1);
    const pct = Math.round((counts[row.key] / total) * 100);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = `
      <div class="bar-label">
        <span>${row.label}</span>
        <span>${counts[row.key]} cases</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%"></div>
      </div>
    `;
    bucketBars.appendChild(bar);
  });
}

function renderForecast() {
  forecastGrid.innerHTML = "";
  const load = state.forecast?.predictedLoadNextHour || {};
  const order = [
    { key: "er", label: "ER" },
    { key: "urgent_care", label: "Urgent Care" },
    { key: "telehealth", label: "Telehealth" },
  ];

  order.forEach((row) => {
    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <div class="label">${row.label}</div>
      <div class="value">${load[row.key] ?? "—"}</div>
      <div class="small">predicted visits</div>
    `;
    forecastGrid.appendChild(card);
  });

  const sum = Object.values(load).filter(Boolean).reduce((a, b) => a + b, 0);
  loadPill.textContent = sum ? `Load: ${sum} predicted next hour` : "Predicted load updating";
}

function renderResult(triage) {
  resultTitle.textContent = `${triage.patient.name || "New patient"} • Severity ${triage.severityScore}`;
  resultSeverity.textContent = triage.severityLabel;
  resultRoute.textContent = routeLabel(triage.careRoute);
  resultWait.textContent = `${triage.waitRange} mins`;
  resultText.textContent = triage.explanation;

  resultSeverity.className = `pill ${severityClass(triage.severityScore)}`;
  resultRoute.className = `pill ${triage.careRoute}`;
  resultWait.className = "pill ghost";

  resultFeatures.innerHTML = "";

  const extracted = triage.extractedFeatures || {};
  const featureEntries = Object.entries(extracted);

  if (!featureEntries.length) {
    resultFeatures.innerHTML = `<div class="feature"><div class="label">Signals</div><div class="value">No structured features returned.</div></div>`;
    return;
  }

  featureEntries.forEach(([key, value]) => {
    const block = document.createElement("div");
    block.className = "feature";
    block.innerHTML = `<div class="label">${key}</div><div class="value">${formatValue(value)}</div>`;
    resultFeatures.appendChild(block);
  });
}

function setResultLoading() {
  resultTitle.textContent = "Scoring...";
  resultSeverity.textContent = "—";
  resultRoute.textContent = "—";
  resultWait.textContent = "—";
  resultText.textContent = "Consulting Gemini for structured triage.";
  resultFeatures.innerHTML = "";
}

function renderError(message) {
  resultTitle.textContent = "Triage failed";
  resultSeverity.textContent = "—";
  resultRoute.textContent = "—";
  resultWait.textContent = "—";
  resultText.textContent = `Could not complete triage: ${message}`;
  resultFeatures.innerHTML = "";
}

function routeLabel(route) {
  if (route === "er") return "ER";
  if (route === "urgent_care") return "Urgent Care";
  return "Telehealth";
}

function severityClass(score) {
  if (score >= 4) return "severity-high";
  if (score === 3) return "severity-med";
  return "severity-low";
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}
