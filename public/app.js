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
const mapStatus = document.getElementById("maps-status");
const mapContainer = document.getElementById("map");
const placesList = document.getElementById("places-list");
const locateBtn = document.getElementById("locate-btn");

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

const mapState = {
  map: null,
  markers: [],
  ready: false,
  lastLocation: null,
  locateBound: false,
};

renderAll();
bindLocateButton();
initMapsSection();

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

async function initMapsSection() {
  if (!mapStatus || !mapContainer || !placesList) return;

  setMapStatus("Loading map...", "ghost");
  if (locateBtn) locateBtn.disabled = true;

  if (!window.L) {
    setMapStatus("Map library failed to load", "muted");
    if (locateBtn) locateBtn.disabled = false;
    return;
  }

  mapState.map = L.map(mapContainer, { zoomControl: true }).setView(
    { lat: 37.773972, lng: -122.431297 },
    12
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapState.map);

  mapState.ready = true;
  setMapStatus("Map ready — use your location", "ghost");
  mapContainer.querySelector(".map-placeholder")?.remove();
  if (locateBtn) locateBtn.disabled = false;

  setTimeout(() => mapState.map.invalidateSize(), 200);
}

function requestLocation() {
  if (!mapState.map || !mapState.ready) {
    setMapStatus("Map unavailable or still initializing", "muted");
    if (locateBtn) locateBtn.disabled = false;
    return;
  }

  if (!navigator.geolocation) {
    setMapStatus("Geolocation unavailable in this browser", "muted");
    if (locateBtn) locateBtn.disabled = false;
    return;
  }

  if (!window.isSecureContext && !location.hostname.includes("localhost")) {
    setMapStatus("Enable HTTPS to use location", "muted");
    if (locateBtn) locateBtn.disabled = false;
    return;
  }

  setMapStatus("Requesting your location...", "ghost");
  if (locateBtn) locateBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (locateBtn) locateBtn.disabled = false;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      mapState.lastLocation = coords;
      mapState.map.setView(coords, 13);
      searchHospitals(coords);
    },
    (err) => {
      console.warn("Geolocation blocked", err);
      setMapStatus(geoErrorMessage(err), "muted");
      placesList.innerHTML = `<div class="meta-line">${geoErrorMessage(err)}</div>`;
      if (locateBtn) locateBtn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function bindLocateButton() {
  if (!locateBtn || mapState.locateBound) return;
  locateBtn.addEventListener("click", requestLocation);
  mapState.locateBound = true;
}

async function searchHospitals(origin) {
  setMapStatus("Searching nearby hospitals...", "ghost");
  placesList.innerHTML = `<div class="meta-line">Searching within ~10km...</div>`;
  clearMarkers();

  const query = `[out:json];
    (
      node["amenity"="hospital"](around:10000,${origin.lat},${origin.lng});
      way["amenity"="hospital"](around:10000,${origin.lat},${origin.lng});
      relation["amenity"="hospital"](around:10000,${origin.lat},${origin.lng});
    );
    out center tags;`;

  try {
    const data = await fetchHospitals(query);
    const places =
      data.elements
        ?.map((el) => {
          const tags = el.tags || {};
          const coords =
            el.type === "node"
              ? { lat: el.lat, lon: el.lon }
              : el.center
              ? { lat: el.center.lat, lon: el.center.lon }
              : null;
          if (!coords?.lat || !coords?.lon) return null;
          const distanceKm = origin ? haversineKm(origin, { lat: coords.lat, lng: coords.lon }) : null;
          return {
            name: tags.name || "Hospital",
            address: formatAddress(tags),
            phone: tags.phone || tags["contact:phone"] || "",
            lat: coords.lat,
            lon: coords.lon,
            distanceKm,
          };
        })
        .filter(Boolean) || [];

    if (!places.length) {
      setMapStatus("No hospitals found nearby", "muted");
      placesList.innerHTML = `<div class="meta-line">No hospitals found within ~10km.</div>`;
      return;
    }

    const sorted = places
      .filter((p) => typeof p.distanceKm === "number")
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .concat(places.filter((p) => p.distanceKm === null));

    const limited = sorted.slice(0, 10);
    limited.forEach((place) => {
      const directionsUrl = origin ? buildDirectionsLink(origin, place) : null;
      const popupHtml = [
        `<strong>${escapeHtml(place.name)}</strong>`,
        escapeHtml(place.address),
        directionsUrl ? `<a href="${directionsUrl}" target="_blank" rel="noopener">Directions</a>` : "",
      ]
        .filter(Boolean)
        .join("<br>");

      const marker = L.marker([place.lat, place.lon], { title: place.name })
        .addTo(mapState.map)
        .bindPopup(popupHtml);
      mapState.markers.push(marker);
    });

    const bounds = L.latLngBounds(limited.map((p) => [p.lat, p.lon]));
    mapState.map.fitBounds(bounds, { padding: [20, 20] });

    renderPlaces(limited, origin);
    setMapStatus(`Found ${limited.length} nearby`, "online");
  } catch (err) {
    console.error("Hospital search failed", err);
    setMapStatus("Search failed", "muted");
    placesList.innerHTML = `<div class="meta-line">Search failed: ${err.message}</div>`;
  }
}

function renderPlaces(places, origin) {
  placesList.innerHTML = "";
  places.forEach((place) => {
    const distanceKm = origin ? haversineKm(origin, { lat: place.lat, lng: place.lon }) : place.distanceKm;
    const contact = place.phone ? place.phone : "No phone listed";
    const directionsUrl = origin ? buildDirectionsLink(origin, place) : null;

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="title">${escapeHtml(place.name)}</div>
      <div class="meta-line">${escapeHtml(place.address)}</div>
      <div class="meta-line">${escapeHtml(contact)}</div>
      ${distanceKm ? `<div class="distance">${distanceKm.toFixed(1)} km away</div>` : ""}
      ${directionsUrl ? `<a class="meta-line" href="${directionsUrl}" target="_blank" rel="noopener">Directions</a>` : ""}
    `;
    placesList.appendChild(item);
  });
}

function clearMarkers() {
  mapState.markers.forEach((m) => {
    if (m.remove) {
      m.remove();
    } else if (m.setMap) {
      m.setMap(null);
    }
  });
  mapState.markers = [];
}

function setMapStatus(text, tone) {
  if (!mapStatus) return;
  mapStatus.textContent = text;
  mapStatus.className = tone ? `pill ${tone}` : "pill";
}

async function fetchHospitals(query) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let lastError = null;

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("All Overpass endpoints failed");
}

function buildDirectionsLink(origin, place) {
  if (!origin || !place) return null;
  const oLat = origin.lat.toFixed(6);
  const oLng = origin.lng.toFixed(6);
  const dLat = place.lat.toFixed(6);
  const dLng = place.lon.toFixed(6);
  return `https://www.openstreetmap.org/directions?engine=graphhopper_car&route=${oLat},${oLng};${dLat},${dLng}`;
}

function formatAddress(tags = {}) {
  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:place"];
  const parts = [tags["addr:housenumber"], tags["addr:street"], city, tags["addr:state"]];
  const address = parts.filter(Boolean).join(", ");
  return address || tags.address || "Address unavailable";
}

function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function geoErrorMessage(err) {
  if (!err || typeof err.code !== "number") return "Could not access location.";
  if (err.code === err.PERMISSION_DENIED) return "Location was blocked. Allow access to search nearby hospitals.";
  if (err.code === err.POSITION_UNAVAILABLE) return "Location unavailable. Check signal or try again.";
  if (err.code === err.TIMEOUT) return "Location timed out. Try again.";
  return "Could not access location.";
}
