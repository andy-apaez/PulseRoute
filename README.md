# PulseRoute

AI-assisted patient intake that turns messy symptom text into structured JSON, severity scoring, care routing (ER / urgent care / telehealth), and a live hospital dashboard.

## Setup
1. Install deps: `npm install`
2. Add `GEMINI_API_KEY` in your env (Google Generative Language API).
3. Run the server: `npm start`
4. Open http://localhost:3000

If `GEMINI_API_KEY` is missing, the server falls back to a heuristic triage so you can still demo the UI.

## How it works
- `server.js`: Express server, static client, `/api/triage` endpoint that calls Gemini 1.5 Flash with a strict JSON prompt. Normalizes severity, care route, wait range, and explanation.
- `public/app.js`: Intake form, displays triage result, and feeds the hospital dashboard (incoming cases, bucket counts, predicted load).
- `public/styles.css`: Bold dashboard styling.

## Quick API test
```bash
curl -X POST http://localhost:3000/api/triage \
  -H "Content-Type: application/json" \
  -d '{ "symptoms": "Sudden chest pressure and sweating", "age": 61 }'
```
# PulseRoute
