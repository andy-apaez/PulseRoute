const test = require("node:test");
const assert = require("assert");

const { _internal } = require("./server");

test("fallbackHeuristic flags high-risk symptoms", () => {
  const result = _internal.fallbackHeuristic({ symptoms: "Severe chest pain and shortness of breath", age: 50 });

  assert.strictEqual(result.severity_score, 5);
  assert.strictEqual(result.care_route, "er");
  assert.ok(result.extracted_features.notable_terms.includes("chest pain"));
  assert.ok(result.clarifying_questions.some((q) => q.toLowerCase().includes("chest pain")));
});

test("fallbackHeuristic treats coughing blood as critical", () => {
  const result = _internal.fallbackHeuristic({ symptoms: "coughing up blood and can't breathe well", age: 23 });
  assert.strictEqual(result.severity_score, 5);
  assert.strictEqual(result.care_route, "er");
});

test("fallbackClarify increases severity when answers are concerning", () => {
  const result = _internal.fallbackClarify({
    baseSeverity: 2,
    baseRoute: "telehealth",
    baseWaitRange: "5-20",
    answers: { 0: true, 1: true },
  });

  assert.strictEqual(result.severity_score, 4);
  assert.strictEqual(result.care_route, "telehealth");
  assert.strictEqual(result.wait_range_minutes, "5-20");
  assert.match(result.rationale, /increased concern/i);
});

test("normalizeTriage clamps routes, labels, and clarifying questions", () => {
  const triage = _internal.normalizeTriage(
    {
      severity_score: 5,
      care_route: "unknown",
      wait_range_minutes: "",
      clarifying_questions: ["q1", "q2", "q3", "q4"],
      rationale: "",
      extracted_features: { foo: "bar" },
    },
    { symptoms: "test" }
  );

  assert.strictEqual(triage.careRoute, "er");
  assert.strictEqual(triage.severityLabel, "Critical");
  assert.strictEqual(triage.waitRange, "10-30");
  assert.strictEqual(triage.clarifyingQuestions.length, 3);
  assert.deepStrictEqual(triage.extractedFeatures, { foo: "bar" });
});

test("clarify caching prevents severity stacking on repeat submissions", async () => {
  _internal.clarifyCache.clear();
  const payload = {
    symptoms: "fever with mild cough",
    clarifyingQuestions: ["Recent travel?", "Any shortness of breath?"],
    answers: { 0: true, 1: true },
    baseSeverity: 2,
    baseRoute: "telehealth",
    baseWaitRange: "5-20",
  };

  const first = await _internal.handleClarifyRequest(payload);
  // Simulate a second click that resends answers but passes in the updated severity from the first response.
  const second = await _internal.handleClarifyRequest({
    ...payload,
    baseSeverity: first.triage.severityScore,
  });

  assert.strictEqual(second.triage.severityScore, first.triage.severityScore);
});

test("parseSeverity handles labels and numeric strings", () => {
  assert.strictEqual(_internal.parseSeverity("5", 2), 5);
  assert.strictEqual(_internal.parseSeverity("High", 2), 4);
  assert.strictEqual(_internal.parseSeverity("moderate", 2), 3);
  assert.strictEqual(_internal.parseSeverity("unknown", 3), 3);
});

test("mergeCareRoute upgrades telehealth to match high severity", () => {
  const route = _internal.mergeCareRoute("telehealth", 5);
  assert.strictEqual(route, "er");
});

test("parseSeverity extracts digits from mixed strings", () => {
  assert.strictEqual(_internal.parseSeverity("Severity 4 (urgent)", 2), 4);
});
