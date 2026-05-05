const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

function fail(message) {
  throw new Error(message);
}

function parseAttemptId(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--attempt-id") {
      return argv[index + 1] ?? null;
    }

    if (argument.startsWith("--attempt-id=")) {
      return argument.slice("--attempt-id=".length);
    }
  }

  return null;
}

async function loadAttemptContext(supabase, attemptId) {
  const { data, error } = await supabase
    .from("attempts")
    .select("id, status, completed_at, test_id, tests(slug)")
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    fail(`Unable to load attempt ${attemptId}: ${error.message}`);
  }

  if (!data) {
    fail(`Attempt ${attemptId} was not found.`);
  }

  const testSlug = Array.isArray(data.tests) ? data.tests[0]?.slug : data.tests?.slug;

  return {
    id: data.id,
    status: data.status,
    completedAt: data.completed_at,
    testId: data.test_id,
    testSlug,
  };
}

async function loadParticipantReportRow(supabase, attemptId) {
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(
      "id, attempt_id, test_slug, audience, source_type, report_status, generator_type, failure_code, failure_reason, generated_at, started_at, completed_at",
    )
    .eq("attempt_id", attemptId)
    .eq("audience", "participant")
    .eq("source_type", "single_test")
    .maybeSingle();

  if (error) {
    fail(`Unable to load participant attempt_report for ${attemptId}: ${error.message}`);
  }

  return data ?? null;
}

async function resetExistingParticipantReportRow(supabase, reportId) {
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
    fail(`Unable to reset participant attempt_report ${reportId}: ${error.message}`);
  }
}

async function loadDimensionScoresSnapshot(supabase, attemptId) {
  const { data, error } = await supabase
    .from("dimension_scores")
    .select("dimension, raw_score, normalized_score, percentile_score, interpretation")
    .eq("attempt_id", attemptId)
    .order("dimension", { ascending: true });

  if (error) {
    fail(`Unable to load dimension_scores for ${attemptId}: ${error.message}`);
  }

  return data ?? [];
}

async function loadResponsesSnapshot(supabase, attemptId) {
  const { data, error } = await supabase
    .from("responses")
    .select("id, question_id, answer_option_id, raw_value, scored_value, text_value")
    .eq("attempt_id", attemptId)
    .order("id", { ascending: true });

  if (error) {
    fail(`Unable to load responses for ${attemptId}: ${error.message}`);
  }

  return data ?? [];
}

async function main() {
  const attemptId = parseAttemptId(process.argv.slice(2));

  if (!attemptId) {
    fail("Missing --attempt-id.");
  }

  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { enqueueCompletedAssessmentReports } = require("../lib/assessment/reports.ts");
  const {
    claimNextReportJob,
    processClaimedReportJob,
  } = require("../lib/assessment/report-job-worker.ts");

  const supabase = createSupabaseAdminClient();
  const attempt = await loadAttemptContext(supabase, attemptId);

  if (attempt.testSlug !== "safran_v1") {
    fail(`Attempt ${attemptId} belongs to ${attempt.testSlug ?? "unknown test"}, not safran_v1.`);
  }

  if (attempt.status !== "completed" || !attempt.completedAt) {
    fail(`Attempt ${attemptId} is not a completed SAFRAN attempt with completed_at.`);
  }

  const reportBefore = await loadParticipantReportRow(supabase, attemptId);

  const dimensionScoresBefore = await loadDimensionScoresSnapshot(supabase, attemptId);
  const responsesBefore = await loadResponsesSnapshot(supabase, attemptId);

  console.info("Queueing SAFRAN participant report", {
    attemptId,
    testSlug: attempt.testSlug,
    status: attempt.status,
    completedAt: attempt.completedAt,
    responseCount: responsesBefore.length,
    dimensionScoreCount: dimensionScoresBefore.length,
  });

  if (!reportBefore) {
    await enqueueCompletedAssessmentReports(attemptId);
  } else if (
    reportBefore.report_status === "failed" ||
    reportBefore.report_status === "unavailable"
  ) {
    await resetExistingParticipantReportRow(supabase, reportBefore.id);
  } else {
    fail(
      `Participant attempt_report already exists for ${attemptId} with status ${reportBefore.report_status} (id=${reportBefore.id}).`,
    );
  }

  const queuedRow = await loadParticipantReportRow(supabase, attemptId);

  if (!queuedRow) {
    fail(`enqueueCompletedAssessmentReports did not create participant attempt_report for ${attemptId}.`);
  }

  const claimedJob =
    queuedRow.report_status === "queued"
      ? await claimNextReportJob({ attemptId, audience: "participant" })
      : null;

  if (queuedRow.report_status === "queued" && !claimedJob) {
    fail(`Queued participant report for ${attemptId} could not be claimed.`);
  }

  if (claimedJob) {
    await processClaimedReportJob(claimedJob);
  }

  const reportAfter = await loadParticipantReportRow(supabase, attemptId);

  if (!reportAfter) {
    fail(`Participant attempt_report disappeared for ${attemptId} after processing.`);
  }

  const dimensionScoresAfter = await loadDimensionScoresSnapshot(supabase, attemptId);
  const responsesAfter = await loadResponsesSnapshot(supabase, attemptId);

  const scoringUntouched =
    JSON.stringify(dimensionScoresBefore) === JSON.stringify(dimensionScoresAfter);
  const responsesUntouched =
    JSON.stringify(responsesBefore) === JSON.stringify(responsesAfter);

  if (!scoringUntouched) {
    fail("dimension_scores changed during SAFRAN report queue/process flow.");
  }

  if (!responsesUntouched) {
    fail("responses changed during SAFRAN report queue/process flow.");
  }

  console.info("SAFRAN participant report flow finished", {
    attemptId,
    reportId: reportAfter.id,
    testSlug: reportAfter.test_slug,
    audience: reportAfter.audience,
    sourceType: reportAfter.source_type,
    generatorType: reportAfter.generator_type,
    reportStatus: reportAfter.report_status,
    failureCode: reportAfter.failure_code ?? null,
    failureReason: reportAfter.failure_reason ?? null,
    scoringUntouched,
    responsesUntouched,
    dimensionScoresUntouched: scoringUntouched,
  });
}

main().catch((error) => {
  console.error("queue-safran-participant-report failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
