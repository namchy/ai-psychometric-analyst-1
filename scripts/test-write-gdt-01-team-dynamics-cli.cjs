const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.NodeJs, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  loadGdt01DbContract,
  buildOfflineObservedRuntime,
  classifyGdt01DbState,
} = require("../lib/golden-demo/team-dynamics-gdt-01-db-contract.ts");
const {
  GDT_01_TEAM_DYNAMICS_MANIFEST_VERSION,
} = require("../lib/golden-demo/team-dynamics-gdt-01-writer.ts");
const {
  parseCli,
  runWriter,
  exitCodeForWriterResult,
} = require("./write-gdt-01-team-dynamics-db.cjs");

assert.deepEqual(parseCli([]), { apply: false, json: false, verbose: false, confirmation: null });
assert.deepEqual(parseCli(["--apply", "--confirm", "GDT_01_TEAM_DYNAMICS"]), { apply: true, json: false, verbose: false, confirmation: "GDT_01_TEAM_DYNAMICS" });
for (const argv of [
  ["--apply"],
  ["--apply", "--confirm", "wrong"],
  ["--apply", "--confirm", ""],
  ["--confirm"],
  ["--confirm", "--json"],
  ["--unknown"],
  ["word"],
  ["--apply", "--apply", "--confirm", "GDT_01_TEAM_DYNAMICS"],
  ["--confirm", "GDT_01_TEAM_DYNAMICS", "--confirm", "GDT_01_TEAM_DYNAMICS", "--apply"],
  ["--json", "--json"],
  ["--verbose", "--verbose"],
  ["--apply", "--confirm", "wrong", "--confirm", "GDT_01_TEAM_DYNAMICS"],
  ["--apply", "--confirm", "GDT_01_TEAM_DYNAMICS", "extra"],
]) {
  assert.throws(() => parseCli(argv));
}

const contract = loadGdt01DbContract(root);
const participants = contract.members.map((member, index) => ({
  id: `p${index}`, organizationId: "org", email: member.email, fullName: member.displayName, participantType: "employee", status: "active",
}));
const observed = {
  organizations: [{ id: "org", name: contract.organizationName, slug: "partner-plus", status: "active" }],
  teams: [{ id: "team", organizationId: "org", name: contract.teamName, archivedAt: null }],
  participants,
  memberships: participants.map((participant, index) => ({ id: `m${index}`, teamId: "team", participantId: participant.id, isActive: true, leftAt: null })),
  runtime: buildOfflineObservedRuntime(contract.runtimeSnapshot),
  assignments: [], wrappers: [], attempts: [], responses: [], selections: [],
  dimensionScoreIds: [], memberScoreIds: [], aggregationIds: [], reportSelectionDraftIds: [], reportSelectionMemberIds: [],
  teamReportIds: [], attemptReportIds: [], teamFitReports: [], ambientAssignments: [],
};
const baseInspection = classifyGdt01DbState(contract, observed);
const output = { text: "", write(value) { this.text += value; } };
let clients = 0;
let inspections = 0;
let rpcCalls = 0;
const validResult = {
  stateBefore: "EMPTY", stateAfter: "EXACT_MATCH", assignmentId: "123e4567-e89b-42d3-a456-426614174000",
  assignmentCount: 1, wrapperCount: 6, attemptCount: 6, responseCount: 288, physicalSelectionCount: 72,
  logicalSelectionCount: 324, manifestVersion: GDT_01_TEAM_DYNAMICS_MANIFEST_VERSION,
  runtimeContractChecksum: "375a97663ed825ff2f8c09f3716d6a39bbea2722d5b45f4a61d60d2be210f48d",
  teamCode: "GDT-01", testSlug: "team_dynamics_assessment_v1",
};
const clientFactory = () => {
  clients += 1;
  return { async rpc() { rpcCalls += 1; return { data: validResult, error: null }; } };
};
const inspectState = async () => { inspections += 1; return observed; };
const classifierFor = (state, writerEligible) => () => ({
  ...baseInspection,
  state,
  writerEligible,
  counts: state === "EXACT_MATCH"
    ? { ...baseInspection.counts, wrappersObserved: 6, attemptsObserved: 6, responsesObserved: 288, physicalSjtSelectionsObserved: 72, logicalSelectionsObserved: 324 }
    : baseInspection.counts,
  blockingFindings: state === "EMPTY" || state === "EXACT_MATCH" ? [] : [{ code: state.toLowerCase(), message: state }],
});

(async () => {
  for (const argv of [["--apply"], ["--unknown"], ["--apply", "--apply", "--confirm", "GDT_01_TEAM_DYNAMICS"]]) {
    const priorClients = clients, priorInspections = inspections, priorRpc = rpcCalls;
    await assert.rejects(runWriter({ argv, clientFactory, inspectState, contractLoader: () => contract, classifier: classifierFor("EMPTY", true), output }));
    assert.equal(clients, priorClients);
    assert.equal(inspections, priorInspections);
    assert.equal(rpcCalls, priorRpc);
  }

  const readOnly = await runWriter({ argv: [], clientFactory, inspectState, contractLoader: () => contract, classifier: classifierFor("EMPTY", true), output });
  assert.equal(readOnly.execution.outcome, "read_only_plan");
  assert.equal(rpcCalls, 0);
  assert.match(output.text, /Runtime contract checksum:/);
  assert.doesNotMatch(output.text, /Fixture checksum:/);

  const applied = await runWriter({ argv: ["--apply", "--confirm", "GDT_01_TEAM_DYNAMICS"], clientFactory, inspectState, contractLoader: () => contract, classifier: classifierFor("EMPTY", true), output });
  assert.equal(applied.execution.outcome, "applied");
  assert.equal(rpcCalls, 1);

  const exact = await runWriter({ argv: ["--apply", "--confirm", "GDT_01_TEAM_DYNAMICS"], clientFactory, inspectState, contractLoader: () => contract, classifier: classifierFor("EXACT_MATCH", false), output });
  assert.equal(exact.execution.outcome, "exact_match_noop");
  assert.equal(rpcCalls, 1);
  assert.equal(exitCodeForWriterResult(exact), 0);

  const blocked = await runWriter({ argv: [], clientFactory, inspectState, contractLoader: () => contract, classifier: classifierFor("CONFLICT", false), output });
  assert.equal(blocked.execution.outcome, "blocked");
  assert.equal(exitCodeForWriterResult(blocked), 1);
  assert.equal(rpcCalls, 1);

  await assert.rejects(
    runWriter({
      argv: ["--apply", "--confirm", "GDT_01_TEAM_DYNAMICS"],
      clientFactory,
      inspectState,
      contractLoader: () => contract,
      classifier: () => ({ ...baseInspection, state: "EMPTY", writerEligible: true, target: { ...baseInspection.target, teamId: "GDT-02" } }),
      output,
    }),
    /noncanonical inspector target/,
  );
  assert.equal(rpcCalls, 1, "forged CLI inspection must not reach RPC");

  await assert.rejects(
    runWriter({
      argv: ["--apply", "--confirm", "GDT_01_TEAM_DYNAMICS"],
      clientFactory: () => ({ async rpc() { return { data: null, error: null }; } }),
      inspectState,
      contractLoader: () => contract,
      classifier: classifierFor("EMPTY", true),
      output,
    }),
    /invalid result object/,
  );
  assert.ok(clients > 0 && inspections > 0, "Injected-only execution path must be exercised.");
  console.log("GDT-01 Team Dynamics CLI offline tests: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
