const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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

const { buildGoldenDemoFoundationContract, classifyGoldenDemoFoundation } = require(
  "../lib/golden-demo/golden-demo-foundation-contract.ts",
);
const {
  buildGoldenDemoFoundationWritePlan,
  executeGoldenDemoFoundationApply,
  GOLDEN_DEMO_FOUNDATION_CONFIRMATION,
  GOLDEN_DEMO_FOUNDATION_RPC,
} = require("../lib/golden-demo/golden-demo-foundation-writer.ts");
const { parseCli } = require("./write-golden-demo-foundation-db.cjs");

const contract = buildGoldenDemoFoundationContract(projectRoot);
const rpcMigration = fs.readFileSync(
  path.join(projectRoot, "supabase/migrations/20260717123000_create_golden_demo_foundation_rpc.sql"),
  "utf8",
);
const organization = {
  id: "org-partner-plus",
  name: contract.organization.name,
  slug: "partner-plus",
  status: "active",
};

function participant(candidate, index) {
  return {
    id: `participant-${candidate.candidateId}`,
    organizationId: organization.id,
    email: candidate.email,
    fullName: candidate.fullName,
    participantType: candidate.participantType,
    status: candidate.status,
    index,
  };
}

function team(expected) {
  return {
    id: `team-${expected.teamCode}`,
    organizationId: organization.id,
    name: expected.name,
    archivedAt: null,
  };
}

function exactObserved() {
  const participants = contract.participants.map(participant);
  const teams = contract.teams.map(team);
  return {
    organizations: [organization],
    participants,
    teams,
    memberships: contract.memberships.map((expected, index) => ({
      id: `membership-${index + 1}`,
      teamId: `team-${expected.teamCode}`,
      participantId: `participant-${expected.candidateId}`,
      role: expected.role,
      isActive: expected.isActive,
      leftAt: expected.leftAt,
    })),
  };
}

function partialObserved() {
  const observed = exactObserved();
  observed.participants = observed.participants.filter((row) => row.email !== "natasa.rapaic@partnerplus.ba");
  observed.memberships = observed.memberships.filter((row) => row.participantId !== "participant-GD-002");
  return observed;
}

function expectBlocked(plan, code) {
  assert.equal(plan.rpcAllowed, false);
  assert.equal(plan.reasonCode, "WRITE_BLOCKED");
  assert.match(plan.reason, new RegExp(code));
}

async function main() {
  assert.match(rpcMigration, /create or replace function public\.create_golden_demo_foundation_v1\(\)/);
  assert.match(rpcMigration, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(rpcMigration, /GD_FOUNDATION_POSTCONDITION_FAILED/);
  assert.doesNotMatch(rpcMigration, /public\.(attempts|responses|response_selections|dimension_scores|attempt_reports|team_fit_reports)\b/);
  assert.doesNotMatch(rpcMigration, /on conflict/i);

  const empty = { organizations: [organization], participants: [], teams: [], memberships: [] };
  const emptyInspection = classifyGoldenDemoFoundation(contract, empty);
  assert.equal(emptyInspection.state, "EMPTY");
  const emptyPlan = buildGoldenDemoFoundationWritePlan({
    contract,
    observed: empty,
    inspection: emptyInspection,
  });
  assert.equal(emptyPlan.rpcAllowed, true);
  assert.deepEqual(emptyPlan.counts, {
    participantsToCreate: 24,
    teamsToCreate: 4,
    membershipsToCreate: 24,
  });

  const partial = partialObserved();
  const partialInspection = classifyGoldenDemoFoundation(contract, partial);
  assert.equal(partialInspection.state, "PARTIAL");
  assert.deepEqual(
    partialInspection.blockingFindings.map((finding) => finding.code),
    ["participant_missing"],
  );
  const partialPlan = buildGoldenDemoFoundationWritePlan({
    contract,
    observed: partial,
    inspection: partialInspection,
  });
  assert.equal(partialPlan.rpcAllowed, true);
  assert.equal(partialPlan.reasonCode, "PARTIAL_MISSING_ONLY");
  assert.deepEqual(partialPlan.counts, {
    participantsToCreate: 1,
    teamsToCreate: 0,
    membershipsToCreate: 1,
  });
  assert.equal(partialPlan.participantsToCreate[0].candidateId, "GD-002");
  assert.equal(partialPlan.membershipsToCreate[0].candidateId, "GD-002");

  const conflict = exactObserved();
  conflict.participants[0].fullName = "Different identity";
  const conflictInspection = classifyGoldenDemoFoundation(contract, conflict);
  const conflictPlan = buildGoldenDemoFoundationWritePlan({
    contract,
    observed: conflict,
    inspection: conflictInspection,
  });
  expectBlocked(conflictPlan, "participant_name_mismatch");
  let conflictRpcCalls = 0;
  const conflictExecution = await executeGoldenDemoFoundationApply({
    plan: conflictPlan,
    rpcClient: {
      async rpc() {
        conflictRpcCalls += 1;
        return { data: null, error: null };
      },
    },
    inspectAfterWrite: async () => conflictInspection,
  });
  assert.equal(conflictExecution.rpcCalled, false);
  assert.equal(conflictRpcCalls, 0);

  let rpcCalls = 0;
  let postInspectionCalls = 0;
  await assert.rejects(
    executeGoldenDemoFoundationApply({
      plan: partialPlan,
      rpcClient: {
        async rpc(functionName, args) {
          rpcCalls += 1;
          assert.equal(functionName, GOLDEN_DEMO_FOUNDATION_RPC);
          assert.deepEqual(args, {});
          throw new Error("simulated atomic failure");
        },
      },
      inspectAfterWrite: async () => {
        postInspectionCalls += 1;
        return partialInspection;
      },
    }),
    /simulated atomic failure/,
  );
  assert.equal(rpcCalls, 1);
  assert.equal(postInspectionCalls, 0);

  const exact = exactObserved();
  const exactInspection = classifyGoldenDemoFoundation(contract, exact);
  const exactPlan = buildGoldenDemoFoundationWritePlan({
    contract,
    observed: exact,
    inspection: exactInspection,
  });
  assert.equal(exactPlan.rpcAllowed, false);
  assert.equal(exactPlan.reasonCode, "EXACT_MATCH_NOOP");
  let noOpRpcCalls = 0;
  let noOpInspectionCalls = 0;
  const noOp = await executeGoldenDemoFoundationApply({
    plan: exactPlan,
    rpcClient: {
      async rpc() {
        noOpRpcCalls += 1;
        return { data: null, error: null };
      },
    },
    inspectAfterWrite: async () => {
      noOpInspectionCalls += 1;
      return exactInspection;
    },
  });
  assert.equal(noOp.rpcCalled, false);
  assert.equal(noOpRpcCalls, 0);
  assert.equal(noOpInspectionCalls, 0);

  let simulatedState = partialInspection;
  let simulatedRpcCalls = 0;
  const applied = await executeGoldenDemoFoundationApply({
    plan: partialPlan,
    rpcClient: {
      async rpc() {
        simulatedRpcCalls += 1;
        simulatedState = exactInspection;
        return { data: { stateAfter: "EXACT_MATCH" }, error: null };
      },
    },
    inspectAfterWrite: async () => simulatedState,
  });
  assert.equal(applied.rpcCalled, true);
  assert.equal(applied.postconditionState, "EXACT_MATCH");
  assert.equal(simulatedRpcCalls, 1);
  const secondRunPlan = buildGoldenDemoFoundationWritePlan({
    contract,
    observed: exact,
    inspection: exactInspection,
  });
  assert.equal(secondRunPlan.reasonCode, "EXACT_MATCH_NOOP");

  assert.throws(() => parseCli(["--apply"]), /requires --confirm/);
  assert.throws(
    () => parseCli(["--apply", "--confirm", "WRONG"]),
    /Invalid confirmation/,
  );
  assert.throws(() => parseCli(["--write"]), /not supported/);
  assert.deepEqual(parseCli(["--apply", "--confirm", GOLDEN_DEMO_FOUNDATION_CONFIRMATION]), {
    json: false,
    verbose: false,
    apply: true,
    confirmation: GOLDEN_DEMO_FOUNDATION_CONFIRMATION,
  });

  process.stdout.write("Golden Demo foundation writer tests passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
