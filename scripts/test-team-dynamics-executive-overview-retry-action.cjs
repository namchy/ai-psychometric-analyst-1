const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const actionPath = path.join(projectRoot, "app", "actions", "team-assessments.ts");
const actionSource = fs.readFileSync(actionPath, "utf8");
const actionStart = actionSource.indexOf(
  "export async function resetTeamDynamicsExecutiveOverviewReportAction",
);
const nextActionStart = actionSource.indexOf(
  "export async function saveTeamDynamicsMixedAnswerAction",
);
const retryActionSource =
  actionStart >= 0 && nextActionStart > actionStart
    ? actionSource.slice(actionStart, nextActionStart)
    : actionSource;

assert.match(
  retryActionSource,
  /export async function resetTeamDynamicsExecutiveOverviewReportAction/,
);
assert.match(retryActionSource, /resetFailedTeamDynamicsReportToQueued/);
assert.doesNotMatch(
  retryActionSource,
  /generateTeamDynamicsExecutiveOverviewWithOpenAI|processTeamDynamicsExecutiveOverviewWithOpenAI/,
);
assert.doesNotMatch(retryActionSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(retryActionSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(retryActionSource, /raw responses read/i);
assert.doesNotMatch(retryActionSource, /scoring rerun/i);
assert.doesNotMatch(retryActionSource, /aggregation rerun|aggregation refresh/i);
assert.doesNotMatch(retryActionSource, /worker|cron|batch processing|report generation from view/i);
assert.doesNotMatch(retryActionSource, /Team Fit/i);
assert.doesNotMatch(retryActionSource, /report_snapshot\s*:/);

const tmpDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "team-dynamics-executive-overview-retry-action-"),
);
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const authStubPath = path.join(tmpDir, "auth-session.cjs");
const teamDynamicsStubPath = path.join(tmpDir, "team-dynamics-report-lifecycle.cjs");
const nextCacheStubPath = path.join(tmpDir, "next-cache.cjs");
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
  teamDynamicsStubPath,
  `
module.exports = {
  TEAM_DYNAMICS_REPORT_TYPE: "team_dynamics_report_v1",
  TEAM_DYNAMICS_REPORT_VERSION: "team_dynamics_executive_overview_v1",
  queueTeamDynamicsReportShell: async () => {
    throw new Error("queueTeamDynamicsReportShell should not be called in this test.");
  },
  processTeamDynamicsExecutiveOverviewWithOpenAI: async () => {
    throw new Error("processTeamDynamicsExecutiveOverviewWithOpenAI must not be called in retry action test.");
  },
  resetFailedTeamDynamicsReportToQueued: async () => {
    throw new Error("resetFailedTeamDynamicsReportToQueued should be injected in this test.");
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

  if (request === "@/lib/b2b/team-dynamics-report-lifecycle") {
    return teamDynamicsStubPath;
  }

  if (request === "next/cache") {
    return nextCacheStubPath;
  }

  if (
    request === "server-only" ||
    request === "@/lib/b2b/organizations" ||
    request === "@/lib/assessment/team-assessments" ||
    request === "@/lib/assessment/team-assessment-execution" ||
    request === "@/lib/assessment/team-assessment-score-persistence" ||
    request === "@/lib/assessment/team-assessment-responses" ||
    request === "@/lib/assessment/locale" ||
    request === "@/lib/assessment/team-dynamics-action-contract" ||
    request === "@/lib/b2b/team-dynamics-report-selection" ||
    request === "@/lib/b2b/team-dynamics-report-selection-inclusion" ||
    request === "@/lib/assessment/team-dynamics-mixed-answer-persistence" ||
    request === "@/lib/assessment/team-dynamics-mixed-score-persistence" ||
    request === "@/lib/assessment/team-dynamics-mixed-answer-payload-validator" ||
    request === "@/lib/assessment/team-dynamics-mixed-completion-readiness" ||
    request === "@/lib/assessment/team-dynamics-mixed-runtime" ||
    request === "@/lib/assessment/team-dynamics" ||
    request === "@/lib/supabase/admin"
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

const {
  resetTeamDynamicsExecutiveOverviewReportAction,
} = require(actionPath);
const { AuthenticationRequiredError } = require(authStubPath);

function buildReportContext(overrides = {}) {
  return {
    id: "report-1",
    organizationId: "org-1",
    teamId: "team-1",
    reportType: "team_dynamics_report_v1",
    reportVersion: "team_dynamics_executive_overview_v1",
    reportStatus: "failed",
    ...overrides,
  };
}

function buildResetSuccess() {
  return {
    ok: true,
    operation: "reset_to_queued",
    report: {
      id: "report-1",
      teamId: "team-1",
      reportStatus: "queued",
    },
  };
}

function createHarness(overrides = {}) {
  const resetCalls = [];
  const processCalls = [];
  const revalidateCalls = [];

  const deps = {
    requireUser: async () => ({ id: "user-1" }),
    getActiveOrganization: async () => ({ id: "org-1" }),
    loadReportContext: async () => buildReportContext(),
    resetExecutiveOverviewReport: async (input) => {
      resetCalls.push(input);
      return buildResetSuccess();
    },
    processExecutiveOverviewReport: async (input) => {
      processCalls.push(input);
      throw new Error("processExecutiveOverviewReport must not be used by retry action.");
    },
    revalidate: (value) => {
      revalidateCalls.push(value);
    },
    ...overrides,
  };

  return {
    deps,
    resetCalls,
    processCalls,
    revalidateCalls,
  };
}

async function main() {
  {
    const harness = createHarness();
    const result = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, true);
    assert.equal(result.status, "queued");
    assert.deepEqual(harness.resetCalls, [
      {
        teamAssessmentReportId: "report-1",
        organizationId: "org-1",
      },
    ]);
    assert.equal(harness.processCalls.length, 0);
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/teams/team-1",
      "/dashboard/teams/team-1/reports/new",
    ]);
  }

  for (const reportStatus of ["queued", "processing", "ready"]) {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportStatus }),
    });
    const result = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "not_failed");
    assert.equal(harness.resetCalls.length, 0);
    assert.equal(harness.processCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportVersion: "wrong_version" }),
    });
    const result = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report_kind");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      getActiveOrganization: async () => ({ id: "org-2" }),
    });
    const result = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ teamId: "team-2" }),
    });
    const result = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
        teamId: "team-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.equal(harness.resetCalls.length, 0);
  }

  {
    const harness = createHarness({
      resetExecutiveOverviewReport: async (input) => {
        harness.resetCalls.push(input);
        return {
          ok: false,
          operation: "processing_not_resettable",
          reason: "Processing Team Dynamics report rows are not resettable.",
          report: {
            id: "report-1",
            teamId: "team-1",
          },
        };
      },
    });
    const result = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "not_failed");
    assert.equal(result.lifecycleOperation, "processing_not_resettable");
  }

  {
    const harness = createHarness({
      requireUser: async () => {
        throw new AuthenticationRequiredError();
      },
    });
    const result = await resetTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        verified: [
          "failed report through retry action resets to queued",
          "retry action does not call OpenAI provider",
          "retry action does not call provider-backed processor",
          "queued, processing, and ready reports are rejected as not_failed",
          "wrong report_version is rejected",
          "wrong organization or team boundary is rejected",
          "retry action does not write attempt_reports or existing assessment_reports",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
