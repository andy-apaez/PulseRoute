# PulseRoute

AI-assisted patient intake that turns messy symptom text into structured JSON, severity scoring, care routing (ER / urgent care / telehealth), and a live hospital dashboard.

## Setup
1. Install deps: `npm install`
2. Add `GEMINI_API_KEY` in your env (Google Generative Language API).
3. Run the server: `npm start`
4. Open http://localhost:3000 (hub) → choose Patient or Staff view

If `GEMINI_API_KEY` is missing, the server falls back to a heuristic triage so you can still demo the UI.

For production/hosting (e.g., Vercel), the server redirects HTTP to HTTPS so geolocation keeps working. Vercel terminates TLS for you; just deploy this repo or port the static assets + `/api/triage` route to a serverless function.

### Nearby hospitals (Leaflet + OpenStreetMap)
- No API key required. Click **Use my location** on the map panel to search for nearby hospitals using OpenStreetMap / Overpass.

### Multilingual intake
- Language switcher on the intake panel supports English, Spanish, Chinese, and Arabic (with RTL layout).

### SBAR write-up
- The result card auto-generates an SBAR summary grounded in the triage outcome and structured features; includes age, sex, chief complaint, duration, vitals (when provided), and severity.

### Dual entry points
- Hub: root `index.html` with “I’m a Patient” and “I’m Medical Staff” buttons.
- Patient-facing intake: `patient.html` (calm, plain-language guidance).
- Staff-facing dashboard: `staff.html` (operational and analytical; reads the latest triage runs stored in-browser).

## How it works
- `server.js`: Express server, static clients, `/api/triage` endpoint that calls Gemini 1.5 Flash with a strict JSON prompt. Normalizes severity, care route, wait range, and explanation.
- `public/app.js`: Patient intake, triage result (clarifying questions, SBAR generator), multilingual UI, map search, and local persistence of latest cases.
- `public/staff.js`: Staff-only dashboard that renders incoming cases, acuity buckets, and predicted load, pulling the latest cases from local storage when available.
- `public/styles.css`: Bold dashboard styling.

## Quick API test
```bash
curl -X POST http://localhost:3000/api/triage \
  -H "Content-Type: application/json" \
  -d '{ "symptoms": "Sudden chest pressure and sweating", "age": 61 }'
```
# PulseRoute
