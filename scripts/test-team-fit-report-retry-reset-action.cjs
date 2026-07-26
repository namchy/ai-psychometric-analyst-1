const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const actionPath = path.join(projectRoot, "app", "actions", "team-assessments.ts");
const actionSource = fs.readFileSync(actionPath, "utf8");
const actionStart = actionSource.indexOf("export async function resetTeamFitReportAction");
const actionEnd = actionSource.indexOf("async function processConfiguredTeamFitReportV2");
const resetActionSource =
  actionStart >= 0 && actionEnd > actionStart
    ? actionSource.slice(actionStart, actionEnd)
    : actionSource;

assert.match(resetActionSource, /export async function resetTeamFitReportAction/);
assert.match(resetActionSource, /resetFailedTeamFitReportToQueued/);
assert.match(resetActionSource, /TEAM_FIT_REPORT_V2_TYPE/);
assert.match(resetActionSource, /TEAM_FIT_REPORT_V2_VERSION/);
assert.doesNotMatch(resetActionSource, /processTeamFitReportWithMock|provider|OpenAI/i);
assert.doesNotMatch(resetActionSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(resetActionSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(resetActionSource, /\.from\("team_assessment_reports"\)/);
assert.doesNotMatch(resetActionSource, /report_snapshot\s*:/);
assert.doesNotMatch(resetActionSource, /worker|scheduler|cron|polling/i);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-fit-retry-reset-action-"));
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const authStubPath = path.join(tmpDir, "auth-session.cjs");
const teamFitLifecycleStubPath = path.join(tmpDir, "team-fit-lifecycle.cjs");
const teamFitProcessorStubPath = path.join(tmpDir, "team-fit-processor.cjs");
const nextCacheStubPath = path.join(tmpDir, "next-cache.cjs");
const organizationsStubPath = path.join(tmpDir, "organizations.cjs");
const originalResolveFilename = Module._resolveFilename;

fs.writeFileSync(
  authStubPath,
  `
class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

module.exports = {
  AuthenticationRequiredError,
  requireAuthenticatedUserForAction: async () => ({ id: "user-default" }),
};
`,
);

fs.writeFileSync(
  teamFitLifecycleStubPath,
  `
module.exports = {
  TEAM_FIT_CANDIDATE_SOURCE_TYPE: "composite_deterministic_input_snapshot",
  TEAM_FIT_TEAM_SOURCE_TYPE: "team_dynamics_aggregation_input_snapshot",
  queueTeamFitReportV2Shell: async () => { throw new Error("queue must be injected"); },
  resetFailedTeamFitReportToQueued: async () => {
    throw new Error("resetFailedTeamFitReportToQueued should be injected in this test.");
  },
};
`,
);

fs.writeFileSync(
  teamFitProcessorStubPath,
  `
module.exports = {
  processTeamFitReportWithMock: async () => {
    throw new Error("processTeamFitReportWithMock must not be called during retry/reset.");
  },
};
`,
);

fs.writeFileSync(
  nextCacheStubPath,
  `
module.exports = {
  revalidatePath() {},
};
`,
);

fs.writeFileSync(
  organizationsStubPath,
  `
module.exports = {
  getActiveOrganizationForUser: async () => ({ id: "org-default", name: "Org Default" }),
};
`,
);

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  for (const extension of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/lib/auth/session") {
    return authStubPath;
  }

  if (request === "@/lib/b2b/team-fit-report-lifecycle") {
    return teamFitLifecycleStubPath;
  }

  if (request === "@/lib/b2b/team-fit-report-v2-processor") {
    return teamFitProcessorStubPath;
  }

  if (request === "@/lib/b2b/organizations") {
    return organizationsStubPath;
  }

  if (request === "next/cache") {
    return nextCacheStubPath;
  }

  if (
    request === "server-only" ||
    request === "@/lib/assessment/team-assessments" ||
    request === "@/lib/assessment/team-assessment-execution" ||
    request === "@/lib/assessment/team-assessment-score-persistence" ||
    request === "@/lib/assessment/team-assessment-responses" ||
    request === "@/lib/assessment/locale" ||
    request === "@/lib/assessment/team-dynamics-action-contract" ||
    request === "@/lib/b2b/team-dynamics-report-selection" ||
    request === "@/lib/b2b/team-dynamics-report-selection-inclusion" ||
    request === "@/lib/b2b/team-dynamics-report-lifecycle" ||
    request === "@/lib/assessment/team-dynamics-mixed-answer-persistence" ||
    request === "@/lib/assessment/team-dynamics-mixed-score-persistence" ||
    request === "@/lib/assessment/team-dynamics-mixed-answer-payload-validator" ||
    request === "@/lib/assessment/team-dynamics-mixed-completion-readiness" ||
    request === "@/lib/assessment/team-dynamics-mixed-runtime" ||
    request === "@/lib/assessment/team-dynamics" ||
    request === "@/lib/supabase/admin" ||
    request === "@/lib/b2b/team-fit-report-v2-openai-provider" ||
    request === "@/lib/assessment/report-config"
  ) {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      resolveWithExtensions(path.join(projectRoot, request.slice(2))),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const { resetTeamFitReportAction } = require(actionPath);
const { AuthenticationRequiredError } = require(authStubPath);

function buildReportContext(overrides = {}) {
  return {
    id: "team-fit-report-1",
    organizationId: "org-1",
    teamId: "team-1",
    participantId: "participant-1",
    reportType: "team_fit_report_v2",
    reportVersion: "v2",
    reportStatus: "failed",
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const resetCalls = [];
  const revalidateCalls = [];

  const deps = {
    requireUser: async () => ({ id: "user-1" }),
    getActiveOrganization: async () => ({ id: "org-1" }),
    loadReportContext: async () => buildReportContext(),
    resetTeamFitReport: async (input) => {
      resetCalls.push(input);
      return {
        ok: true,
        status: "queued",
        report: {
          id: input.teamFitReportId,
          teamId: "team-1",
          participantId: "participant-1",
        },
      };
    },
    revalidate: (value) => {
      revalidateCalls.push(value);
    },
    ...overrides,
  };

  return {
    deps,
    resetCalls,
    revalidateCalls,
  };
}

async function main() {
  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportType: "team_fit_report_v1", reportVersion: "v1" }),
    });
    const result = await resetTeamFitReportAction({ teamFitReportId: "team-fit-report-1" }, harness.deps);
    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report_kind");
    assert.match(result.message, /samo za pregled/i);
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness();
    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
        teamId: "team-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: true,
      status: "queued",
      message: "Team Fit izvještaj je vraćen u queued stanje i spreman za novu ručnu pripremu.",
      reportId: "team-fit-report-1",
      teamId: "team-1",
      participantId: "participant-1",
    });
    assert.deepEqual(harness.resetCalls, [
      {
        teamFitReportId: "team-fit-report-1",
        organizationId: "org-1",
      },
    ]);
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/participants/participant-1/reports",
      "/dashboard/teams/team-1/participants/participant-1/team-fit-reports/team-fit-report-1",
    ]);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportStatus: "queued" }),
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "already_queued");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportStatus: "processing" }),
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "processing_not_resettable");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportStatus: "ready" }),
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "ready_not_resettable");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({ reportStatus: "cancelled" }),
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "not_resettable");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({ organizationId: "org-2" }),
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "unauthorized",
      message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
      reportId: null,
      teamId: null,
      participantId: null,
    });
  }

  {
    const harness = createHarness();
    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
        teamId: "team-2",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness();
    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
        participantId: "participant-2",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({ reportType: "other", reportVersion: "v9" }),
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report_kind");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      resetTeamFitReport: async () => ({
        ok: false,
        reason: "report_not_found",
        message: "missing",
      }),
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "unauthorized",
      message: "Team Fit izvještaj nije dostupan u aktivnom HR kontekstu.",
      reportId: null,
      teamId: null,
      participantId: null,
      lifecycleReason: "report_not_found",
    });
  }

  {
    const harness = createHarness({
      resetTeamFitReport: async () => ({
        ok: false,
        reason: "not_resettable",
        message: "race",
        report: {
          id: "team-fit-report-1",
          teamId: "team-1",
          participantId: "participant-1",
        },
      }),
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "not_resettable");
    assert.equal(result.lifecycleReason, "not_resettable");
  }

  {
    const harness = createHarness({
      getActiveOrganization: async () => null,
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      requireUser: async () => {
        throw new AuthenticationRequiredError();
      },
    });

    const result = await resetTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "unauthorized",
      message: "Authentication required.",
      reportId: "team-fit-report-1",
      teamId: null,
      participantId: null,
    });
  }
}

main();
console.log("test-team-fit-report-retry-reset-action: ok");
