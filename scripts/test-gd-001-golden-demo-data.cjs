const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const projectRoot = path.resolve(__dirname, "..");
const {
  loadGoldenDemoCsvFoundation,
  loadGoldenDemoRepoContract,
} = require("../lib/golden-demo/csv-loader.ts");
const { validateGoldenDemoCsvFoundation } = require(
  "../lib/golden-demo/csv-validator.ts",
);
const { buildGd001AnswerRecipe } = require(
  "../lib/golden-demo/gd-001-answer-recipe.ts",
);
const {
  verifyGd001ExpectedScores,
  verifyGoldenDemoExpectedScores,
} = require(
  "../lib/golden-demo/offline-score-verifier.ts",
);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function cloneDocument(document) {
  return {
    file: document.file,
    headers: [...document.headers],
    rows: document.rows.map((row) => ({
      rowNumber: row.rowNumber,
      columnCount: row.columnCount,
      values: { ...row.values },
    })),
  };
}

function cloneFoundation(foundation) {
  return {
    candidates: cloneDocument(foundation.candidates),
    answers: cloneDocument(foundation.answers),
    expectedScores: cloneDocument(foundation.expectedScores),
    expectedAiFindings: cloneDocument(foundation.expectedAiFindings),
  };
}

function expectVerifierError(foundation, code) {
  const result = verifyGd001ExpectedScores({ foundation, projectRoot });
  assert.equal(result.ok, false, `Expected verifier error ${code}`);
  assert.ok(
    result.errors.some((error) => error.code === code),
    `Expected ${code}; received ${result.errors.map((error) => error.code).join(", ")}`,
  );
}

function expectCandidateVerifierError(foundation, candidateId, assessments, code) {
  const result = verifyGoldenDemoExpectedScores({
    foundation,
    projectRoot,
    candidateId,
    assessments,
  });
  assert.equal(result.ok, false, `Expected candidate verifier error ${code}`);
  assert.ok(
    result.errors.some((error) => error.code === code),
    `Expected ${code}; received ${result.errors.map((error) => error.code).join(", ")}`,
  );
}

function expectCsvError(foundation, repoContract, code) {
  const result = validateGoldenDemoCsvFoundation(foundation, repoContract);
  assert.equal(result.ok, false, `Expected CSV error ${code}`);
  assert.ok(
    result.errors.some((error) => error.code === code),
    `Expected ${code}; received ${result.errors.map((error) => error.code).join(", ")}`,
  );
}

const foundation = loadGoldenDemoCsvFoundation(projectRoot);
const repoContract = loadGoldenDemoRepoContract(projectRoot);
const csvValidation = validateGoldenDemoCsvFoundation(foundation, repoContract);
assert.deepEqual(csvValidation.errors, []);

const gd001Answers = foundation.answers.rows.filter(
  (row) => row.values.candidate_id === "GD-001",
);
assert.equal(gd001Answers.length, 184);
assert.equal(
  gd001Answers.filter((row) => row.values.test_slug === "ipip-neo-120-v1").length,
  120,
);
assert.equal(
  gd001Answers.filter((row) => row.values.test_slug === "mwms_v1").length,
  19,
);
assert.equal(
  gd001Answers.filter((row) => row.values.test_slug === "safran_v1").length,
  45,
);
assert.equal(
  new Set(
    gd001Answers.map(
      (row) => `${row.values.test_slug}\u0000${row.values.question_code}`,
    ),
  ).size,
  184,
);
assert.ok(
  gd001Answers.every(
    (row) => row.values.recipe_version === "gd_001_answer_recipe_v1",
  ),
);

const ipipItems = readJson("assessment-packages/ipip-neo-120-v1/items.json");
const ipipOptions = readJson("assessment-packages/ipip-neo-120-v1/options.json");
const mwmsItems = readJson("assessment-packages/mwms_v1/items.json");
const safranItems = readJson("safran_v1_seed.json").items;
const generatedRecipe = buildGd001AnswerRecipe({
  ipipItems,
  ipipOptions,
  mwmsItems,
  safranItems,
});
const materializedAnswers = gd001Answers.map((row) => row.values);
assert.deepEqual(generatedRecipe, materializedAnswers);
assert.deepEqual(
  buildGd001AnswerRecipe({ ipipItems, ipipOptions, mwmsItems, safranItems }),
  generatedRecipe,
);

const numericAnswers = gd001Answers.filter(
  (row) => row.values.test_slug === "safran_v1" && row.values.response_kind === "text",
);
assert.equal(numericAnswers.length, 9);
assert.ok(numericAnswers.every((row) => /^-?\d+(?:\.\d+)?$/.test(row.values.answer_value)));
assert.equal(
  gd001Answers.filter(
    (row) => row.values.test_slug === "safran_v1" && row.values.response_kind === "single_choice",
  ).length,
  36,
);

const verification = verifyGd001ExpectedScores({ foundation, projectRoot });
assert.deepEqual(verification.errors, []);
assert.equal(verification.ok, true);
assert.equal(verification.answers.total, 184);
assert.ok(Object.values(verification.answers.completeByTest).every(Boolean));
assert.equal(verification.expectedScores.total, 47);
assert.equal(verification.expectedScores.matched, 47);
assert.equal(verification.scores.length, 47);
assert.ok(verification.scores.every((score) => score.band.length > 0));
assert.ok(
  Object.values(verification.expectedAiFindingsByLane).every((count) => count === 4),
);

const gd002IpipVerification = verifyGoldenDemoExpectedScores({
  foundation,
  projectRoot,
  candidateId: "GD-002",
  assessments: ["ipip-neo-120-v1"],
});
assert.equal(gd002IpipVerification.ok, true);
assert.equal(gd002IpipVerification.answers.byTest["ipip-neo-120-v1"], 120);
assert.equal(gd002IpipVerification.answers.expectedByTest["ipip-neo-120-v1"], 120);
assert.equal(gd002IpipVerification.expectedScores.total, 35);
assert.equal(gd002IpipVerification.expectedScores.matched, 35);
assert.equal(gd002IpipVerification.scores.length, 35);
assert.equal(gd002IpipVerification.answers.expectedByTest.mwms_v1, 0);
assert.equal(gd002IpipVerification.answers.expectedByTest.safran_v1, 0);

const gd001 = foundation.candidates.rows.find(
  (row) => row.values.candidate_id === "GD-001",
);
assert.equal(gd001?.values.data_status, "answers_ready");
assert.ok(
  foundation.candidates.rows
    .filter((row) => row.values.candidate_id !== "GD-001")
    .every((row) => row.values.data_status === "identity_only"),
);

for (const lane of [
  "ipip_participant",
  "ipip_hr",
  "mwms_participant",
  "mwms_hr",
  "safran_participant",
  "safran_hr",
  "composite_hr",
  "individual_development_profile",
]) {
  const findings = foundation.expectedAiFindings.rows.filter(
    (row) => row.values.candidate_id === "GD-001" && row.values.report_lane === lane,
  );
  assert.ok(findings.some((row) => row.values.expectation_type === "required_signal"));
  assert.ok(findings.some((row) => row.values.expectation_type === "forbidden_claim"));
}

{
  const mutated = cloneFoundation(foundation);
  const index = mutated.answers.rows.findIndex(
    (row) => row.values.test_slug === "ipip-neo-120-v1",
  );
  mutated.answers.rows.splice(index, 1);
  expectVerifierError(mutated, "missing_answer");
}
{
  const mutated = cloneFoundation(foundation);
  const source = mutated.answers.rows.find((row) => row.values.test_slug === "mwms_v1");
  assert.ok(source);
  mutated.answers.rows.push({
    rowNumber: mutated.answers.rows.length + 2,
    columnCount: source.columnCount,
    values: { ...source.values },
  });
  expectCsvError(mutated, repoContract, "duplicate_answer_identity");
}
{
  const mutated = cloneFoundation(foundation);
  const answer = mutated.answers.rows.find(
    (row) => row.values.test_slug === "ipip-neo-120-v1",
  );
  assert.ok(answer);
  answer.values.answer_option_code = "INVALID_OPTION";
  expectCsvError(mutated, repoContract, "answer_option_not_in_question");
}
{
  const mutated = cloneFoundation(foundation);
  const score = mutated.expectedScores.rows.find(
    (row) => row.values.score_key === "MORALITY",
  );
  assert.ok(score);
  score.values.expected_value = String(Number(score.values.expected_value) - 1);
  expectVerifierError(mutated, "expected_score_mismatch");
}
{
  const mutated = cloneFoundation(foundation);
  const numeric = mutated.answers.rows.find(
    (row) => row.values.test_slug === "safran_v1" && row.values.response_kind === "text",
  );
  assert.ok(numeric);
  numeric.values.answer_value = "4,5";
  expectCsvError(mutated, repoContract, "invalid_canonical_decimal");
}
{
  const mutated = cloneFoundation(foundation);
  const score = mutated.expectedScores.rows.find(
    (row) => row.values.score_key === "autonomous_motivation",
  );
  assert.ok(score);
  score.values.expected_value = "5.5";
  expectVerifierError(mutated, "expected_score_mismatch");
}
{
  const mutated = cloneFoundation(foundation);
  const score = mutated.expectedScores.rows.find(
    (row) => row.values.score_key === "figural_score",
  );
  assert.ok(score);
  score.values.expected_band = "higher_raw";
  expectVerifierError(mutated, "expected_band_mismatch");
}
{
  const mutated = cloneFoundation(foundation);
  mutated.expectedAiFindings.rows = mutated.expectedAiFindings.rows.filter(
    (row) =>
      row.values.report_lane !== "ipip_hr" ||
      row.values.expectation_type !== "required_signal",
  );
  expectVerifierError(mutated, "missing_required_signal");
}
{
  const mutated = cloneFoundation(foundation);
  mutated.expectedAiFindings.rows = mutated.expectedAiFindings.rows.filter(
    (row) =>
      row.values.report_lane !== "mwms_hr" ||
      row.values.expectation_type !== "forbidden_claim",
  );
  expectVerifierError(mutated, "missing_forbidden_claim");
}
{
  const mutated = cloneFoundation(foundation);
  const source = mutated.answers.rows[0];
  mutated.answers.rows.push({
    rowNumber: mutated.answers.rows.length + 2,
    columnCount: source.columnCount,
    values: { ...source.values, candidate_id: "GD-002" },
  });
  const result = verifyGd001ExpectedScores({ foundation: mutated, projectRoot });
  assert.equal(result.ok, true);
  assert.equal(
    result.errors.some((error) => error.code === "unexpected_candidate_answer"),
    false,
  );
}

expectCandidateVerifierError(
  foundation,
  "GD-999",
  ["ipip-neo-120-v1"],
  "unknown_candidate",
);
expectCandidateVerifierError(
  foundation,
  "GD-002",
  ["mwms_v1"],
  "missing_answer",
);
{
  const mutated = cloneFoundation(foundation);
  const source = mutated.answers.rows.find(
    (row) => row.values.candidate_id === "GD-002" && row.values.test_slug === "ipip-neo-120-v1",
  );
  assert.ok(source);
  mutated.answers.rows.push({
    rowNumber: mutated.answers.rows.length + 2,
    columnCount: source.columnCount,
    values: { ...source.values },
  });
  expectCandidateVerifierError(
    mutated,
    "GD-002",
    ["ipip-neo-120-v1"],
    "duplicate_answer",
  );
}
{
  const mutated = cloneFoundation(foundation);
  const score = mutated.expectedScores.rows.find(
    (row) => row.values.candidate_id === "GD-002" && row.values.score_key === "MORALITY",
  );
  assert.ok(score);
  score.values.expected_value = String(Number(score.values.expected_value) - 1);
  expectCandidateVerifierError(
    mutated,
    "GD-002",
    ["ipip-neo-120-v1"],
    "expected_score_mismatch",
  );
}
{
  const mutated = cloneFoundation(foundation);
  const candidate = mutated.candidates.rows.find(
    (row) => row.values.candidate_id === "GD-001",
  );
  assert.ok(candidate);
  candidate.values.data_status = "identity_only";
  expectVerifierError(mutated, "invalid_gd001_status");
  expectCsvError(mutated, repoContract, "candidate_status_answer_mismatch");
}

process.stdout.write(
  "Golden Demo offline verifier tests passed (GD-001 compatibility, GD-002 IPIP scope, and negative cases).\n",
);
