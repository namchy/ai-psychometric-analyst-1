const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
require.extensions[".ts"] = (module, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(out.outputText, filename);
};

const {
  loadGdt01DbContract,
  buildOfflineObservedRuntime,
  classifyGdt01DbState,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");
const {
  GDT_01_TEAM_DYNAMICS_WRITER_RPC,
  GDT_01_TEAM_DYNAMICS_MANIFEST_VERSION,
  buildGdt01SeedPayload,
  buildGdt01WriterPlan,
  executeGdt01WriterApply,
  validateGdt01InspectionResult,
  validateGdt01SeedRpcResult,
} = require("../lib/golden-demo/team-dynamics-gdt-01-writer.ts");

const contract = loadGdt01DbContract(root);
const org = { id: "org", name: contract.organizationName, slug: "partner-plus", status: "active" };
const team = { id: "team", organizationId: "org", name: contract.teamName, archivedAt: null };

function observed() {
  const participants = contract.members.map((member, index) => ({
    id: `p${index}`,
    organizationId: "org",
    email: member.email,
    fullName: member.displayName,
    participantType: "employee",
    status: "active",
  }));
  return {
    organizations: [org],
    teams: [team],
    participants,
    memberships: participants.map((participant, index) => ({
      id: `m${index}`,
      teamId: "team",
      participantId: participant.id,
      isActive: true,
      leftAt: null,
    })),
    runtime: buildOfflineObservedRuntime(contract.runtimeSnapshot),
    assignments: [],
    wrappers: [],
    attempts: [],
    responses: [],
    selections: [],
    dimensionScoreIds: [],
    memberScoreIds: [],
    aggregationIds: [],
    reportSelectionDraftIds: [],
    reportSelectionMemberIds: [],
    teamReportIds: [],
    attemptReportIds: [],
    teamFitReports: [],
    ambientAssignments: [],
  };
}

function inspection(state, writerEligible) {
  const base = classifyGdt01DbState(contract, observed());
  return {
    ...base,
    state,
    writerEligible,
    counts: state === "EXACT_MATCH"
      ? { ...base.counts, wrappersObserved: 6, attemptsObserved: 6, responsesObserved: 288, physicalSjtSelectionsObserved: 72, logicalSelectionsObserved: 324 }
      : base.counts,
    blockingFindings: state === "EMPTY" || state === "EXACT_MATCH" ? [] : [{ code: state.toLowerCase(), message: state }],
  };
}

function validResult() {
  return {
    stateBefore: "EMPTY",
    stateAfter: "EXACT_MATCH",
    assignmentId: "123e4567-e89b-42d3-a456-426614174000",
    assignmentCount: 1,
    wrapperCount: 6,
    attemptCount: 6,
    responseCount: 288,
    physicalSelectionCount: 72,
    logicalSelectionCount: 324,
    manifestVersion: GDT_01_TEAM_DYNAMICS_MANIFEST_VERSION,
    runtimeContractChecksum: "375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d",
    teamCode: "GDT-01",
    testSlug: "team_dynamics_assessment_v1",
  };
}

(async () => {
  const payload = buildGdt01SeedPayload(contract);
  assert.equal(payload.members.length, 6);
  assert.equal(payload.members.reduce((total, member) => total + member.responses.length, 0), 288);
  assert.equal(payload.runtime_contract_checksum, "375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d");
  assert.equal(Object.hasOwn(payload, "fixture_checksum"), false);
  assert.equal(validateGdt01SeedRpcResult(validResult()).assignmentId, validResult().assignmentId);

  for (const invalid of [null, undefined, [], "result", 1, {}]) {
    assert.throws(() => validateGdt01SeedRpcResult(invalid), /invalid result object|contract mismatch|assignmentId/);
  }
  for (const field of Object.keys(validResult())) {
    const result = validResult();
    delete result[field];
    assert.throws(() => validateGdt01SeedRpcResult(result), new RegExp(field === "assignmentId" ? "assignmentId" : field));
  }
  for (const [field, invalidValue] of [
    ["stateBefore", "PARTIAL"],
    ["stateAfter", "EMPTY"],
    ["assignmentId", "not-a-uuid"],
    ["assignmentCount", 2],
    ["wrapperCount", 5],
    ["attemptCount", 7],
    ["responseCount", 287],
    ["physicalSelectionCount", 71],
    ["logicalSelectionCount", 323],
    ["manifestVersion", "wrong"],
    ["runtimeContractChecksum", "wrong"],
    ["teamCode", "GDT-02"],
    ["testSlug", "team_dynamics_v1_strong"],
  ]) {
    const result = validResult();
    result[field] = invalidValue;
    assert.throws(() => validateGdt01SeedRpcResult(result));
  }
  for (const field of ["assignmentCount", "wrapperCount", "attemptCount", "responseCount", "physicalSelectionCount", "logicalSelectionCount"]) {
    const result = validResult();
    result[field] = "1";
    assert.throws(() => validateGdt01SeedRpcResult(result));
    result[field] = -1;
    assert.throws(() => validateGdt01SeedRpcResult(result));
    result[field] = 1.5;
    assert.throws(() => validateGdt01SeedRpcResult(result));
  }
  assert.throws(() => validateGdt01SeedRpcResult({ created: { assignments: 1, responses: 288, responseSelections: 72 } }));

  const state = observed();
  const validEmptyInspection = inspection("EMPTY", true);
  assert.equal(validateGdt01InspectionResult(validEmptyInspection).state, "EMPTY");
  const empty = buildGdt01WriterPlan({ contract, observed: state, inspection: validEmptyInspection });
  let calls = 0;
  const client = {
    async rpc(name, args) {
      calls += 1;
      assert.equal(name, GDT_01_TEAM_DYNAMICS_WRITER_RPC);
      assert.deepEqual(args.p_payload, payload);
      return { data: validResult(), error: null };
    },
  };
  for (const forgedInspection of [
    { state: "EMPTY", writerEligible: true },
    { state: "EMPTY", rpcAllowed: true },
    { ...validEmptyInspection, target: { ...validEmptyInspection.target, teamId: "GDT-02" } },
    { ...validEmptyInspection, target: { ...validEmptyInspection.target, packageSlug: "team_dynamics_v1_strong" } },
    { ...validEmptyInspection, target: { ...validEmptyInspection.target, runtimeChecksum: "wrong" } },
    { ...validEmptyInspection, counts: { ...validEmptyInspection.counts, membersExpected: 5 } },
    { ...validEmptyInspection, target: undefined },
    { ...validEmptyInspection, counts: { ...validEmptyInspection.counts, responsesObserved: 1 } },
    { ...validEmptyInspection, blockingFindings: [{ code: "forged", message: "forged" }] },
    { ...validEmptyInspection, noOpEligible: true },
    { ...inspection("EXACT_MATCH", false), counts: { ...inspection("EXACT_MATCH", false).counts, responsesObserved: 287 } },
    { ...inspection("PARTIAL", false), rpcAllowed: true },
    { ...inspection("CONFLICT", false), rpcAllowed: true },
    { ...validEmptyInspection, state: "UNKNOWN" },
  ]) {
    await assert.rejects(
      executeGdt01WriterApply({ explicitApply: true, contract, inspection: forgedInspection, rpcClient: client }),
    /GDT-01 writer received|GDT-01 inspector contract|semantically inconsistent|unknown inspector state/,
    );
    assert.equal(calls, 0);
  }
  for (const forgedPlan of [empty, { ...empty }, JSON.parse(JSON.stringify(empty)), { ...empty, stateBefore: "EMPTY", rpcAllowed: true }]) {
    await assert.rejects(
      executeGdt01WriterApply({ explicitApply: true, plan: forgedPlan, rpcClient: client }),
      /Cannot read properties|canonical fixture\/runtime contract|invalid inspector result/,
    );
    assert.equal(calls, 0);
  }
  const readOnly = await executeGdt01WriterApply({ explicitApply: false, contract, inspection: validEmptyInspection, rpcClient: client });
  assert.equal(readOnly.outcome, "read_only_plan");
  assert.equal(calls, 0);

  const applied = await executeGdt01WriterApply({ explicitApply: true, contract, inspection: validEmptyInspection, rpcClient: client });
  assert.equal(applied.outcome, "applied");
  assert.deepEqual(applied.rpcResult, validResult());
  assert.equal(calls, 1);

  for (const stateName of ["EXACT_MATCH", "PARTIAL", "CONFLICT"]) {
    const plan = buildGdt01WriterPlan({
      contract,
      observed: state,
      inspection: inspection(stateName, false),
    });
    const outcome = await executeGdt01WriterApply({
      explicitApply: true,
      contract,
      inspection: inspection(stateName, false),
      rpcClient: { async rpc() { calls += 1; throw new Error("must not call"); } },
    });
    assert.equal(outcome.rpcCalled, false);
    assert.equal(outcome.outcome, stateName === "EXACT_MATCH" ? "exact_match_noop" : "blocked");
  }
  assert.equal(calls, 1);

  for (const stateName of ["UNKNOWN", "", null]) {
    assert.throws(() => buildGdt01WriterPlan({
      contract,
      observed: state,
      inspection: { ...inspection("CONFLICT", false), state: stateName, blockingFindings: [] },
    }), /unknown inspector state/);
    assert.equal(calls, 1);
  }
  await assert.rejects(
    executeGdt01WriterApply({
      explicitApply: true,
      contract,
      inspection: { state: "EMPTY", writerEligible: true },
      rpcClient: client,
    }),
    /invalid inspector result/,
  );
  assert.equal(calls, 1);

  await assert.rejects(
    executeGdt01WriterApply({
      explicitApply: true,
      contract,
      inspection: validEmptyInspection,
      rpcClient: { async rpc() { return { data: null, error: null }; } },
    }),
    /invalid result object/,
  );
  await assert.rejects(
    executeGdt01WriterApply({
      explicitApply: true,
      contract,
      inspection: validEmptyInspection,
      rpcClient: { async rpc() { return { data: { stateAfter: "EXACT_MATCH" }, error: null }; } },
    }),
    /contract mismatch/,
  );
  await assert.rejects(
    executeGdt01WriterApply({
      explicitApply: true,
      contract,
      inspection: validEmptyInspection,
      rpcClient: { async rpc() { return { data: null, error: { message: "rollback" } }; } },
    }),
    /rollback/,
  );
  await assert.rejects(
    executeGdt01WriterApply({
      explicitApply: true,
      contract,
      inspection: validEmptyInspection,
      rpcClient: { async rpc() { throw new Error("transport failure"); } },
    }),
    /transport failure/,
  );

  assert.throws(() => buildGdt01WriterPlan({
    contract: { ...contract, fixtureValidationErrors: ["fixture mismatch"] },
    observed: state,
    inspection: inspection("EMPTY", true),
  }), /blocked/);
  assert.throws(() => buildGdt01WriterPlan({
    contract: { ...contract, runtimeValidationErrors: ["runtime mismatch"] },
    observed: state,
    inspection: inspection("EMPTY", true),
  }), /blocked/);
  assert.equal(calls, 1);

  const writerSource = fs.readFileSync(path.join(root, "lib/golden-demo/team-dynamics-gdt-01-writer.ts"), "utf8");
  assert.doesNotMatch(writerSource, /fetch\s*\(|createClient|process\.env/);
  console.log("GDT-01 Team Dynamics writer offline tests: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
