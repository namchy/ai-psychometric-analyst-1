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

assert.match(actionSource, /export async function resetIndividualDevelopmentProfileReportAction/);
assert.match(actionSource, /resetIndividualDevelopmentProfileAssessmentReportToQueued/);
assert.match(
  actionSource,
  /INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE/,
);
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "idp-failed-reset-action-"));
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const authStubPath = path.join(tmpDir, "auth-session.cjs");
const organizationsStubPath = path.join(tmpDir, "organizations.cjs");
const lifecycleStubPath = path.join(tmpDir, "idp-lifecycle.cjs");
const processorStubPath = path.join(tmpDir, "idp-processor.cjs");
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
  lifecycleStubPath,
  `
module.exports = {
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE: "individual_development_profile",
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE: "hr",
  INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE: "assessment",
  resetIndividualDevelopmentProfileAssessmentReportToQueued: async () => {
    throw new Error("resetIndividualDevelopmentProfileAssessmentReportToQueued should be injected in this test.");
  },
};
`,
);

fs.writeFileSync(
  processorStubPath,
  `
module.exports = {
  processIndividualDevelopmentProfileAssessmentReport: async () => {
    throw new Error("processIndividualDevelopmentProfileAssessmentReport must not be called during retry/reset.");
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

  if (request === "@/lib/assessment/individual-development-profile-lifecycle") {
    return lifecycleStubPath;
  }

  if (request === "@/lib/assessment/individual-development-profile-processor") {
    return processorStubPath;
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

const { resetIndividualDevelopmentProfileReportAction } = require(actionPath);
const { AuthenticationRequiredError } = require(authStubPath);

function buildReportContext(overrides = {}) {
  return {
    id: "assessment-report-1",
    organizationId: "org-1",
    participantId: "participant-1",
    reportType: "individual_development_profile",
    audience: "hr",
    sourceType: "assessment",
    reportStatus: "failed",
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const resetCalls = [];
  const revalidateCalls = [];

  const deps = {
    requireUser: async () => ({ id: "user-1" }),
    getActiveOrganization: async () => ({ id: "org-1", name: "Org 1" }),
    loadReportContext: async () => buildReportContext(),
    resetReport: async (input) => {
      resetCalls.push(input);
      return {
        ok: true,
        action: "reset_to_queued",
        report: {
          id: input.assessmentReportId,
          organization_id: "org-1",
          participant_id: "participant-1",
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
    resetCalls,
    revalidateCalls,
  };
}

async function main() {
  {
    const harness = createHarness();
    const result = await resetIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: true,
      status: "queued",
      message: "Individualni razvojni profil je vraćen u queued stanje i spreman za novu ručnu pripremu.",
      reportId: "assessment-report-1",
      participantId: "participant-1",
    });
    assert.deepEqual(harness.resetCalls, [
      {
        assessmentReportId: "assessment-report-1",
        organizationId: "org-1",
        participantId: "participant-1",
        requestedByUserId: "user-1",
      },
    ]);
    assert.deepEqual(harness.revalidateCalls, [
      "/dashboard/participants/participant-1/reports",
      "/dashboard/individual-development-profile-reports/assessment-report-1",
    ]);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          organizationId: "org-2",
        }),
    });
    const result = await resetIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "unauthorized",
      message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
      reportId: null,
      participantId: null,
    });
    assert.deepEqual(harness.resetCalls, []);
    assert.deepEqual(harness.revalidateCalls, []);
  }

  for (const status of ["queued", "processing", "ready", "invalid"]) {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          reportStatus: status,
        }),
    });
    const result = await resetIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    if (status === "queued") {
      assert.deepEqual(result, {
        ok: false,
        status: "already_queued",
        message: "Individualni razvojni profil je već u queued stanju.",
        reportId: "assessment-report-1",
        participantId: "participant-1",
      });
    } else if (status === "processing") {
      assert.deepEqual(result, {
        ok: false,
        status: "processing_not_resettable",
        message:
          "Individualni razvojni profil koji je u obradi nije moguće vratiti u queued stanje.",
        reportId: "assessment-report-1",
        participantId: "participant-1",
      });
    } else if (status === "ready") {
      assert.deepEqual(result, {
        ok: false,
        status: "ready_not_resettable",
        message: "Spreman Individualni razvojni profil nije moguće vratiti u queued stanje.",
        reportId: "assessment-report-1",
        participantId: "participant-1",
      });
    } else {
      assert.deepEqual(result, {
        ok: false,
        status: "not_resettable",
        message: "Samo failed Individualni razvojni profil može biti vraćen u queued stanje.",
        reportId: "assessment-report-1",
        participantId: "participant-1",
      });
    }

    assert.deepEqual(harness.resetCalls, []);
    assert.deepEqual(harness.revalidateCalls, []);
  }

  {
    const harness = createHarness({
      loadReportContext: async () =>
        buildReportContext({
          reportType: "composite",
        }),
    });
    const result = await resetIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "unsupported_report",
      message: "Ovaj zapis nije podržan za Individualni razvojni profil retry/reset.",
      reportId: "assessment-report-1",
      participantId: "participant-1",
    });
  }

  {
    const harness = createHarness({
      loadReportContext: async () => null,
    });
    const result = await resetIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "unauthorized",
      message: "Individualni razvojni profil nije dostupan u aktivnom HR kontekstu.",
      reportId: null,
      participantId: null,
    });
  }

  {
    const harness = createHarness({
      resetReport: async () => ({
        ok: false,
        reason: "report_update_failed",
        details: "update failed",
      }),
    });
    const result = await resetIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "assessment-report-1",
        participantId: "participant-1",
      },
      harness.deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "error",
      message: "Vraćanje Individualnog razvojnog profila u queued stanje nije uspjelo.",
      reportId: "assessment-report-1",
      participantId: "participant-1",
      lifecycleReason: "report_update_failed",
    });
  }

  {
    const result = await resetIndividualDevelopmentProfileReportAction(
      {
        assessmentReportId: "",
        participantId: "participant-1",
      },
      createHarness().deps,
    );

    assert.deepEqual(result, {
      ok: false,
      status: "error",
      message: "Individualni razvojni profil nije moguće vratiti bez identifikatora.",
      reportId: null,
      participantId: null,
      lifecycleReason: "invalid_payload",
    });
  }

  console.log("test-individual-development-profile-failed-reset-action: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
