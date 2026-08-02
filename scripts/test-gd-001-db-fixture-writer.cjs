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
  GD_001_FIXTURE_RPC,
  GD_001_FIXTURE_SCHEMA_VERSION,
  GD_001_RPC_NOT_EMPTY_PREFIX,
  GD_001_TEST_SLUGS,
  buildGoldenDemoFixtureRpcPayload,
  buildGd001CreatedApplyResult,
  buildGd001ExactMatchApplyNoop,
  buildGd001FixtureRpcPayload,
  buildResolvedResponseInserts,
  classifyGd001FixtureState,
  compareActualToExpectedResponse,
  executeGd001ApplyWithRpcBoundary,
  getGd001RpcErrorText,
  getGoldenDemoCandidateContract,
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
const expectedResponses = foundation.answers.rows
  .filter((row) => row.values.candidate_id === "GD-001")
  .map((row) => ({
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
const gd002Candidate = getGoldenDemoCandidateContract(foundation, "GD-002");
const gd003Candidate = getGoldenDemoCandidateContract(foundation, "GD-003");
assert.deepEqual(getGoldenDemoCandidateContract(foundation, "GD-004"), {
  candidateId: "GD-004",
  fullName: "Natali Delić",
  email: "natali.delic@partnerplus.ba",
  participantType: "employee",
  addressingForm: "feminine",
  teamId: "GDT-01",
});
assert.deepEqual(getGoldenDemoCandidateContract(foundation, "GD-005"), {
  candidateId: "GD-005",
  fullName: "Anisa Lojo Bajrić",
  email: "anisa.lojo.bajric@partnerplus.ba",
  participantType: "employee",
  addressingForm: "feminine",
  teamId: "GDT-01",
});
const gd002ExpectedResponses = foundation.answers.rows
  .filter((row) => row.values.candidate_id === "GD-002")
  .map((row) => ({
    testSlug: row.values.test_slug,
    questionCode: row.values.question_code,
    attemptId: `planned:${row.values.test_slug}`,
    questionId: `question:${row.values.test_slug}:${row.values.question_code}`,
    responseKind: row.values.response_kind,
    answerOptionId:
      row.values.response_kind === "single_choice"
        ? `option:${row.values.test_slug}:${row.values.question_code}:${row.values.answer_option_code}`
        : null,
    textValue: row.values.response_kind === "text" ? row.values.answer_value : null,
  }));
assert.equal(gd002ExpectedResponses.length, 184);

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

function classifyCandidate(snapshot, candidateToClassify, responses = expectedResponses) {
  return classifyGd001FixtureState({
    snapshot,
    expectedResponses: responses,
    candidate: candidateToClassify,
    testIdsBySlug,
  });
}

function participantOnlySnapshot(candidateToClassify, addressingForm) {
  const snapshot = baseSnapshot();
  snapshot.participant = {
    id: `participant:${candidateToClassify.candidateId.toLowerCase()}`,
    organization_id: snapshot.organizationId,
    user_id: null,
    email: candidateToClassify.email,
    full_name: candidateToClassify.fullName,
    participant_type: candidateToClassify.participantType,
    status: "active",
    addressing_form: addressingForm,
  };
  return snapshot;
}

assert.deepEqual(parseGd001WriterCli([]), {
  mode: "dry-run",
  candidateId: "GD-001",
  verbose: false,
});
assert.equal(parseGd001WriterCli(["--dry-run"]).mode, "dry-run");
assert.throws(() => parseGd001WriterCli(["--apply"]), /explicit --candidate/);
assert.throws(() => parseGd001WriterCli(["--candidate"]), /requires an explicit/);
assert.deepEqual(parseGd001WriterCli(["--candidate", "GD-002"]), {
  mode: "dry-run",
  candidateId: "GD-002",
  verbose: false,
});
assert.deepEqual(parseGd001WriterCli(["--apply", "--candidate", "GD-002"]), {
  mode: "apply",
  candidateId: "GD-002",
  verbose: false,
});
assert.deepEqual(gd003Candidate, {
  candidateId: "GD-003",
  fullName: "Vladimir Lučić",
  email: "vladimir.lucic@partnerplus.ba",
  participantType: "employee",
  addressingForm: "masculine",
  teamId: "GDT-01",
});
assert.deepEqual(parseGd001WriterCli(["--candidate", "GD-003"]), {
  mode: "dry-run",
  candidateId: "GD-003",
  verbose: false,
});
assert.deepEqual(parseGd001WriterCli(["--apply", "--candidate", "GD-003"]), {
  mode: "apply",
  candidateId: "GD-003",
  verbose: false,
});
assert.deepEqual(parseGd001WriterCli(["--candidate", "GD-004"]), {
  mode: "dry-run",
  candidateId: "GD-004",
  verbose: false,
});
assert.deepEqual(parseGd001WriterCli(["--apply", "--candidate", "GD-005"]), {
  mode: "apply",
  candidateId: "GD-005",
  verbose: false,
});
assert.throws(() => parseGd001WriterCli(["--candidate", "GD-019"]), /Only GD-001, GD-002, GD-003, GD-004, GD-005/);
assert.equal(
  parseGd001WriterCli(["--apply", "--candidate", "GD-001"]).mode,
  "apply",
);
for (const flag of ["--delete", "--cleanup", "--reset", "--force", "--overwrite"]) {
  assert.throws(() => parseGd001WriterCli([flag]), /separate future operator task/);
}
assert.equal(classify(baseSnapshot()).state, "EMPTY");
assert.equal(classify(exactSnapshot()).state, "EXACT_MATCH");
{
  const participantOnly = baseSnapshot();
  participantOnly.participant = {
    id: "participant:gd-001",
    organization_id: participantOnly.organizationId,
    user_id: null,
    email: candidate.email,
    full_name: candidate.fullName,
    participant_type: "employee",
    status: "active",
    addressing_form: candidate.addressingForm,
  };
  const participantOnlyClassification = classify(participantOnly);
  assert.equal(participantOnlyClassification.state, "EMPTY");
  assert.deepEqual(participantOnlyClassification.reasons, []);
}
for (const legacyNullCandidate of [gd002Candidate, gd003Candidate]) {
  const participantOnly = participantOnlySnapshot(legacyNullCandidate, null);
  const participantOnlyClassification = classifyCandidate(participantOnly, legacyNullCandidate);
  assert.equal(participantOnlyClassification.state, "EMPTY");
  assert.deepEqual(participantOnlyClassification.reasons, []);

  const wrongAddressing = participantOnlySnapshot(
    legacyNullCandidate,
    legacyNullCandidate.addressingForm === "masculine" ? "feminine" : "masculine",
  );
  assert.equal(classifyCandidate(wrongAddressing, legacyNullCandidate).state, "CONFLICT");
}
assert.equal(
  classifyCandidate(participantOnlySnapshot(candidate, null), candidate).state,
  "CONFLICT",
);
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
  conflict.participant.email = "other@example.com";
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

const rpcPayload = buildGd001FixtureRpcPayload(foundation);
assert.equal(rpcPayload.schema_version, GD_001_FIXTURE_SCHEMA_VERSION);
assert.equal(rpcPayload.candidate_id, "GD-001");
assert.equal(rpcPayload.tests.length, 3);
assert.deepEqual(
  rpcPayload.tests.map((test) => [test.test_slug, test.component_order]),
  [
    ["ipip-neo-120-v1", 0],
    ["safran_v1", 1],
    ["mwms_v1", 2],
  ],
);
assert.equal(rpcPayload.responses.length, 184);
assert.equal(rpcPayload.responses.filter((response) => response.test_slug === "ipip-neo-120-v1").length, 120);
assert.equal(rpcPayload.responses.filter((response) => response.test_slug === "safran_v1").length, 45);
assert.equal(rpcPayload.responses.filter((response) => response.test_slug === "mwms_v1").length, 19);
assert.equal(JSON.stringify(rpcPayload).includes("question_id"), false);
assert.equal(JSON.stringify(rpcPayload).includes("answer_option_id"), false);
assert.equal(JSON.stringify(rpcPayload).includes("raw_value"), false);
assert.equal(JSON.stringify(rpcPayload).includes("scored_value"), false);
assert.equal(JSON.stringify(rpcPayload).includes("expected_score"), false);
assert.equal(JSON.stringify(rpcPayload).includes("expected_ai"), false);

const gd002Payload = buildGoldenDemoFixtureRpcPayload(foundation, "GD-002");
assert.equal(gd002Payload.candidate_id, "GD-002");
assert.equal(gd002Payload.participant.display_name, gd002Candidate.fullName);
assert.equal(gd002Payload.participant.email, gd002Candidate.email);
assert.equal(gd002Payload.responses.length, 184);
assert.equal(
  gd002Payload.responses.every((response) =>
    foundation.answers.rows.some(
      (row) =>
        row.values.candidate_id === "GD-002" &&
        row.values.test_slug === response.test_slug &&
        row.values.question_code === response.question_code,
    ),
  ),
  true,
);
{
  const incompleteFoundation = structuredClone(foundation);
  incompleteFoundation.answers.rows = incompleteFoundation.answers.rows.filter(
    (row) => !(row.values.candidate_id === "GD-002" && row.values.test_slug === "mwms_v1" && row.values.question_code === "MWMS_19"),
  );
  assert.throws(
    () => buildGoldenDemoFixtureRpcPayload(incompleteFoundation, "GD-002"),
    /GD-002 RPC payload requires 184 responses/,
  );
}
const gd003Payload = buildGoldenDemoFixtureRpcPayload(foundation, "GD-003");
assert.equal(gd003Payload.candidate_id, "GD-003");
assert.equal(gd003Payload.participant.display_name, "Vladimir Lučić");
assert.equal(gd003Payload.participant.email, "vladimir.lucic@partnerplus.ba");
assert.equal(gd003Payload.participant.addressing_form, "masculine");
assert.equal(gd003Payload.responses.length, 184);
assert.deepEqual(
  Object.fromEntries(
    ["ipip-neo-120-v1", "safran_v1", "mwms_v1"].map((slug) => [
      slug,
      gd003Payload.responses.filter((response) => response.test_slug === slug).length,
    ]),
  ),
  { "ipip-neo-120-v1": 120, safran_v1: 45, mwms_v1: 19 },
);
{
  const incompleteFoundation = structuredClone(foundation);
  incompleteFoundation.answers.rows = incompleteFoundation.answers.rows.filter(
    (row) => !(row.values.candidate_id === "GD-003" && row.values.test_slug === "mwms_v1" && row.values.question_code === "MWMS_19"),
  );
  assert.throws(
    () => buildGoldenDemoFixtureRpcPayload(incompleteFoundation, "GD-003"),
    /GD-003 RPC payload requires 184 responses/,
  );
}

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
for (const field of ["code", "message", "details", "hint"]) {
  assert.match(
    getGd001RpcErrorText({ [field]: `${GD_001_RPC_NOT_EMPTY_PREFIX}: concurrent write` }),
    /GD_FIXTURE_NOT_EMPTY/,
  );
}

const writerSource = fs.readFileSync(
  path.join(projectRoot, "scripts/write-gd-001-db-fixture.cjs"),
  "utf8",
);
const rpcMigrationSource = fs.readFileSync(
  path.join(
    projectRoot,
    "supabase/migrations/20260717120000_create_golden_demo_gd001_fixture_rpc.sql",
  ),
  "utf8",
);
assert.doesNotMatch(writerSource, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
assert.doesNotMatch(
  writerSource,
  /persistCompletedAssessmentResults|enqueueCompletedAssessmentReports|processAssessmentReportJobs|OPENAI_API_KEY/,
);
assert.match(writerSource, /\.rpc\s*\(/);
assert.match(writerSource, /supabase\.rpc\(rpcName, \{ p_fixture: payload \}\)/);
assert.match(writerSource, /\.in\("test_id", Object\.values\(testIdsBySlug\)\)/);
assert.match(writerSource, /GOLDEN_DEMO_FIXTURE_RPC/);
assert.match(rpcMigrationSource, /create_golden_demo_gd001_fixture_v1\(p_fixture jsonb\)/);
assert.match(rpcMigrationSource, /security definer/i);
assert.match(rpcMigrationSource, /set search_path = ''/i);
assert.match(rpcMigrationSource, /pg_advisory_xact_lock/i);
assert.match(rpcMigrationSource, /GD_FIXTURE_NOT_EMPTY/);
assert.match(rpcMigrationSource, /revoke all on function[\s\S]*from public/i);
assert.match(rpcMigrationSource, /revoke all on function[\s\S]*from anon/i);
assert.match(rpcMigrationSource, /revoke all on function[\s\S]*from authenticated/i);
assert.match(rpcMigrationSource, /grant execute on function[\s\S]*to service_role/i);
assert.match(rpcMigrationSource, /response count/i);
assert.match(rpcMigrationSource, /response question\/test ownership/i);
assert.match(rpcMigrationSource, /duplicate response identity/i);
assert.match(rpcMigrationSource, /jsonb_typeof\(v_response -> 'answer_value'\)/i);
assert.doesNotMatch(rpcMigrationSource, /pg_catalog\.nullif/i);
assert.doesNotMatch(rpcMigrationSource, /on conflict/i);

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
  return { emptyPlan, exactPlan };
}).then(async ({ emptyPlan, exactPlan }) => {
  const rpcResult = {
    rpcVersion: GD_001_FIXTURE_RPC,
    stateBefore: "EMPTY",
    stateAfter: "CREATED",
    candidateId: "GD-001",
    organizationId: "organization:partner-plus",
    participantId: "participant:gd-001",
    assignmentId: "assignment:gd-001",
    attemptIds: attemptIdsBySlug,
    counts: {
      participants: 1,
      assignments: 1,
      attempts: 3,
      assignmentAttemptLinks: 3,
      responses: 184,
      ipipResponses: 120,
      safranResponses: 45,
      mwmsResponses: 19,
      dimensionScores: 0,
      attemptReports: 0,
      assessmentReports: 0,
    },
    scoringExecution: false,
    reportGeneration: false,
  };
  let rpcCalls = 0;
  let rechecks = 0;
  const created = await executeGd001ApplyWithRpcBoundary({
    initialPlan: emptyPlan,
    payload: rpcPayload,
    async invokeRpc(input) {
      rpcCalls += 1;
      assert.equal(input.rpcName, GD_001_FIXTURE_RPC);
      assert.deepEqual(input.payload, rpcPayload);
      return rpcResult;
    },
    async inspectAfterRpc() {
      rechecks += 1;
      return exactPlan;
    },
  });
  assert.equal(rpcCalls, 1);
  assert.equal(rechecks, 1);
  assert.equal(created.stateBefore, "EMPTY");
  assert.equal(created.stateAfter, "EXACT_MATCH");
  assert.equal(created.writesPerformed, true);
  assert.equal(created.responseCounts.total, 184);

  await assert.rejects(
    executeGd001ApplyWithRpcBoundary({
      initialPlan: emptyPlan,
      payload: rpcPayload,
      async invokeRpc() { return rpcResult; },
      async inspectAfterRpc() {
        return { ...exactPlan, state: "PARTIAL", blockers: ["missing response"] };
      },
    }),
    /post-write EXACT_MATCH/,
  );
  await assert.rejects(
    executeGd001ApplyWithRpcBoundary({
      initialPlan: emptyPlan,
      payload: rpcPayload,
      async invokeRpc() { return rpcResult; },
      async inspectAfterRpc() {
        return { ...exactPlan, state: "CONFLICT", blockers: ["different response"] };
      },
    }),
    /post-write EXACT_MATCH/,
  );

  const raceNoop = await executeGd001ApplyWithRpcBoundary({
    initialPlan: emptyPlan,
    payload: rpcPayload,
    async invokeRpc() { throw new Error(`${GD_001_RPC_NOT_EMPTY_PREFIX}: concurrent write`); },
    async inspectAfterRpc() { return exactPlan; },
  });
  assert.equal(raceNoop.writesPerformed, false);
  assert.equal(raceNoop.stateAfter, "EXACT_MATCH");
  for (const field of ["code", "message", "details", "hint"]) {
    const fieldRaceNoop = await executeGd001ApplyWithRpcBoundary({
      initialPlan: emptyPlan,
      payload: rpcPayload,
      async invokeRpc() {
        throw { [field]: `${GD_001_RPC_NOT_EMPTY_PREFIX}: concurrent write` };
      },
      async inspectAfterRpc() { return exactPlan; },
    });
    assert.equal(fieldRaceNoop.writesPerformed, false);
  }
  await assert.rejects(
    executeGd001ApplyWithRpcBoundary({
      initialPlan: emptyPlan,
      payload: rpcPayload,
      async invokeRpc() { throw new Error(`${GD_001_RPC_NOT_EMPTY_PREFIX}: concurrent write`); },
      async inspectAfterRpc() {
        return { ...exactPlan, state: "PARTIAL", blockers: ["missing response"] };
      },
    }),
    /read-only recheck found PARTIAL/,
  );
  let fallbackWrites = 0;
  await assert.rejects(
    executeGd001ApplyWithRpcBoundary({
      initialPlan: emptyPlan,
      payload: rpcPayload,
      async invokeRpc() {
        fallbackWrites += 1;
        throw new Error("RPC unavailable");
      },
      async inspectAfterRpc() {
        throw new Error("must not recheck generic RPC errors");
      },
    }),
    /RPC unavailable/,
  );
  assert.equal(fallbackWrites, 1);
  assert.throws(
    () => buildGd001CreatedApplyResult({ rpcResult, postWritePlan: { ...exactPlan, state: "PARTIAL", blockers: ["missing"] } }),
    /post-write EXACT_MATCH/,
  );
  assert.throws(
    () => buildGd001CreatedApplyResult({
      rpcResult: { ...rpcResult, participantId: "participant:different" },
      postWritePlan: exactPlan,
    }),
    /result IDs do not match/,
  );
  process.stdout.write(
    "GD-001 DB fixture writer tests passed (pure CLI, mocked RPC boundary, mapping, and state guards).\n",
  );
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
