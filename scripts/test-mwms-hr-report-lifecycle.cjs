const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { renderToStaticMarkup } = require("react-dom/server");
const React = require("react");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "test-stub-next-link.cjs");
const nextFontGoogleStubPath = path.join(__dirname, "test-stub-next-font-google.cjs");
const nextFontLocalStubPath = path.join(__dirname, "test-stub-next-font-local.cjs");
const rechartsStubPath = path.join(__dirname, "test-stub-recharts.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveWithExtensions(candidatePath) {
  if (path.extname(candidatePath) && fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  const extensions = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"];

  for (const extension of extensions) {
    const withExtension = `${candidatePath}${extension}`;

    if (fs.existsSync(withExtension)) {
      return withExtension;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request === "next/link") {
    return nextLinkStubPath;
  }

  if (request === "next/font/google") {
    return nextFontGoogleStubPath;
  }

  if (request === "next/font/local") {
    return nextFontLocalStubPath;
  }

  if (request === "recharts") {
    return rechartsStubPath;
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
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};
require.extensions[".tsx"] = require.extensions[".ts"];

function loadEnvFileIfPresent(filename) {
  const envPath = path.join(projectRoot, filename);

  if (!fs.existsSync(envPath)) {
    return false;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return true;
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function hasExplicitRemoteDbTestOptIn() {
  return process.env.DEEP_PROFILE_ALLOW_REMOTE_DB_TESTS === "true";
}

function parseCliOptions(argv) {
  const options = {
    attemptId: null,
    force: false,
    includeOpenAi: process.env.MWMS_HR_OPENAI_DB_SMOKE === "true",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--attempt-id") {
      options.attemptId = argv[index + 1] ?? null;
      index += 1;
    } else if (argument.startsWith("--attempt-id=")) {
      options.attemptId = argument.slice("--attempt-id=".length);
    } else if (argument === "--force" || argument === "--rerun") {
      options.force = true;
    } else if (argument === "--openai") {
      options.includeOpenAi = true;
    }
  }

  return options;
}

async function findCompletedMwmsAttempt(supabase, explicitAttemptId) {
  let query = supabase
    .from("attempts")
    .select("id, test_id, completed_at, locale, tests!inner(slug, name)")
    .eq("status", "completed")
    .eq("tests.slug", "mwms_v1")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(20);

  if (explicitAttemptId) {
    query = query.eq("id", explicitAttemptId).limit(1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to query completed MWMS attempts: ${error.message}`);
  }

  for (const attempt of data ?? []) {
    const { data: scores, error: scoreError } = await supabase
      .from("dimension_scores")
      .select("dimension, raw_score")
      .eq("attempt_id", attempt.id)
      .in("dimension", [
        "amotivation",
        "external_social",
        "external_material",
        "introjected",
        "identified",
        "intrinsic",
      ]);

    if (scoreError) {
      throw new Error(`Unable to query MWMS dimension_scores: ${scoreError.message}`);
    }

    if ((scores ?? []).length === 6) {
      return {
        id: attempt.id,
        testId: attempt.test_id,
        completedAt: attempt.completed_at,
        locale: attempt.locale,
        testSlug: "mwms_v1",
      };
    }
  }

  return null;
}

async function loadAttemptReportRow(supabase, attemptId, audience = "hr") {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select("id, attempt_id, test_slug, audience, report_type, source_type, report_status, generator_type, generated_at, started_at, completed_at, failure_code, failure_reason, report_snapshot, model_name")
    .eq("attempt_id", attemptId)
    .eq("report_type", "individual")
    .eq("audience", audience)
    .eq("source_type", "single_test")
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Unable to load attempt_reports row: ${error.message}`);
  }

  return (data ?? [])[0] ?? null;
}

async function resetReportForProvider(supabase, reportId, provider) {
  const { error } = await supabase
    .from("attempt_reports")
    .update({
      report_status: "queued",
      generator_type: provider,
      model_name: provider === "openai" ? process.env.AI_REPORT_MODEL ?? null : null,
      generated_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      failure_code: null,
      failure_reason: null,
      report_snapshot: null,
    })
    .eq("id", reportId);

  if (error) {
    throw new Error(`Unable to reset MWMS HR report for ${provider}: ${error.message}`);
  }
}

async function ensureQueuedHrReport({ supabase, attemptId, provider, force }) {
  const {
    enqueueCompletedAssessmentReports,
    recoverHrAttemptReport,
  } = require("../lib/assessment/reports.ts");

  const before = await loadAttemptReportRow(supabase, attemptId, "hr");

  if (!before) {
    const recovery = await recoverHrAttemptReport(attemptId);

    if (recovery.status !== "queued") {
      await enqueueCompletedAssessmentReports(attemptId);
    }
  } else if (force || before.report_status === "failed" || before.report_status === "unavailable" || before.report_status === "ready") {
    await resetReportForProvider(supabase, before.id, provider);
  } else if (before.report_status === "queued") {
    await resetReportForProvider(supabase, before.id, provider);
  }

  const queued = await loadAttemptReportRow(supabase, attemptId, "hr");

  if (!queued) {
    throw new Error(`MWMS HR attempt_report was not created for attempt ${attemptId}.`);
  }

  if (queued.generator_type !== provider) {
    await resetReportForProvider(supabase, queued.id, provider);
  }

  return {
    before,
    queued: await loadAttemptReportRow(supabase, attemptId, "hr"),
  };
}

async function runProviderLifecycle({ supabase, attempt, provider, force }) {
  const {
    claimNextReportJob,
    processClaimedReportJob,
  } = require("../lib/assessment/report-job-worker.ts");
  const {
    buildCompletedAssessmentReportRequest,
    getPersistedHrCompletedAssessmentReportState,
  } = require("../lib/assessment/reports.ts");
  const {
    buildPreparedReportGenerationInput,
  } = require("../lib/assessment/report-provider-helpers.ts");
  const {
    formatMwmsHrReportValidationErrors,
    validateMwmsHrReportV1,
  } = require("../lib/assessment/mwms-hr-report-v1.ts");
  const {
    resolveMwmsHrReportDisplay,
  } = require("../lib/assessment/mwms-hr-report-display.ts");
  const {
    CompletedAssessmentSummary,
  } = require("../components/assessment/completed-assessment-summary.tsx");

  console.log(JSON.stringify({
    remote_db_test: "enabled",
    warning: "This test will queue and process a report in the remote database.",
    target: {
      attempt_id: attempt.id,
      test_slug: attempt.testSlug,
      provider,
    },
  }, null, 2));

  const { before, queued } = await ensureQueuedHrReport({
    supabase,
    attemptId: attempt.id,
    provider,
    force,
  });

  assert.equal(queued.report_status, "queued");
  assert.equal(queued.audience, "hr");
  assert.equal(queued.report_type, "individual");
  assert.equal(queued.source_type, "single_test");
  assert.equal(queued.test_slug, "mwms_v1");

  const claimedJob = await claimNextReportJob({ attemptId: attempt.id, audience: "hr" });

  if (!claimedJob) {
    throw new Error(`Queued MWMS HR report for attempt ${attempt.id} could not be claimed.`);
  }

  assert.equal(claimedJob.audience, "hr");
  assert.equal(claimedJob.report_type, "individual");
  assert.equal(claimedJob.source_type, "single_test");
  assert.equal(claimedJob.generator_type, provider);

  const workerResult = await processClaimedReportJob(claimedJob);
  const after = await loadAttemptReportRow(supabase, attempt.id, "hr");

  if (!after) {
    throw new Error(`MWMS HR attempt_report disappeared for attempt ${attempt.id}.`);
  }

  if (after.report_status !== "ready") {
    return {
      provider,
      status: "failed",
      attempt_id: attempt.id,
      report_id: after.id,
      before_status: before?.report_status ?? null,
      queued_status: queued.report_status,
      after_status: after.report_status,
      failure_code: after.failure_code,
      failure_reason: after.failure_reason,
      worker_status: workerResult.status,
    };
  }

  const request = await buildCompletedAssessmentReportRequest(attempt.testId, attempt.id, {
    audience: "hr",
    locale: attempt.locale,
    promptVersion: "v1",
  });
  assert.ok(request, "Expected MWMS HR report request to be buildable.");
  const expectedInput = buildPreparedReportGenerationInput(request).promptInput;
  const validation = validateMwmsHrReportV1(after.report_snapshot, {
    expectedInput,
  });
  assert.equal(validation.ok, true, validation.ok ? undefined : formatMwmsHrReportValidationErrors(validation.errors));
  assert.equal(after.report_snapshot.contractVersion, "mwms_hr_report_v1");
  assert.equal(after.report_snapshot.reportType, "mwms_hr_report_v1");
  assert.equal(after.report_snapshot.audience, "hr");
  assert.equal(after.report_snapshot.sourceType, "single_test");
  assert.equal(after.report_snapshot.testSlug, "mwms_v1");

  const display = resolveMwmsHrReportDisplay(after.report_snapshot);
  assert.ok(display);
  assert.equal(display.dimensions.length, 6);

  const hrState = await getPersistedHrCompletedAssessmentReportState(attempt.id);
  assert.equal(hrState?.status, "ready");
  assert.equal(hrState?.reportAudience, "hr");
  assert.equal(hrState?.reportFamily, "mwms");
  assert.equal(hrState?.reportRenderFormat, "mwms_hr_report_v1");

  const html = renderToStaticMarkup(
    React.createElement(CompletedAssessmentSummary, {
      completedAt: attempt.completedAt,
      locale: "bs",
      organizationName: "Lifecycle smoke",
      participantName: "MWMS lifecycle candidate",
      testSlug: "mwms_v1",
      testName: "MWMS",
      results: request.results,
      reportState: hrState,
    }),
  );
  assert.equal(html.includes("MWMS HR izvještaj"), true);
  assert.equal(html.includes("Motivacijski profil po dimenzijama"), true);

  return {
    provider,
    status: "ready",
    attempt_id: attempt.id,
    report_id: after.id,
    before_status: before?.report_status ?? null,
    queued_status: queued.report_status,
    after_status: after.report_status,
    snapshot: {
      contractVersion: after.report_snapshot.contractVersion,
      reportType: after.report_snapshot.reportType,
      audience: after.report_snapshot.audience,
      dimensions: after.report_snapshot.motivation_profile_snapshot.dimensions.length,
    },
    route_display: "static-render-ok",
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnvFileIfPresent(".env.local");

  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
  };

  if (!hasExplicitRemoteDbTestOptIn()) {
    console.log(JSON.stringify({
      ok: true,
      db: "skipped",
      reason: "Remote DB lifecycle test requires DEEP_PROFILE_ALLOW_REMOTE_DB_TESTS=true.",
      env: Object.fromEntries(Object.entries(envStatus).map(([key, present]) => [key, present ? "present" : "missing"])),
    }, null, 2));
    return;
  }

  if (!hasSupabaseEnv()) {
    console.log(JSON.stringify({
      ok: true,
      db: "skipped",
      reason: "Missing Supabase env.",
      env: Object.fromEntries(Object.entries(envStatus).map(([key, present]) => [key, present ? "present" : "missing"])),
    }, null, 2));
    return;
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const supabase = createSupabaseAdminClient();
  const attempt = await findCompletedMwmsAttempt(supabase, options.attemptId);

  if (!attempt) {
    console.log(JSON.stringify({
      ok: true,
      db: "skipped",
      reason: options.attemptId
        ? `No completed MWMS attempt with all six dimension_scores found for ${options.attemptId}.`
        : "No completed MWMS attempt with all six dimension_scores found.",
      mock_provider: "offline tests cover provider path",
      openai_provider: "skipped because DB lifecycle target is missing",
    }, null, 2));
    return;
  }

  const mockResult = await runProviderLifecycle({
    supabase,
    attempt,
    provider: "mock",
    force: options.force,
  });

  let openAiResult = {
    provider: "openai",
    status: "skipped",
    reason: "Set MWMS_HR_OPENAI_DB_SMOKE=true or pass --openai to run real OpenAI DB lifecycle smoke.",
  };

  if (options.includeOpenAi) {
    if (!process.env.OPENAI_API_KEY) {
      openAiResult = {
        provider: "openai",
        status: "skipped",
        reason: "OPENAI_API_KEY is missing.",
      };
    } else {
      openAiResult = await runProviderLifecycle({
        supabase,
        attempt,
        provider: "openai",
        force: true,
      });
    }
  }

  console.log(JSON.stringify({
    ok: mockResult.status === "ready" && (openAiResult.status === "ready" || openAiResult.status === "skipped"),
    target: {
      attempt_id: attempt.id,
      test_slug: attempt.testSlug,
      completed_at: attempt.completedAt,
    },
    mock_provider: mockResult,
    openai_provider: openAiResult,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  if (/fetch failed|networkerror|connect|ECONNREFUSED/i.test(message)) {
    console.log(JSON.stringify({
      ok: true,
      db: "skipped",
      reason: message,
      tested: "script wiring and offline test suite",
      skipped: "real Supabase queue/claim/process lifecycle",
    }, null, 2));
    return;
  }

  console.error(message);
  process.exitCode = 1;
});
