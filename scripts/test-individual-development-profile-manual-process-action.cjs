const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const actionPath = path.join(
  projectRoot,
  "app",
  "actions",
  "individual-development-profile.ts",
);
const actionSource = fs.readFileSync(actionPath, "utf8");

assert.match(actionSource, /export async function processIndividualDevelopmentProfileReportAction/);
assert.match(actionSource, /export async function queueIndividualDevelopmentProfileReportAction/);
assert.match(actionSource, /processIndividualDevelopmentProfileAssessmentReport/);
assert.match(actionSource, /queueIndividualDevelopmentProfileAssessmentReport/);
assert.match(actionSource, /INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE/);
assert.match(
  actionSource,
  /INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE/,
);
assert.match(
  actionSource,
  /INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE/,
);
assert.doesNotMatch(actionSource, /OpenAI|openai/i);
assert.doesNotMatch(actionSource, /worker|scheduler|cron|polling/i);
assert.doesNotMatch(actionSource, /report_snapshot\s*:/);
assert.doesNotMatch(actionSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(actionSource, /\.from\("team_fit_reports"\)/);
assert.doesNotMatch(actionSource, /\.from\("team_assessment_reports"\)/);

const tmpDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "idp-manual-process-action-"),
);
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const authStubPath = path.join(tmpDir, "auth-session.cjs");
const organizationsStubPath = path.join(tmpDir, "organizations.cjs");
const processorStubPath = path.join(tmpDir, "idp-processor.cjs");
const lifecycleStubPath = path.join(tmpDir, "idp-lifecycle.cjs");
const nextCacheStubPath = path.join(tmpDir, "next-cache.cjs");
const supabaseAdminStubPath = path.join(tmpDir, "supabase-admin.cjs");
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
  organizationsStubPath,
  `
module.exports = {
  getActiveOrganizationForUser: async () => ({ id: "org-default", name: "Org Default" }),
};
`,
);

fs.writeFileSync(
  processorStubPath,
  `
module.exports = {
  processIndividualDevelopmentProfileAssessmentReport: async () => {
    throw new Error("processIndividualDevelopmentProfileAssessmentReport should be injected in this test.");
  },
};
`,
);

fs.writeFileSync(
  lifecycleStubPath,
  `
module.exports = {
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE: "individual_development_profile",
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE: "hr",
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE: "assessment",
  queueIndividualDevelopmentProfileAssessmentReport: async () => {
    throw new Error("queueIndividualDevelopmentProfileAssessmentReport should be injected in this test.");
  },
  resetIndividualDevelopmentProfileAssessmentReportToQueued: async () => {
    throw new Error("resetIndividualDevelopmentProfileAssessmentReportToQueued should be injected in this test.");
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
  supabaseAdminStubPath,
  `
module.exports = {
  createSupabaseAdminClient: () => ({
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: null, error: null }),
      };
    },
  }),
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

  if (request === "@/lib/b2b/organizations") {
    return organizationsStubPath;
  }

  if (request === "@/lib/assessment/individual-development-profile-processor") {
    return processorStubPath;
  }

  if (request === "@/lib/assessment/individual-development-profile-lifecycle") {
    return lifecycleStubPath;
  }

  if (request === "next/cache") {
    return nextCacheStubPath;
  }

  if (request === "@/lib/supabase/admin") {
    return supabaseAdminStubPath;
  }

  if (request === "server-only") {
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
  processIndividualDevelopmentProfileReportAction,
  queueIndividualDevelopmentProfileReportAction,
} = require(actionPath);
const { AuthenticationRequiredError } = require(authStubPath);

function buildReportContext(overrides = {}) {
  return {
    id: "assessment-report-1",
    organizationId: "org-1",
    participantId: "participant-1",
    reportType: "individual_development_profile",
    audience: "hr",
    sourceType: "assessment",
    reportStatus: "queued",
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const processCalls = [];
  const queueCalls = [];
  const revalidateCalls = [];

  const deps = {
    requireUser: async () => ({ id: "user-1" }),
    getActiveOrganization: async () => ({ id: "org-1", name: "Org 1" }),
    loadReportContext: async () => buildReportContext(),
    processReport: async (input) => {
      processCalls.push(input);
      return {
        ok: true,
        reportId: input.assessmentReportId,
        status: "ready",
      };
    },
    queueReport: async (input) => {
      queueCalls.push(input);
      return {
        ok: true,
        action: "queued",
        assignment: {
          id: input.assessmentAssignmentId,
          organization_id: input.organizationId,
          participant_id: input.participantId ?? "participant-1",
          assignment_type: "standard_battery",
          status: "completed",
        },
        report: {
          id: "idp-queued",
          assessment_assignment_id: input.assessmentAssignmentId,
          organization_id: input.organizationId,
          participant_id: input.participantId ?? "participant-1",
          report_type: "individual_development_profile",
          audience: "hr",
          source_type: "assessment",
          report_status: "queued",
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
    processCalls,
    queueCalls,
    revalidateCalls,
  };
}

async function main() {
  {
    const harness = createHarness();
    const result = await queueIndividualDevelopmentProfileReportAction(
      {
        assessmentAssignmentId: "assignment-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: true,
      status: "queued",
      message: "Individualni razvojni profil je dodat u red za pripremu.",
      reportId: "idp-queued",
      participantId: "participant-1",
    });
    assert.deepEqual(harness.queueCalls, [
      {
        assessmentAssignmentId: "assignment-1",
        organizationId: "org-1",
        participantId: "participant-1",
        requestedByUserId: "user-1",
      },
    ]);
    assert.deepEqual(harness.processCalls, []);
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/participants/participant-1/reports",
    ]);
  }

  {
    const harness = createHarness({
      queueReport: async (input) => {
        harness.queueCalls.push(input);
        return {
          ok: true,
          action: "noop_queued",
          assignment: {
            id: input.assessmentAssignmentId,
            organization_id: input.organizationId,
            participant_id: "participant-1",
            assignment_type: "standard_battery",
            status: "completed",
          },
          report: {
            id: "idp-existing",
            assessment_assignment_id: input.assessmentAssignmentId,
            organization_id: input.organizationId,
            participant_id: "participant-1",
            report_type: "individual_development_profile",
            audience: "hr",
            source_type: "assessment",
            report_status: "queued",
          },
        };
      },
    });
    const result = await queueIndividualDevelopmentProfileReportAction(
      {
        assessmentAssignmentId: "assignment-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, true);
    assert.equal(result.status, "already_queued");
    assert.equal(result.reportId, "idp-existing");
    assert.deepEqual(harness.queueCalls, [
      {
        assessmentAssignmentId: "assignment-1",
        organizationId: "org-1",
        participantId: "participant-1",
        requestedByUserId: "user-1",
      },
    ]);
    assert.deepEqual(harness.processCalls, []);
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/participants/participant-1/reports",
      "/dashboard/individual-development-profile-reports/idp-existing",
    ]);
  }

  {
    const harness = createHarness({
      queueReport: async () => ({
        ok: false,
        reason: "assignment_not_found",
        details: "Assignment not found.",
      }),
    });
    const result = await queueIndividualDevelopmentProfileReportAction(
      {
        assessmentAssignmentId: "assignment-missing",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.equal(result.reportId, null);
    assert.equal(result.lifecycleReason, "assignment_not_found");
    assert.deepEqual(harness.processCalls, []);
    assert.deepEqual(harness.revalidateCalls, []);
  }

  {
    const harness = createHarness({
      getActiveOrganization: async () => null,
    });
    const result = await queueIndividualDevelopmentProfileReportAction(
      {
        assessmentAssignmentId: "assignment-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.deepEqual(harness.queueCalls, []);
    assert.deepEqual(harness.revalidateCalls, []);
  }

  {
    const harness = createHarness();
    const result = await queueIndividualDevelopmentProfileReportAction(
      {
        assessmentAssignmentId: "",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "error");
    assert.equal(result.lifecycleReason, "invalid_payload");
    assert.deepEqual(harness.queueCalls, []);
  }

  {
    const harness = createHarness();
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: true,
      status: "processed",
      message: "Individualni razvojni profil je pripremljen i spreman za pregled.",
      reportId: "assessment-report-1",
      participantId: "participant-1",
    });
    assert.deepEqual(harness.processCalls, [
      {
        assessmentReportId: "assessment-report-1",
        organizationId: "org-1",
        participantId: "participant-1",
      },
    ]);
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/participants/participant-1/reports",
      "/dashboard/individual-development-profile-reports/assessment-report-1",
    ]);
  }

  {
    const harness = createHarness({
      getActiveOrganization: async () => null,
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ organizationId: "org-2" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
    assert.equal(result.reportId, null);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ participantId: "participant-2" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportStatus: "processing" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "already_processing");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportStatus: "ready" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "already_ready");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportStatus: "failed" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "failed_not_processable");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportStatus: "invalid" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "invalid_not_processable");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ reportType: "composite" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report");
    assert.deepEqual(harness.processCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ audience: "candidate" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report");
  }

  {
    const harness = createHarness({
      loadReportContext: async () => buildReportContext({ sourceType: "attempt" }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unsupported_report");
  }

  {
    const harness = createHarness({
      processReport: async () => ({
        ok: false,
        reason: "already_processing",
        message: "already processing",
      }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "already_processing");
  }

  {
    const harness = createHarness({
      processReport: async () => ({
        ok: false,
        reason: "validation_failed",
        message: "validation failed",
      }),
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "failed");
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/participants/participant-1/reports",
      "/dashboard/individual-development-profile-reports/assessment-report-1",
    ]);
  }

  {
    const harness = createHarness({
      requireUser: async () => {
        throw new AuthenticationRequiredError();
      },
    });
    const result = await processIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, "unauthorized");
  }
}

main();
