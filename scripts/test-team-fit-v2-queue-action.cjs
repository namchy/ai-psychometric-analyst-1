const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const actionPath = path.join(root, "app", "actions", "team-assessments.ts");
const emptyPath = path.join(__dirname, "empty-module.cjs");
const source = fs.readFileSync(actionPath, "utf8");
const start = source.indexOf("export async function queueTeamFitReportV2Action");
const queueSource = source.slice(start);

assert.match(queueSource, /queueTeamFitReportV2Shell/);
assert.match(queueSource, /TEAM_FIT_CANDIDATE_SOURCE_TYPE/);
assert.match(queueSource, /TEAM_FIT_TEAM_SOURCE_TYPE/);
assert.doesNotMatch(queueSource, /queueTeamFitReportShell\s*\(/);
assert.doesNotMatch(queueSource, /OpenAI|fetch\(|processTeamFitReport/);

class AuthenticationRequiredError extends Error {}
const emptyExports = {
  AuthenticationRequiredError,
  requireAuthenticatedUserForAction: async () => ({ id: "default-user" }),
  getActiveOrganizationForUser: async () => ({ id: "default-org" }),
  revalidatePath() {},
  TEAM_FIT_CANDIDATE_SOURCE_TYPE: "composite_deterministic_input_snapshot",
  TEAM_FIT_TEAM_SOURCE_TYPE: "team_dynamics_aggregation_input_snapshot",
  queueTeamFitReportV2Shell: async () => { throw new Error("queue dependency must be injected"); },
  TEAM_FIT_REPORT_V2_TYPE: "team_fit_report_v2",
  TEAM_FIT_REPORT_V2_VERSION: "v2",
};
require.cache[emptyPath] = { id: emptyPath, filename: emptyPath, loaded: true, exports: emptyExports };

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "next/cache" || request === "server-only" || request.startsWith("@/")) {
    if (request === "@/lib/b2b/team-fit-report-identity") {
      return originalResolve.call(this, path.join(root, "lib/b2b/team-fit-report-identity.ts"), parent, isMain, options);
    }
    return emptyPath;
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = function (module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { queueTeamFitReportV2Action } = require(actionPath);

function harness(overrides = {}) {
  const queueCalls = [];
  const revalidateCalls = [];
  return {
    queueCalls,
    revalidateCalls,
    deps: {
      requireUser: async () => ({ id: "user-1" }),
      getActiveOrganization: async () => ({ id: "org-1" }),
      queueReportShell: async (input) => {
        queueCalls.push(input);
        return { ok: true, reportId: "v2-report-1", status: "queued", report: { id: "v2-report-1" } };
      },
      revalidate: (value) => revalidateCalls.push(value),
      ...overrides,
    },
  };
}

const validInput = { teamId: "team-1", participantId: "participant-1", candidateSourceId: "candidate-source-1", teamSourceId: "team-source-1" };

async function main() {
  const success = harness();
  const result = await queueTeamFitReportV2Action(validInput, success.deps);
  assert.deepEqual(result, { ok: true, status: "queued", message: "Team Fit V2 izvještaj je stavljen u red za pripremu.", reportId: "v2-report-1", teamId: "team-1", participantId: "participant-1" });
  assert.equal(success.queueCalls.length, 1);
  assert.deepEqual(success.queueCalls[0], {
    organizationId: "org-1", teamId: "team-1", participantId: "participant-1",
    candidateSourceType: "composite_deterministic_input_snapshot", candidateSourceId: "candidate-source-1",
    teamSourceType: "team_dynamics_aggregation_input_snapshot", teamSourceId: "team-source-1",
    optionalContext: undefined, createdBy: "user-1",
  });
  assert.deepEqual(success.revalidateCalls, ["/dashboard/participants/participant-1/reports"]);

  const invalid = harness();
  assert.equal((await queueTeamFitReportV2Action({ ...validInput, candidateSourceId: "" }, invalid.deps)).status, "invalid_payload");
  assert.equal(invalid.queueCalls.length, 0);

  const noOrg = harness({ getActiveOrganization: async () => null });
  assert.equal((await queueTeamFitReportV2Action(validInput, noOrg.deps)).status, "unauthorized");
  assert.equal(noOrg.queueCalls.length, 0);

  const ownership = harness({ queueReportShell: async () => ({ ok: false, reason: "team_organization_mismatch", message: "mismatch" }) });
  assert.equal((await queueTeamFitReportV2Action(validInput, ownership.deps)).status, "unauthorized");

  const auth = harness({ requireUser: async () => { throw new AuthenticationRequiredError(); } });
  assert.equal((await queueTeamFitReportV2Action(validInput, auth.deps)).status, "unauthorized");
  console.log("test-team-fit-v2-queue-action: ok");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
