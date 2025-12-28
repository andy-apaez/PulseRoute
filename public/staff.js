const incomingList = document.getElementById("incoming-list");
const bucketBars = document.getElementById("bucket-bars");
const forecastGrid = document.getElementById("forecast-grid");
const loadPill = document.getElementById("load-pill");

const DASHBOARD_STORAGE_KEY = "dashboard_state";

const fallbackState = {
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
  lastSBAR: "",
};

let state = loadStateFromStorage() || fallbackState;

renderAll();

window.addEventListener("storage", (e) => {
  if (e.key !== DASHBOARD_STORAGE_KEY) return;
  const updated = loadStateFromStorage();
  if (updated) {
    state = updated;
    renderAll();
  }
});

function renderAll() {
  renderIncoming();
  renderBuckets();
  renderForecast();
}

function renderIncoming() {
  if (!incomingList) return;
  incomingList.innerHTML = "";
  state.cases.slice(0, 6).forEach((c) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "item clickable";
    button.addEventListener("click", () => showPatientModal(c));
    button.innerHTML = `
      <div>
        <div class="title">${c.name} ${c.age ? `• ${c.age}` : ""}</div>
        <div class="meta-line">${c.symptoms}</div>
        <div class="meta-line">${c.explanation || ""}</div>
      </div>
      <div class="align-end">
        <div class="badge ${c.careRoute}">${routeLabel(c.careRoute)}</div>
        <div class="meta-line">${c.severityLabel} • ${c.waitRange} mins</div>
      </div>
    `;
    incomingList.appendChild(button);
  });
}

function renderBuckets() {
  if (!bucketBars) return;
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
  if (!forecastGrid) return;
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

  const loadValues = Object.values(load).filter((value) => Number.isFinite(value));
  const sum = loadValues.reduce((total, value) => total + value, 0);
  if (loadPill) {
    loadPill.textContent =
      loadValues.length > 0 ? `Load: ${sum} predicted next hour` : "Predicted load updating";
  }
}

function routeLabel(route) {
  if (route === "er") return "ER";
  if (route === "urgent_care") return "Urgent Care";
  return "Telehealth";
}

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cases?.length) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

function showPatientModal(caseItem) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";

  const card = document.createElement("div");
  card.className = "modal-card";
  const sbarText = caseItem.sbar ?? state.lastSBAR ?? "No SBAR captured yet.";
  card.innerHTML = `
    <div class="modal-head">
      <div>
        <div class="title">${caseItem.name || "Patient"}</div>
        <div class="small">${caseItem.age ? `${caseItem.age} yrs` : ""} ${caseItem.sex || ""}</div>
      </div>
      <button class="ghost-btn small" id="modal-close">Close</button>
    </div>
    <div class="modal-body">
      <div class="meta-line"><strong>Severity:</strong> ${caseItem.severityLabel} (${routeLabel(caseItem.careRoute)})</div>
      <div class="meta-line"><strong>Wait:</strong> ${caseItem.waitRange || "-"} mins</div>
      <div class="meta-line"><strong>Chief complaint:</strong> ${caseItem.symptoms || "-"}</div>
      <div class="meta-line"><strong>Duration:</strong> ${caseItem.duration || "-"}</div>
      <div class="meta-line"><strong>Vitals:</strong> ${caseItem.vitals || "-"}</div>
      <div class="meta-line"><strong>SBAR:</strong></div>
      <div class="modal-sbar-block" aria-label="SBAR summary"></div>
    </div>
  `;

  modal.appendChild(card);
  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
    document.removeEventListener("keydown", onEscape);
  };

  const onEscape = (event) => {
    if (event.key === "Escape") closeModal();
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  const closeBtn = card.querySelector("#modal-close");
  closeBtn?.addEventListener("click", closeModal);
  document.addEventListener("keydown", onEscape);

  const sbarContainer = card.querySelector(".modal-sbar-block");
  renderSBARBlocks(sbarContainer, sbarText);
}

function renderSBARBlocks(container, sbarText) {
  if (!container) return;
  container.innerHTML = "";
  const content = sbarText && sbarText.trim() ? sbarText : "No SBAR captured yet.";
  const wrapper = document.createElement("div");
  wrapper.className = "sbar-blocks";

  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    const labelText = match ? match[1] : "Note";
    const bodyText = match ? match[2] : trimmed;

    const item = document.createElement("div");
    item.className = "sbar-item";

    const label = document.createElement("div");
    label.className = "sbar-label";
    label.textContent = `${labelText}:`;

    const body = document.createElement("div");
    body.className = "sbar-body";
    body.appendChild(highlightSBARBody(bodyText));

    item.append(label, body);
    wrapper.appendChild(item);
  });

  container.appendChild(wrapper);
}

function highlightSBARBody(text) {
  const keywords = ["age", "sex", "vitals", "history", "severity", "route", "wait", "clarifying", "chief complaint", "duration"];
  const regex = new RegExp(`\\b(${keywords.join("|")})\\b`, "gi");
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const keySpan = document.createElement("span");
    keySpan.className = "sbar-key";
    keySpan.textContent = match[0];
    fragment.appendChild(keySpan);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}
