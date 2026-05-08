const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { setTimeout: delay } = require("node:timers/promises");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
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

  for (const extension of extensions) {
    const asIndex = path.join(candidatePath, `index${extension}`);

    if (fs.existsSync(asIndex)) {
      return asIndex;
    }
  }

  return candidatePath;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyModulePath;
  }

  if (request.startsWith("@/")) {
    const resolvedPath = resolveWithExtensions(path.join(projectRoot, request.slice(2)));
    return originalResolveFilename.call(this, resolvedPath, parent, isMain, options);
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

function parseCliOptions(argv) {
  const options = {
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--attempt-id") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("Missing value for --attempt-id.");
      }

      options.attemptId = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--attempt-id=")) {
      options.attemptId = argument.slice("--attempt-id=".length);
      continue;
    }

    if (argument === "--force" || argument === "--rerun") {
      options.force = true;
    }
  }

  return options;
}

function loadEnvFileIfPresent(filename) {
  const envPath = path.join(projectRoot, filename);

  if (!fs.existsSync(envPath)) {
    return false;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
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

function hasLifecycleEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function buildSafranRequest(overrides = {}) {
  return {
    attemptId: "attempt-safran-hr-lifecycle-helper",
    testId: "test-safran",
    testSlug: "safran_v1",
    audience: "hr",
    locale: "bs",
    scoringMethod: "correct_answers",
    promptVersion: "v1",
    testName: "SAFRAN",
    results: {
      attemptId: "attempt-safran-hr-lifecycle-helper",
      scoringMethod: "correct_answers",
      dimensions: [
        { dimension: "verbal_score", rawScore: 12, scoredQuestionCount: 18 },
        { dimension: "figural_score", rawScore: 8, scoredQuestionCount: 18 },
        { dimension: "numerical_series_score", rawScore: 5, scoredQuestionCount: 18 },
        { dimension: "cognitive_composite_v1", rawScore: 25, scoredQuestionCount: 54 },
      ],
      scoredResponseCount: 45,
      unscoredResponses: [],
      derived: {
        safranV1: {
          verbalScore: 12,
          figuralScore: 8,
          numericalRawScore: 2.5,
          numericalAdjustedScore: 5,
          numericalScore: 5,
          numericalSeriesScore: 5,
          cognitiveCompositeScore: 25,
          cognitiveCompositeV1: 25,
        },
      },
    },
    ...overrides,
  };
}

function assertNoForbiddenHrLanguage(snapshot) {
  const payload = [
    snapshot.executiveSummary?.title,
    snapshot.executiveSummary?.summary,
    snapshot.cognitiveSignals?.overall,
    snapshot.cognitiveSignals?.verbal,
    snapshot.cognitiveSignals?.figural,
    snapshot.cognitiveSignals?.numeric,
    ...(Array.isArray(snapshot.pointsOfCaution)
      ? snapshot.pointsOfCaution.flatMap((item) => [
          item.signal,
          item.whyItMatters,
          item.howToCheck,
        ])
      : []),
    ...(Array.isArray(snapshot.interviewQuestions)
      ? snapshot.interviewQuestions.flatMap((item) => [
          item.category,
          item.question,
          item.whatToListenFor,
        ])
      : []),
    ...(Array.isArray(snapshot.onboardingGuidance?.first30Days)
      ? snapshot.onboardingGuidance.first30Days
      : []),
    ...(Array.isArray(snapshot.onboardingGuidance?.days60)
      ? snapshot.onboardingGuidance.days60
      : []),
    ...(Array.isArray(snapshot.onboardingGuidance?.days90)
      ? snapshot.onboardingGuidance.days90
      : []),
    ...(Array.isArray(snapshot.interpretationLimits) ? snapshot.interpretationLimits : []),
  ]
    .filter((value) => typeof value === "string")
    .join(" ");

  assert.equal(
    /iq|kvocijent inteligencije|inteligentan|neinteligentan|nadaren|slab kandidat|iznadprosječan|ispodprosječan|percentile|percentil|norma|normativno poređenje|preporučuje se zapošljavanje|ne preporučuje se zapošljavanje|hiring score|idealni kandidat|loš fit|red flag|rizičan kandidat|hire|no-hire/i.test(
      payload,
    ),
    false,
  );
}

async function runHelperLifecycleChecks() {
  const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");
  const {
    buildPreparedReportGenerationInput,
  } = require("../lib/assessment/report-provider-helpers.ts");
  const {
    validateRuntimeCompletedAssessmentReport,
  } = require("../lib/assessment/report-providers.ts");
  const {
    validateSafranHrReport,
  } = require("../lib/assessment/safran-hr-report-v1.ts");

  const request = buildSafranRequest();
  const preparedInput = buildPreparedReportGenerationInput(request, {
    promptVersionId: null,
    promptTemplate: null,
  });

  assert.equal(preparedInput.promptInput.test.audience, "hr");
  assert.equal(preparedInput.promptInput.test.sourceType, "single_test");
  assert.equal(preparedInput.promptInput.test.reportType, "individual");

  const result = await mockReportProvider.generateReport(preparedInput);
  assert.equal(result.ok, true, result.ok ? undefined : result.reason);

  if (!result.ok) {
    throw new Error("Expected SAFRAN HR helper lifecycle mock generation to succeed.");
  }

  const hrValidation = validateSafranHrReport(result.report, {
    expectedInput: preparedInput.promptInput,
  });
  assert.equal(hrValidation.ok, true, hrValidation.ok ? undefined : hrValidation.errors.join(" | "));

  const runtimeValidation = validateRuntimeCompletedAssessmentReport(result.report, {
    testSlug: "safran_v1",
    audience: "hr",
  });
  assert.equal(
    runtimeValidation.ok,
    true,
    runtimeValidation.ok ? undefined : runtimeValidation.reason,
  );

  assert.equal(result.report.audience, "hr");
  assert.equal(result.report.sourceType, "single_test");
  assert.equal(result.report.testSlug, "safran_v1");
  assertNoForbiddenHrLanguage(result.report);

  return {
    preparedInput,
    report: result.report,
  };
}

async function findCompletedSafranAttempt(supabase, preferredAttemptId) {
  if (preferredAttemptId) {
    const { data, error } = await supabase
      .from("attempts")
      .select("id, status, completed_at, test_id, tests(slug)")
      .eq("id", preferredAttemptId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load attempt ${preferredAttemptId}: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Attempt ${preferredAttemptId} was not found.`);
    }

    const testSlug = Array.isArray(data.tests) ? data.tests[0]?.slug : data.tests?.slug;

    if (testSlug !== "safran_v1" || data.status !== "completed" || !data.completed_at) {
      throw new Error(
        `Attempt ${preferredAttemptId} is not a completed SAFRAN attempt.`,
      );
    }

    return {
      id: data.id,
      testId: data.test_id,
      completedAt: data.completed_at,
      testSlug,
    };
  }

  const { data, error } = await supabase
    .from("attempts")
    .select("id, status, completed_at, test_id, tests!inner(slug)")
    .eq("status", "completed")
    .eq("tests.slug", "safran_v1")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to find completed SAFRAN attempt: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const testSlug = Array.isArray(data.tests) ? data.tests[0]?.slug : data.tests?.slug;

  return {
    id: data.id,
    testId: data.test_id,
    completedAt: data.completed_at,
    testSlug,
  };
}

async function loadAttemptReportRow(supabase, attemptId, audience) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, audience, report_type, source_type, generator_type, report_status, generated_at, started_at, completed_at, failure_code, failure_reason, report_snapshot",
    )
    .eq("attempt_id", attemptId)
    .eq("audience", audience)
    .eq("report_type", "individual")
    .eq("source_type", "single_test")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load ${audience} attempt_report for ${attemptId}: ${error.message}`);
  }

  return data ?? null;
}

async function resetAttemptReportRow(supabase, reportId) {
  const { error } = await supabase
    .from("attempt_reports")
    .update({
      report_status: "queued",
      failure_code: null,
      failure_reason: null,
      report_snapshot: null,
      started_at: null,
      completed_at: null,
      generated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    throw new Error(`Unable to reset attempt_report ${reportId}: ${error.message}`);
  }
}

async function runDbLifecycleChecks(options) {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const {
    enqueueCompletedAssessmentReports,
    getPersistedHrCompletedAssessmentReportState,
    getPersistedParticipantCompletedAssessmentReportState,
  } = require("../lib/assessment/reports.ts");
  const {
    claimNextReportJob,
    processClaimedReportJob,
  } = require("../lib/assessment/report-job-worker.ts");
  const {
    validateSafranHrReport,
  } = require("../lib/assessment/safran-hr-report-v1.ts");

  const supabase = createSupabaseAdminClient();
  const attempt = await findCompletedSafranAttempt(supabase, options.attemptId);

  if (!attempt) {
    return {
      skipped: true,
      reason:
        "No completed SAFRAN attempt was found in the local database. Provide --attempt-id or complete one SAFRAN attempt first.",
    };
  }

  const participantBefore = await loadAttemptReportRow(supabase, attempt.id, "participant");
  const hrBefore = await loadAttemptReportRow(supabase, attempt.id, "hr");

  console.info("SAFRAN HR lifecycle target selected", {
    attemptId: attempt.id,
    testSlug: attempt.testSlug,
    completedAt: attempt.completedAt,
    participantStatus: participantBefore?.report_status ?? null,
    hrStatus: hrBefore?.report_status ?? null,
  });

  if (!participantBefore || !hrBefore) {
    await enqueueCompletedAssessmentReports(attempt.id);
  } else if (options.force) {
    await resetAttemptReportRow(supabase, hrBefore.id);
  } else if (
    hrBefore.report_status === "failed" ||
    hrBefore.report_status === "unavailable"
  ) {
    await resetAttemptReportRow(supabase, hrBefore.id);
  } else if (hrBefore.report_status === "ready") {
    throw new Error(
      `HR attempt_report already exists for ${attempt.id} with status ready (id=${hrBefore.id}). Use --force to rerun only that HR attempt_reports row.`,
    );
  }

  const participantQueued = await loadAttemptReportRow(supabase, attempt.id, "participant");
  const hrQueued = await loadAttemptReportRow(supabase, attempt.id, "hr");

  if (!hrQueued) {
    throw new Error(`HR attempt_report was not created for attempt ${attempt.id}.`);
  }

  const participantStartedBefore = participantQueued?.started_at ?? null;
  const participantStatusBefore = participantQueued?.report_status ?? null;

  const claimedJob =
    hrQueued.report_status === "queued"
      ? await claimNextReportJob({ attemptId: attempt.id, audience: "hr" })
      : null;

  if (hrQueued.report_status === "queued" && !claimedJob) {
    throw new Error(`Queued HR report for attempt ${attempt.id} could not be claimed.`);
  }

  if (claimedJob) {
    assert.equal(claimedJob.audience, "hr");
    assert.equal(claimedJob.attempt_id, attempt.id);
    assert.equal(claimedJob.report_type, "individual");
    assert.equal(claimedJob.source_type, "single_test");

    await processClaimedReportJob(claimedJob);
  }

  let hrAfter = null;

  for (let attemptIndex = 0; attemptIndex < 10; attemptIndex += 1) {
    hrAfter = await loadAttemptReportRow(supabase, attempt.id, "hr");

    if (!hrAfter) {
      break;
    }

    if (hrAfter.report_status !== "processing") {
      break;
    }

    await delay(500);
  }

  if (!hrAfter) {
    throw new Error(`HR attempt_report disappeared for attempt ${attempt.id}.`);
  }

  assert.equal(hrAfter.report_status, "ready");
  assert.equal(hrAfter.audience, "hr");
  assert.equal(hrAfter.report_type, "individual");
  assert.equal(hrAfter.source_type, "single_test");
  assert.equal(hrAfter.test_slug, "safran_v1");
  assert.ok(hrAfter.report_snapshot);

  const hrSnapshotValidation = validateSafranHrReport(hrAfter.report_snapshot);
  assert.equal(
    hrSnapshotValidation.ok,
    true,
    hrSnapshotValidation.ok ? undefined : hrSnapshotValidation.errors.join(" | "),
  );
  assertNoForbiddenHrLanguage(hrSnapshotValidation.ok ? hrSnapshotValidation.value : hrAfter.report_snapshot);

  const hrState = await getPersistedHrCompletedAssessmentReportState(attempt.id);
  assert.equal(hrState?.status, "ready");
  assert.equal(hrState?.reportAudience, "hr");
  assert.equal(hrState?.reportFamily, "safran");
  assert.equal(hrState?.reportRenderFormat, "safran_hr_report_v1");

  const participantState = await getPersistedParticipantCompletedAssessmentReportState(attempt.id);

  if (participantState?.status === "ready") {
    assert.equal(participantState.reportAudience, "participant");
    assert.notEqual(participantState.reportRenderFormat, "safran_hr_report_v1");
  }

  const participantAfter = await loadAttemptReportRow(supabase, attempt.id, "participant");

  if (
    participantStatusBefore === "queued" &&
    participantStartedBefore === null &&
    participantAfter?.report_status === "processing" &&
    participantAfter.started_at
  ) {
    throw new Error(`Participant report for attempt ${attempt.id} was claimed during HR-only verification.`);
  }

  console.info("SAFRAN HR lifecycle DB verification passed", {
    attemptId: attempt.id,
    hrStatus: hrAfter.report_status,
    hrReportId: hrAfter.id,
    participantStatus: participantAfter?.report_status ?? null,
    participantReadyAudience:
      participantState?.status === "ready" ? participantState.reportAudience : null,
  });

  return {
    skipped: false,
    attemptId: attempt.id,
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnvFileIfPresent(".env.local");

  const helperResult = await runHelperLifecycleChecks();

  console.info("SAFRAN HR lifecycle helper checks passed", {
    audience: helperResult.report.audience,
    sourceType: helperResult.report.sourceType,
    testSlug: helperResult.report.testSlug,
  });

  if (!hasLifecycleEnv()) {
    console.info("SAFRAN HR lifecycle DB smoke skipped", {
      reason:
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Re-run with env loaded, for example `node --env-file=.env.local scripts/test-safran-hr-report-lifecycle.cjs`.",
      tested: "helper/mock lifecycle, contract validation, forbidden-language guardrails",
      skipped: "real attempt_reports queue/claim/process/retrieval verification",
    });
    return;
  }

  try {
    const dbResult = await runDbLifecycleChecks(options);

    if (dbResult.skipped) {
      console.info("SAFRAN HR lifecycle DB smoke skipped", {
        reason: dbResult.reason,
        tested: "helper/mock lifecycle, contract validation, forbidden-language guardrails",
        skipped: "real attempt_reports queue/claim/process/retrieval verification",
      });
      return;
    }
  } catch (error) {
    if (error instanceof Error && /fetch failed|networkerror|connect|Unable to find completed SAFRAN attempt/i.test(error.message)) {
      console.info("SAFRAN HR lifecycle DB smoke skipped", {
        reason: error.message,
        tested: "helper/mock lifecycle, contract validation, forbidden-language guardrails",
        skipped: "real attempt_reports queue/claim/process/retrieval verification",
      });
      return;
    }

    throw error;
  }

  console.log("SAFRAN HR report lifecycle tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
