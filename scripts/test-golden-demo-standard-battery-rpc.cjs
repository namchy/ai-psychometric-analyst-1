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
const migration = fs.readFileSync(
  path.join(
    projectRoot,
    "supabase/migrations/20260802123000_generalize_golden_demo_legacy_addressing.sql",
  ),
  "utf8",
);
const foundation = require("../lib/golden-demo/csv-loader.ts").loadGoldenDemoCsvFoundation(projectRoot);
const {
  GOLDEN_DEMO_FIXTURE_RPC,
  GOLDEN_DEMO_TEST_SLUGS,
  buildGoldenDemoFixtureRpcPayload,
  executeGoldenDemoApplyWithRpcBoundary,
  getGoldenDemoCandidateContract,
  parseGd001WriterCli,
  validateGoldenDemoFixtureRpcResult,
} = require("../lib/golden-demo/db-fixture-writer.ts");

assert.match(migration, /create or replace function public\.create_golden_demo_standard_battery_fixture_v2\(p_fixture jsonb\)/);
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = ''/i);
assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/);
assert.match(migration, /golden-demo:partner-plus:' \|\| v_candidate_id/);
assert.match(migration, /v_candidate_id not in \('GD-001', 'GD-002', 'GD-003', 'GD-004', 'GD-005'\)/);
assert.match(migration, /amel\.kovacevic@partnerplus\.ba/);
assert.match(migration, /natasa\.rapaic@partnerplus\.ba/);
assert.match(migration, /Nataša Rapaić/);
assert.match(migration, /vladimir\.lucic@partnerplus\.ba/);
assert.match(migration, /Vladimir Lučić/);
assert.match(migration, /natali\.delic@partnerplus\.ba/);
assert.match(migration, /Natali Delić/);
assert.match(migration, /anisa\.lojo\.bajric@partnerplus\.ba/);
assert.match(migration, /Anisa Lojo Bajrić/);
assert.match(migration, /v_expected_addressing_form := 'masculine'/);
assert.match(migration, /elsif v_candidate_id = 'GD-003' then/);
assert.match(migration, /elsif v_candidate_id in \('GD-002', 'GD-003', 'GD-004', 'GD-005'\) then[\s\S]*requires an existing canonical participant/);
assert.match(
  migration,
  /v_existing_addressing_form is not null[\s\S]*v_existing_addressing_form is distinct from v_expected_addressing_form/,
);
assert.doesNotMatch(
  migration,
  /v_candidate_id in \('GD-002', 'GD-003'\)[\s\S]*v_existing_addressing_form is null/,
);
assert.match(migration, /if v_participant_id is null then[\s\S]*insert into public\.participants/);
assert.doesNotMatch(migration, /update\s+public\.participants/i);
assert.match(migration, /addressing_form_snapshot[\s\S]*v_expected_addressing_form/);
assert.match(migration, /v_test_slug not in \('ipip-neo-120-v1', 'safran_v1', 'mwms_v1'\)/);
assert.match(migration, /jsonb_array_length\(p_fixture -> 'responses'\) <> 184/);
assert.match(migration, /v_ipip_response_count <> 120 or v_safran_response_count <> 45 or v_mwms_response_count <> 19/);
assert.match(migration, /duplicate test_slug\/question_code responses are not allowed/);
assert.match(migration, /GD_FIXTURE_NOT_EMPTY/);
assert.match(migration, /test\.slug in \('ipip-neo-120-v1', 'safran_v1', 'mwms_v1'\)/);
assert.match(migration, /participant_key\.key not in \('display_name', 'email', 'participant_type', 'addressing_form'\)/);
assert.match(migration, /response_key\.key not in \([\s\S]*'test_slug'[\s\S]*'answer_value'/);
assert.match(migration, /'participantCreated', v_participant_created/);
assert.match(migration, /'scoringExecution', false/);
assert.match(migration, /'reportGeneration', false/);
assert.match(migration, /revoke all on function public\.create_golden_demo_standard_battery_fixture_v2\(jsonb\) from public/i);
assert.match(migration, /revoke all on function public\.create_golden_demo_standard_battery_fixture_v2\(jsonb\) from anon/i);
assert.match(migration, /revoke all on function public\.create_golden_demo_standard_battery_fixture_v2\(jsonb\) from authenticated/i);
assert.match(migration, /grant execute on function public\.create_golden_demo_standard_battery_fixture_v2\(jsonb\) to service_role/i);
assert.doesNotMatch(migration, /create table|alter table/i);
assert.doesNotMatch(migration, /team_dynamics_assessment_v1/i);

const candidate = getGoldenDemoCandidateContract(foundation, "GD-002");
const payload = buildGoldenDemoFixtureRpcPayload(foundation, "GD-002");
assert.equal(candidate.email, "natasa.rapaic@partnerplus.ba");
assert.equal(payload.candidate_id, "GD-002");
assert.equal(payload.responses.length, 184);
assert.deepEqual(
  Object.fromEntries(
    GOLDEN_DEMO_TEST_SLUGS.map((slug) => [
      slug,
      payload.responses.filter((response) => response.test_slug === slug).length,
    ]),
  ),
  { "ipip-neo-120-v1": 120, safran_v1: 45, mwms_v1: 19 },
);
assert.equal(
  payload.responses.every(
    (response) => !Object.hasOwn(response, "candidate_id") && !Object.hasOwn(response, "expected_score"),
  ),
  true,
);
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
assert.throws(
  () => parseGd001WriterCli(["--candidate", "GD-019"]),
  /Only GD-001, GD-002, GD-003, GD-004, GD-005/,
);
assert.throws(() => parseGd001WriterCli(["--apply"]), /explicit --candidate/);

const gd003Candidate = getGoldenDemoCandidateContract(foundation, "GD-003");
const gd003Payload = buildGoldenDemoFixtureRpcPayload(foundation, "GD-003");
assert.deepEqual(gd003Candidate, {
  candidateId: "GD-003",
  fullName: "Vladimir Lučić",
  email: "vladimir.lucic@partnerplus.ba",
  participantType: "employee",
  addressingForm: "masculine",
  teamId: "GDT-01",
});
assert.equal(gd003Payload.candidate_id, "GD-003");
assert.equal(gd003Payload.responses.length, 184);

const attemptIds = Object.fromEntries(
  GOLDEN_DEMO_TEST_SLUGS.map((slug) => [slug, `attempt:${slug}`]),
);
const emptyPlan = {
  mode: "dry-run",
  candidateId: "GD-002",
  organization: { matched: true, id: "organization:partner-plus" },
  state: "EMPTY",
  blockers: [],
  participant: { action: "reuse", id: "participant:gd-002" },
  assignment: { action: "create", id: null },
  attempts: Object.fromEntries(GOLDEN_DEMO_TEST_SLUGS.map((slug) => [slug, "create"])),
  attemptIds: Object.fromEntries(GOLDEN_DEMO_TEST_SLUGS.map((slug) => [slug, null])),
  responses: {
    expected: 184,
    resolved: 184,
    insert: 184,
    existingByTest: { "ipip-neo-120-v1": 0, safran_v1: 0, mwms_v1: 0 },
  },
};
const exactPlan = {
  ...emptyPlan,
  state: "EXACT_MATCH",
  participant: { action: "reuse", id: "participant:gd-002" },
  assignment: { action: "reuse", id: "assignment:gd-002" },
  attemptIds,
  responses: {
    expected: 184,
    resolved: 184,
    insert: 0,
    existingByTest: { "ipip-neo-120-v1": 120, safran_v1: 45, mwms_v1: 19 },
  },
};
const rpcResult = {
  rpcVersion: GOLDEN_DEMO_FIXTURE_RPC,
  stateBefore: "EMPTY",
  stateAfter: "CREATED",
  candidateId: "GD-002",
  participantCreated: false,
  organizationId: "organization:partner-plus",
  participantId: "participant:gd-002",
  assignmentId: "assignment:gd-002",
  attemptIds,
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
assert.equal(validateGoldenDemoFixtureRpcResult(rpcResult, "GD-002").participantCreated, false);
assert.throws(() => validateGoldenDemoFixtureRpcResult(rpcResult, "GD-001"), /expected GD-001/);
assert.throws(
  () => validateGoldenDemoFixtureRpcResult({ ...rpcResult, counts: { ...rpcResult.counts, responses: 183 } }, "GD-002"),
  /responses=183/,
);

(async () => {
  let invokeCount = 0;
  const result = await executeGoldenDemoApplyWithRpcBoundary({
    candidateId: "GD-002",
    initialPlan: emptyPlan,
    payload,
    async invokeRpc({ rpcName, payload: invokedPayload }) {
      invokeCount += 1;
      assert.equal(rpcName, GOLDEN_DEMO_FIXTURE_RPC);
      assert.equal(invokedPayload.candidate_id, "GD-002");
      assert.equal(invokedPayload.responses.length, 184);
      return rpcResult;
    },
    async inspectAfterRpc() {
      return exactPlan;
    },
  });
  assert.equal(invokeCount, 1);
  assert.equal(result.candidateId, "GD-002");
  assert.equal(result.rpc, GOLDEN_DEMO_FIXTURE_RPC);
  assert.equal(result.participantCreated, false);
  assert.equal(result.writesPerformed, true);
  assert.equal(result.scoringExecution, false);
  assert.equal(result.reportGeneration, false);

  const gd003AttemptIds = Object.fromEntries(
    GOLDEN_DEMO_TEST_SLUGS.map((slug) => [slug, `attempt:gd-003:${slug}`]),
  );
  const gd003EmptyPlan = {
    ...emptyPlan,
    candidateId: "GD-003",
    participant: { action: "reuse", id: "participant:gd-003" },
    assignment: { action: "create", id: null },
    attemptIds: Object.fromEntries(GOLDEN_DEMO_TEST_SLUGS.map((slug) => [slug, null])),
  };
  const gd003ExactPlan = {
    ...gd003EmptyPlan,
    state: "EXACT_MATCH",
    assignment: { action: "reuse", id: "assignment:gd-003" },
    attemptIds: gd003AttemptIds,
    responses: {
      expected: 184,
      resolved: 184,
      insert: 0,
      existingByTest: { "ipip-neo-120-v1": 120, safran_v1: 45, mwms_v1: 19 },
    },
  };
  const gd003RpcResult = {
    ...rpcResult,
    candidateId: "GD-003",
    participantId: "participant:gd-003",
    assignmentId: "assignment:gd-003",
    attemptIds: gd003AttemptIds,
  };
  let gd003InvokeCount = 0;
  const gd003Result = await executeGoldenDemoApplyWithRpcBoundary({
    candidateId: "GD-003",
    initialPlan: gd003EmptyPlan,
    payload: gd003Payload,
    async invokeRpc({ rpcName, payload: invokedPayload }) {
      gd003InvokeCount += 1;
      assert.equal(rpcName, GOLDEN_DEMO_FIXTURE_RPC);
      assert.equal(invokedPayload.candidate_id, "GD-003");
      assert.equal(invokedPayload.responses.length, 184);
      return gd003RpcResult;
    },
    async inspectAfterRpc() {
      return gd003ExactPlan;
    },
  });
  assert.equal(gd003InvokeCount, 1);
  assert.equal(gd003Result.candidateId, "GD-003");
  assert.equal(gd003Result.participantCreated, false);
  assert.equal(gd003Result.writesPerformed, true);
  assert.equal(gd003Result.scoringExecution, false);
  assert.equal(gd003Result.reportGeneration, false);

  process.stdout.write("Golden Demo standard-battery RPC contract tests passed (GD-002 regression, GD-003 payload/apply boundary, SQL source, validator, and mocked apply boundary).\n");
})().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
