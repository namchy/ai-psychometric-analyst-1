const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const actionPath = path.join(projectRoot, "app", "actions", "team-assessments.ts");
const actionSource = fs.readFileSync(actionPath, "utf8");
const actionStart = actionSource.indexOf("export async function processTeamFitReportAction");
const manualActionSource =
  actionStart >= 0 ? actionSource.slice(actionStart) : actionSource;

assert.match(manualActionSource, /export async function processTeamFitReportAction/);
assert.match(manualActionSource, /processConfiguredTeamFitReportV2/);
assert.match(manualActionSource, /TEAM_FIT_REPORT_V2_TYPE/);
assert.match(manualActionSource, /TEAM_FIT_REPORT_V2_VERSION/);
assert.match(actionSource, /processTeamFitReportV2WithProvider/);
assert.doesNotMatch(actionSource, /team-fit-report-processor/);
assert.doesNotMatch(manualActionSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(manualActionSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(manualActionSource, /\.from\("team_assessment_reports"\)/);
assert.doesNotMatch(manualActionSource, /report_snapshot\s*:/);
assert.doesNotMatch(manualActionSource, /worker|scheduler|cron|polling/i);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "team-fit-manual-process-action-"));
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
  resetFailedTeamFitReportToQueued: async () => { throw new Error("reset must be injected"); },
};
`,
);

fs.writeFileSync(
  teamFitProcessorStubPath,
  `
module.exports = {
  processTeamFitReportV2WithProvider: async () => {
    throw new Error("processTeamFitReport should be injected in this test.");
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

const { processTeamFitReportAction } = require(actionPath);
const { AuthenticationRequiredError } = require(authStubPath);

function buildReportContext(overrides = {}) {
  return {
    id: "team-fit-report-1",
    organizationId: "org-1",
    teamId: "team-1",
    participantId: "participant-1",
    reportType: "team_fit_report_v2",
    reportVersion: "v2",
    reportStatus: "queued",
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
    processTeamFitReport: async (input) => {
      processCalls.push(input);
      return {
        ok: true,
        reportId: input.teamFitReportId,
        status: "ready",
      };
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
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportType: "team_fit_report_v1", reportVersion: "v1" }),
    });
    const result = await processTeamFitReportAction({ teamFitReportId: "team-fit-report-1" }, harness.deps);
    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report_kind");
    assert.match(result.message, /samo za pregled/i);
    assert.equal(harness.processCalls.length, 0);
  }

  {
    const harness = createHarness();
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
        teamId: "team-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: true,
      status: "ready",
      message: "Team Fit izvještaj je pripremljen i spreman za pregled.",
      reportId: "team-fit-report-1",
      teamId: "team-1",
      participantId: "participant-1",
    });
    assert.deepEqual(harness.processCalls, [
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
      loadReportContext: async () =>
        buildReportContext({
          reportStatus: "processing",
        }),
    });
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "already_processing");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          reportStatus: "ready",
        }),
    });
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "already_ready");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          reportStatus: "failed",
        }),
    });
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "failed_not_processable");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          reportType: "team_dynamics_report_v1",
        }),
    });
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report_kind");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      getActiveOrganization: async () => ({ id: "org-2" }),
    });
    const result = await processTeamFitReportAction(
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
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness();
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
        teamId: "wrong-team",
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
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness();
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
        participantId: "wrong-participant",
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
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      processTeamFitReport: async () => ({
        ok: false,
        reason: "provider_failed",
        reportId: "team-fit-report-1",
        message: "TEAM_FIT_PROVIDER_VALIDATION_FAILURE",
        marker: "TEAM_FIT_PROVIDER_VALIDATION_FAILURE",
      }),
    });
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "failed",
      message: "Priprema Team Fit izvještaja nije uspjela. Izvještaj je označen kao neuspješan.",
      reportId: "team-fit-report-1",
      teamId: "team-1",
      participantId: "participant-1",
      marker: "TEAM_FIT_PROVIDER_VALIDATION_FAILURE",
      processorReason: "provider_failed",
    });
  }

  {
    const harness = createHarness({
      processTeamFitReport: async () => ({
        ok: false,
        reason: "provider_validation_failed",
        reportId: "team-fit-report-1",
        message: "safe failure",
        marker: "TEAM_FIT_V2_EVIDENCE_VALIDATION_FAILURE",
      }),
    });
    const result = await processTeamFitReportAction({ teamFitReportId: "team-fit-report-1" }, harness.deps);
    assert.equal(result.status, "failed");
    assert.equal(result.processorReason, "provider_validation_failed");
    assert.equal(result.marker, "TEAM_FIT_V2_EVIDENCE_VALIDATION_FAILURE");
  }

  {
    const harness = createHarness({
      processTeamFitReport: async () => ({
        ok: false,
        reason: "not_claimable",
        reportId: "team-fit-report-1",
        message: "not claimable",
      }),
    });
    const result = await processTeamFitReportAction(
      {
        teamFitReportId: "team-fit-report-1",
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
    const result = await processTeamFitReportAction(
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
}

main()
  .then(() => {
    console.log("test-team-fit-manual-process-action: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
