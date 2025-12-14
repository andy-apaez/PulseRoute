# PulseRoute

AI-assisted patient intake that turns messy symptom text into structured JSON, severity scoring, care routing (ER / urgent care / telehealth), and a live hospital dashboard.

## Setup
1. Install deps: `npm install`
2. Add `GEMINI_API_KEY` in your env (Google Generative Language API).
3. Run the server: `npm start`
4. Open http://localhost:3000

If `GEMINI_API_KEY` is missing, the server falls back to a heuristic triage so you can still demo the UI.

For production/hosting (e.g., Vercel), the server redirects HTTP to HTTPS so geolocation keeps working. Vercel terminates TLS for you; just deploy this repo or port the static assets + `/api/triage` route to a serverless function.

### Nearby hospitals (Leaflet + OpenStreetMap)
- No API key required. Click **Use my location** on the map panel to search for nearby hospitals using OpenStreetMap / Overpass.

## How it works
- `server.js`: Express server, static client, `/api/triage` endpoint that calls Gemini 1.5 Flash with a strict JSON prompt. Normalizes severity, care route, wait range, and explanation.
- `public/app.js`: Intake form, displays triage result, feeds the hospital dashboard (incoming cases, bucket counts, predicted load), and loads Leaflet + OpenStreetMap for nearby hospitals.
- `public/styles.css`: Bold dashboard styling.

## Quick API test
```bash
curl -X POST http://localhost:3000/api/triage \
  -H "Content-Type: application/json" \
  -d '{ "symptoms": "Sudden chest pressure and sweating", "age": 61 }'
```
# PulseRoute
