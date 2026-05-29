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
  "export async function processTeamDynamicsExecutiveOverviewReportAction",
);
const nextActionStart = actionSource.indexOf(
  "export async function saveTeamDynamicsMixedAnswerAction",
);
const manualActionSource =
  actionStart >= 0 && nextActionStart > actionStart
    ? actionSource.slice(actionStart, nextActionStart)
    : actionSource;

assert.match(
  manualActionSource,
  /export async function processTeamDynamicsExecutiveOverviewReportAction/,
);
assert.match(
  manualActionSource,
  /processTeamDynamicsExecutiveOverviewWithOpenAI/,
);
assert.match(manualActionSource, /TEAM_DYNAMICS_REPORT_TYPE/);
assert.match(manualActionSource, /TEAM_DYNAMICS_REPORT_VERSION/);
assert.doesNotMatch(manualActionSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(manualActionSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(manualActionSource, /raw responses read/i);
assert.doesNotMatch(manualActionSource, /scoring rerun/i);
assert.doesNotMatch(manualActionSource, /aggregation rerun|aggregation refresh/i);
assert.doesNotMatch(manualActionSource, /worker|cron|batch processing|report generation from view/i);
assert.doesNotMatch(manualActionSource, /Team Fit/i);
assert.doesNotMatch(manualActionSource, /resetFailedTeamDynamicsReportToQueued/);
assert.doesNotMatch(manualActionSource, /report_snapshot\s*:/);

const tmpDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "team-dynamics-executive-overview-manual-action-"),
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
    throw new Error("processTeamDynamicsExecutiveOverviewWithOpenAI should be injected in this test.");
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
  processTeamDynamicsExecutiveOverviewReportAction,
} = require(actionPath);
const { AuthenticationRequiredError } = require(authStubPath);

function buildReportContext(overrides = {}) {
  return {
    id: "report-1",
    organizationId: "org-1",
    teamId: "team-1",
    reportType: "team_dynamics_report_v1",
    reportVersion: "team_dynamics_executive_overview_v1",
    reportStatus: "queued",
    ...overrides,
  };
}

function buildProcessorSuccess() {
  return {
    ok: true,
    operation: "completed_ready",
    claim: {
      ok: true,
      operation: "claimed",
      report: {
        id: "report-1",
      },
      snapshot: {
        ok: true,
        snapshot: {
          inputType: "team_dynamics_report_input_v1",
        },
      },
    },
    provider: {
      ok: true,
      code: "success",
      snapshot: {
        reportType: "team_dynamics_executive_overview_v1",
      },
    },
    report: {
      id: "report-1",
      teamId: "team-1",
    },
    snapshot: {
      reportType: "team_dynamics_executive_overview_v1",
    },
    finalStatus: "ready",
  };
}

function buildProcessorFailure(overrides = {}) {
  return {
    ok: false,
    operation: "provider_failed",
    claim: {
      ok: true,
      operation: "claimed",
      report: {
        id: "report-1",
      },
      snapshot: {
        ok: true,
        snapshot: {
          inputType: "team_dynamics_report_input_v1",
        },
      },
    },
    provider: {
      ok: false,
      code: "parse_failure",
      reason: "Could not parse model JSON.",
    },
    final: {
      ok: true,
      operation: "marked_failed",
      report: {
        id: "report-1",
        reportStatus: "failed",
      },
      failure: {
        errorMessage:
          "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PARSE_FAILURE | parse_failure | Could not parse model JSON.",
      },
    },
    marker: "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PARSE_FAILURE",
    reason: "Could not parse model JSON.",
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const processCalls = [];
  const revalidateCalls = [];

  const deps = {
    requireUser: async () => ({ id: "user-1" }),
    getActiveOrganization: async () => ({ id: "org-1" }),
    loadReportContext: async () => buildReportContext(),
    processExecutiveOverviewReport: async (input) => {
      processCalls.push(input);
      return buildProcessorSuccess();
    },
    revalidate: (value) => {
      revalidateCalls.push(value);
    },
    ...overrides,
  };

  return {
    deps,
    processCalls,
    revalidateCalls,
  };
}

async function main() {
  {
    const harness = createHarness();
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, true);
    assert.equal(result.status, "ready");
    assert.equal(result.reportId, "report-1");
    assert.deepEqual(harness.processCalls, [
      {
        teamAssessmentReportId: "report-1",
        organizationId: "org-1",
      },
    ]);
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/teams/team-1",
      "/dashboard/teams/team-1/reports/new",
      "/dashboard/teams/team-1/reports/report-1",
    ]);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          reportStatus: "ready",
        }),
    });
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "not_queued");
    assert.equal(harness.processCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          reportStatus: "failed",
        }),
    });
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "not_queued");
    assert.equal(harness.processCalls.length, 0);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          reportVersion: "wrong_version",
        }),
    });
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report_kind");
    assert.equal(harness.processCalls.length, 0);
  }

  {
    const harness = createHarness({
      getActiveOrganization: async () => ({ id: "org-2" }),
    });
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.equal(harness.processCalls.length, 0);
  }

  {
    const harness = createHarness({
      processExecutiveOverviewReport: async (input) => {
        harness.processCalls.push(input);
        return buildProcessorFailure();
      },
    });
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "failed");
    assert.equal(
      result.marker,
      "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_PARSE_FAILURE",
    );
    assert.equal(result.providerCode, "parse_failure");
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/teams/team-1",
      "/dashboard/teams/team-1/reports/new",
    ]);
  }

  {
    const harness = createHarness({
      processExecutiveOverviewReport: async (input) => {
        harness.processCalls.push(input);
        return buildProcessorFailure({
          operation: "snapshot_invalid",
          provider: {
            ok: true,
            code: "success",
            snapshot: {
              reportType: "team_dynamics_executive_overview_v1",
            },
          },
          marker: "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE",
          reason: "Schema mismatch.",
        });
      },
    });
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "failed");
    assert.equal(
      result.marker,
      "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_OPENAI_VALIDATION_FAILURE",
    );
  }

  {
    const harness = createHarness({
      processExecutiveOverviewReport: async (input) => {
        harness.processCalls.push(input);
        return {
          ok: false,
          operation: "claim_not_acquired",
          claim: {
            ok: false,
            operation: "already_processing",
            reason: "Already processing.",
          },
          marker: "TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_INPUT_SNAPSHOT_MISSING",
          reason: "Already processing.",
        };
      },
    });
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
      {
        teamAssessmentReportId: "report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "not_queued");
  }

  {
    const harness = createHarness({
      requireUser: async () => {
        throw new AuthenticationRequiredError();
      },
    });
    const result = await processTeamDynamicsExecutiveOverviewReportAction(
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
          "queued report through manual action delegates to provider-backed processor and returns ready",
          "non-queued report is rejected without processor execution",
          "wrong report_version is rejected as unsupported report kind",
          "wrong organization boundary is rejected",
          "failed report is not reset automatically",
          "provider and validation failures are surfaced as controlled failed results",
          "claim_not_acquired is surfaced as not_queued",
          "manual action does not write attempt_reports or existing assessment_reports",
          "manual action does not read raw responses or rerun scoring or aggregation",
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
