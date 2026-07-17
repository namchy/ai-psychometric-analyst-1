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
const { loadGoldenDemoCsvFoundation } = require("../lib/golden-demo/csv-loader.ts");
const {
  GD_001_TEST_SLUGS,
  GD_001_TRANSACTION_BLOCKER,
  buildGd001ExactMatchApplyNoop,
  buildResolvedResponseInserts,
  classifyGd001FixtureState,
  compareActualToExpectedResponse,
  getGd001CandidateContract,
  inspectGd001FixtureWithRepository,
  parseGd001WriterCli,
  verifyGd001FinalCounts,
} = require("../lib/golden-demo/db-fixture-writer.ts");
const { redactSecrets, requireEnvironment } = require("./write-gd-001-db-fixture.cjs");

const foundation = loadGoldenDemoCsvFoundation(projectRoot);
const candidate = getGd001CandidateContract(foundation);
const testIdsBySlug = Object.fromEntries(
  GD_001_TEST_SLUGS.map((slug) => [slug, `test:${slug}`]),
);
const attemptIdsBySlug = Object.fromEntries(
  GD_001_TEST_SLUGS.map((slug) => [slug, `attempt:${slug}`]),
);
const expectedResponses = foundation.answers.rows.map((row) => ({
  testSlug: row.values.test_slug,
  questionCode: row.values.question_code,
  attemptId: attemptIdsBySlug[row.values.test_slug],
  questionId: `question:${row.values.test_slug}:${row.values.question_code}`,
  responseKind: row.values.response_kind,
  answerOptionId:
    row.values.response_kind === "single_choice"
      ? `option:${row.values.test_slug}:${row.values.question_code}:${row.values.answer_option_code}`
      : null,
  textValue: row.values.response_kind === "text" ? row.values.answer_value : null,
}));
assert.equal(expectedResponses.length, 184);

function baseSnapshot() {
  return {
    organizationId: "organization:partner-plus",
    participant: null,
    participantConflictReasons: [],
    assignments: [],
    attempts: [],
    links: [],
    responses: [],
    dimensionScoreCount: 0,
    attemptReportCount: 0,
    assessmentReportCount: 0,
  };
}

function exactSnapshot() {
  const snapshot = baseSnapshot();
  snapshot.participant = {
    id: "participant:gd-001",
    organization_id: snapshot.organizationId,
    user_id: null,
    email: " AMEL.KOVACEVIC@PARTNERPLUS.BA ",
    full_name: "  amel   KOVAČEVIĆ ",
    participant_type: "employee",
    status: "active",
    addressing_form: "masculine",
  };
  snapshot.assignments = [
    {
      id: "assignment:gd-001",
      organization_id: snapshot.organizationId,
      participant_id: snapshot.participant.id,
      assignment_type: "standard_battery",
      status: "active",
      locale: "bs",
      completed_at: null,
    },
  ];
  snapshot.attempts = GD_001_TEST_SLUGS.map((slug) => ({
    id: attemptIdsBySlug[slug],
    test_id: testIdsBySlug[slug],
    test_slug: slug,
    organization_id: snapshot.organizationId,
    participant_id: snapshot.participant.id,
    user_id: null,
    status: "in_progress",
    locale: "bs",
    addressing_form_snapshot: "masculine",
    completed_at: null,
    scored_started_at: null,
  }));
  snapshot.links = GD_001_TEST_SLUGS.map((slug, position) => ({
    assessment_assignment_id: snapshot.assignments[0].id,
    attempt_id: attemptIdsBySlug[slug],
    test_id: testIdsBySlug[slug],
    test_slug: slug,
    role_in_assignment: "standard_component",
    required_for_composite: true,
    required_for_team_fit: false,
    position,
  }));
  snapshot.responses = expectedResponses.map((response) => ({
    attempt_id: response.attemptId,
    question_id: response.questionId,
    response_kind: response.responseKind,
    answer_option_id: response.answerOptionId,
    text_value: response.textValue,
    raw_value: null,
    scored_value: null,
  }));
  return snapshot;
}

function classify(snapshot, responses = expectedResponses) {
  return classifyGd001FixtureState({
    snapshot,
    expectedResponses: responses,
    candidate,
    testIdsBySlug,
  });
}

assert.deepEqual(parseGd001WriterCli([]), {
  mode: "dry-run",
  candidateId: "GD-001",
  verbose: false,
});
assert.equal(parseGd001WriterCli(["--dry-run"]).mode, "dry-run");
assert.throws(() => parseGd001WriterCli(["--apply"]), /--candidate GD-001/);
assert.throws(
  () => parseGd001WriterCli(["--apply", "--candidate", "GD-002"]),
  /GD-001/,
);
assert.equal(
  parseGd001WriterCli(["--apply", "--candidate", "GD-001"]).mode,
  "apply",
);
for (const flag of ["--delete", "--cleanup", "--reset", "--force", "--overwrite"]) {
  assert.throws(() => parseGd001WriterCli([flag]), /separate future operator task/);
}
assert.match(GD_001_TRANSACTION_BLOCKER, /no existing RPC/);

assert.equal(classify(baseSnapshot()).state, "EMPTY");
assert.equal(classify(exactSnapshot()).state, "EXACT_MATCH");
{
  const partial = exactSnapshot();
  partial.responses.pop();
  assert.equal(classify(partial).state, "PARTIAL");
}
{
  const partial = exactSnapshot();
  partial.attempts = partial.attempts.slice(0, 2);
  partial.links = partial.links.slice(0, 2);
  partial.responses = partial.responses.filter(
    (response) => response.attempt_id !== attemptIdsBySlug.mwms_v1,
  );
  assert.equal(classify(partial).state, "PARTIAL");
}
{
  const conflict = exactSnapshot();
  conflict.responses[0].answer_option_id = "option:different";
  assert.equal(classify(conflict).state, "CONFLICT");
}
{
  const conflict = exactSnapshot();
  conflict.dimensionScoreCount = 1;
  assert.equal(classify(conflict).state, "CONFLICT");
}

let repositoryInspectCalls = 0;
const emptyPlanPromise = inspectGd001FixtureWithRepository({
  async inspect() {
    repositoryInspectCalls += 1;
    return {
      snapshot: baseSnapshot(),
      expectedResponses,
      candidate,
      testIdsBySlug,
    };
  },
});
const exactPlanPromise = inspectGd001FixtureWithRepository({
  async inspect() {
    return {
      snapshot: exactSnapshot(),
      expectedResponses,
      candidate,
      testIdsBySlug,
    };
  },
});

const responseInserts = buildResolvedResponseInserts(expectedResponses);
assert.equal(responseInserts.length, 184);
assert.equal(
  responseInserts.filter((response) => response.response_kind === "single_choice").length,
  175,
);
assert.equal(
  responseInserts.filter((response) => response.response_kind === "text").length,
  9,
);
for (const response of responseInserts) {
  assert.equal(Object.hasOwn(response, "raw_value"), false);
  assert.equal(Object.hasOwn(response, "scored_value"), false);
  if (response.response_kind === "single_choice") {
    assert.equal(typeof response.answer_option_id, "string");
    assert.equal(Object.hasOwn(response, "text_value"), false);
  } else {
    assert.equal(typeof response.text_value, "string");
    assert.equal(Object.hasOwn(response, "answer_option_id"), false);
  }
}
assert.equal(
  compareActualToExpectedResponse(exactSnapshot().responses[0], expectedResponses[0]),
  true,
);

assert.deepEqual(
  verifyGd001FinalCounts({
    participant: 1,
    assignment: 1,
    attempts: 3,
    responses: 184,
    dimension_scores: 0,
    attempt_reports: 0,
    assessment_reports: 0,
  }),
  { ok: true, errors: [] },
);
assert.equal(
  verifyGd001FinalCounts({
    participant: 1,
    assignment: 1,
    attempts: 3,
    responses: 183,
    dimension_scores: 0,
    attempt_reports: 0,
    assessment_reports: 0,
  }).ok,
  false,
);

assert.throws(
  () => requireEnvironment("SUPABASE_SERVICE_ROLE_KEY", {}),
  /^Error: Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY$/,
);
const secretEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://secret-project.example",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-super-secret",
};
const redacted = redactSecrets(
  `Failure at ${secretEnv.NEXT_PUBLIC_SUPABASE_URL} using ${secretEnv.SUPABASE_SERVICE_ROLE_KEY}`,
  secretEnv,
);
assert.doesNotMatch(redacted, /secret-project|service-role-super-secret/);

const writerSource = fs.readFileSync(
  path.join(projectRoot, "scripts/write-gd-001-db-fixture.cjs"),
  "utf8",
);
assert.doesNotMatch(writerSource, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
assert.doesNotMatch(
  writerSource,
  /persistCompletedAssessmentResults|enqueueCompletedAssessmentReports|processAssessmentReportJobs|OPENAI_API_KEY/,
);

Promise.all([emptyPlanPromise, exactPlanPromise]).then(([emptyPlan, exactPlan]) => {
  assert.equal(repositoryInspectCalls, 1);
  assert.equal(emptyPlan.state, "EMPTY");
  assert.equal(emptyPlan.participant.action, "create");
  assert.equal(emptyPlan.assignment.action, "create");
  assert.equal(emptyPlan.responses.expected, 184);
  assert.equal(emptyPlan.responses.resolved, 184);
  assert.equal(emptyPlan.responses.insert, 184);
  assert.equal(emptyPlan.writesPerformed, false);
  assert.equal(emptyPlan.scoringExecution, false);
  assert.equal(emptyPlan.reportGeneration, false);
  const applyNoop = buildGd001ExactMatchApplyNoop(exactPlan);
  assert.equal(applyNoop.stateBefore, "EXACT_MATCH");
  assert.equal(applyNoop.stateAfter, "EXACT_MATCH");
  assert.equal(applyNoop.writesPerformed, false);
  assert.equal(applyNoop.responseCounts["ipip-neo-120-v1"], 120);
  assert.throws(() => buildGd001ExactMatchApplyNoop(emptyPlan), /requires EXACT_MATCH/);
  process.stdout.write(
    "GD-001 DB fixture writer tests passed (pure CLI, mocked repository, mapping, and state guards).\n",
  );
});
