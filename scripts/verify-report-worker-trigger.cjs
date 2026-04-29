const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { setTimeout: delay } = require("node:timers/promises");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

function fail(message) {
  throw new Error(message);
}

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

async function verifyQueuedParticipantJob(attemptId) {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { claimNextReportJob, processClaimedReportJob } = require("../lib/assessment/report-job-worker.ts");
  const supabase = createSupabaseAdminClient();

  const { data: beforeParticipantRow, error: beforeParticipantError } = await supabase
    .from("attempt_reports")
    .select("id, report_status, started_at, audience")
    .eq("attempt_id", attemptId)
    .eq("audience", "participant")
    .maybeSingle();

  if (beforeParticipantError) {
    fail(`Unable to load queued participant report: ${beforeParticipantError.message}`);
  }

  if (!beforeParticipantRow) {
    fail(`No participant attempt_report found for attempt ${attemptId}.`);
  }

  const { data: beforeHrRow, error: beforeHrError } = await supabase
    .from("attempt_reports")
    .select("id, report_status, started_at, audience")
    .eq("attempt_id", attemptId)
    .eq("audience", "hr")
    .maybeSingle();

  if (beforeHrError) {
    fail(`Unable to load HR attempt_report for attempt ${attemptId}: ${beforeHrError.message}`);
  }

  const job =
    beforeParticipantRow.report_status === "queued"
      ? await claimNextReportJob({ attemptId, audience: "participant" })
      : null;

  if (beforeParticipantRow.report_status === "queued" && !job) {
    const { data: reloadedParticipantRow, error: reloadedParticipantError } = await supabase
      .from("attempt_reports")
      .select("report_status, started_at")
      .eq("attempt_id", attemptId)
      .eq("audience", "participant")
      .maybeSingle();

    if (reloadedParticipantError || !reloadedParticipantRow) {
      fail(
        `Participant report for attempt ${attemptId} stayed queued and could not be claimed: ${reloadedParticipantError?.message ?? "missing row"}`,
      );
    }

    if (reloadedParticipantRow.report_status === "queued") {
      fail(`Participant report for attempt ${attemptId} stayed queued and could not be claimed.`);
    }
  }

  if (job && job.audience !== "participant") {
    fail(`Expected participant report job, but claimed audience ${job.audience}.`);
  }

  if (job && job.attempt_id !== attemptId) {
    fail(`Expected claimed job for attempt ${attemptId}, received ${job.attempt_id}.`);
  }

  if (job) {
    await processClaimedReportJob(job);
  }

  let afterParticipantRow = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from("attempt_reports")
      .select("report_status, started_at, completed_at, failure_code, audience")
      .eq("attempt_id", attemptId)
      .eq("audience", "participant")
      .maybeSingle();

    if (error || !data) {
      fail(`Unable to load processed participant report: ${error?.message ?? "Unknown error"}`);
    }

    afterParticipantRow = data;

    if (data.report_status !== "processing") {
      break;
    }

    await delay(500);
  }

  if (!afterParticipantRow) {
    fail(`Unable to load participant report state for attempt ${attemptId}.`);
  }

  if (afterParticipantRow.report_status === "queued") {
    fail(`Participant report for attempt ${attemptId} is still queued after processing.`);
  }

  if (afterParticipantRow.report_status === "processing") {
    fail(`Participant report for attempt ${attemptId} is still processing after verification wait window.`);
  }

  if (!afterParticipantRow.started_at) {
    fail(`Participant report for attempt ${attemptId} still has null started_at after processing.`);
  }

  const { data: afterHrRow, error: afterHrError } = await supabase
    .from("attempt_reports")
    .select("id, report_status, started_at, audience")
    .eq("attempt_id", attemptId)
    .eq("audience", "hr")
    .maybeSingle();

  if (afterHrError) {
    fail(`Unable to reload HR attempt_report for attempt ${attemptId}: ${afterHrError.message}`);
  }

  if (
    beforeHrRow &&
    afterHrRow &&
    beforeHrRow.report_status === "queued" &&
    beforeHrRow.started_at === null &&
    afterHrRow.report_status === "processing" &&
    afterHrRow.started_at
  ) {
    fail(`HR report for attempt ${attemptId} was claimed during participant-only verification.`);
  }

  console.info("Participant report verification passed", {
    attemptId,
    status: afterParticipantRow.report_status,
    startedAt: afterParticipantRow.started_at,
    completedAt: afterParticipantRow.completed_at ?? null,
    failureCode: afterParticipantRow.failure_code ?? null,
    hrStatus: afterHrRow?.report_status ?? null,
  });
}

async function verifyHrMockFallback() {
  const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");

  const result = await mockReportProvider.generateReport({
    attemptId: "verify-attempt",
    testSlug: "ipip-neo-120-v1",
    promptVersion: "verify",
    promptVersionId: null,
    promptTemplate: null,
    reportContract: {
      family: "big_five",
      reportType: "individual",
      sourceType: "single_test",
      promptKey: "ipip_neo_120_hr_v1",
      schemaName: "ipip-neo-120-hr-v1",
      outputSchemaJson: {},
    },
    promptInput: {
      attempt_id: "verify-attempt",
      test_id: "verify-test",
      test_slug: "ipip-neo-120-v1",
      test_name: "IPIP-NEO-120",
      test_family: "ipip_neo_120",
      audience: "hr",
      locale: "bs",
      scoring_method: "likert_sum",
      prompt_version: "verify",
      scored_response_count: 120,
      scale_hint: {
        min: 1,
        max: 5,
        display_mode: "visual_with_discreet_numeric_support",
      },
      domains: [
        { domain_code: "EXTRAVERSION", label: "Ekstraverzija", score: 4.2, score_band: "high" },
        { domain_code: "AGREEABLENESS", label: "Ugodnost", score: 3.8, score_band: "moderate", facets: [] },
        { domain_code: "CONSCIENTIOUSNESS", label: "Savjesnost", score: 4.4, score_band: "high", facets: [] },
        { domain_code: "NEUROTICISM", label: "Neuroticizam", score: 2.1, score_band: "low", facets: [] },
        { domain_code: "OPENNESS_TO_EXPERIENCE", label: "Otvorenost", score: 3.6, score_band: "moderate", facets: [] },
      ],
      deterministic_summary: {
        highest_domain: "CONSCIENTIOUSNESS",
        lowest_domain: "NEUROTICISM",
        ranked_domains: [
          "CONSCIENTIOUSNESS",
          "EXTRAVERSION",
          "AGREEABLENESS",
          "OPENNESS_TO_EXPERIENCE",
          "NEUROTICISM",
        ],
        top_facets: [],
      },
    },
  });

  if (!result.ok && String(result.reason).includes("Cannot read properties of undefined")) {
    fail("HR mock provider still crashes on undefined.map.");
  }

  console.info("HR mock fallback verification passed", {
    ok: result.ok,
    reason: result.ok ? null : result.reason,
  });
}

async function main() {
  const attemptId = parseAttemptId(process.argv.slice(2));

  if (!attemptId) {
    fail("Missing --attempt-id for participant report verification.");
  }

  await verifyQueuedParticipantJob(attemptId);
  await verifyHrMockFallback();
}

main().catch((error) => {
  console.error("verify-report-worker-trigger failed", {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
