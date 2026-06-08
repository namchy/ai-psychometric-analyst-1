const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const TARGET_REPORT_ID = "9ef593a9-ebcf-4606-a16e-f245b47deb0c";
const TARGET_ATTEMPT_ID = "2432eb12-2b54-4881-bef2-2ac687b59e0b";
const TARGET_TEST_ID = "38cdeedc-c123-4fa8-b566-bae5389a1407";
const TARGET_TEST_SLUG = "ipip-neo-120-v1";
const TARGET_PARTICIPANT_NAME = "Amra Afgan";
const TARGET_PARTICIPANT_EMAIL = "amrafagan@nestox.com";
const TARGET_AUDIENCE = "hr";
const TARGET_REPORT_TYPE = "individual";
const TARGET_SOURCE_TYPE = "single_test";
const TARGET_PROMPT_KEY = "completed_assessment_report";
const CONFIRM_ENV = "CONFIRM_AMRA_IPIP_HR_FAILED_RETRY";
const DUMP_ENV = "AI_REPORT_DEBUG_DUMP_PROMPTS";

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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  collectStrings,
  inspectArtifactRow,
  buildRecoveryReadout,
} = require("./inspect-amra-ipip-hr-artifact.cjs");
const {
  validateDebugDumpAuthorityRecord,
} = require("./regenerate-amra-ipip-hr-report.cjs");

function isExecutionConfirmed(env = process.env) {
  return env[CONFIRM_ENV]?.trim().toLowerCase() === "true";
}

function isDebugDumpEnabled(env = process.env) {
  return env[DUMP_ENV]?.trim().toLowerCase() === "true";
}

function findLatestDumpPath(afterMs) {
  const dumpDir = path.join(os.tmpdir(), "ai-report-debug-dumps");

  if (!fs.existsSync(dumpDir)) {
    return null;
  }

  const candidates = fs
    .readdirSync(dumpDir)
    .map((name) => path.join(dumpDir, name))
    .filter((filePath) => filePath.endsWith(".json"))
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    }))
    .filter((entry) => entry.mtimeMs >= afterMs)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return candidates[0]?.filePath ?? null;
}

function containsForbiddenOutputTerms(text) {
  const lowered = text.toLocaleLowerCase("bs");
  return (
    lowered.includes("ugodnost") ||
    lowered.includes("saradljivost") ||
    lowered.includes("kooperativnost") ||
    lowered.includes("overuse") ||
    lowered.includes("handling")
  );
}

function buildPreflightSummary(row) {
  const artifact = inspectArtifactRow(row);
  const recovery = buildRecoveryReadout(artifact);

  return {
    target: {
      reportId: artifact.reportId,
      attemptId: artifact.attemptId,
      testId: row.attempts?.test_id ?? null,
      testSlug: artifact.testSlug,
      participantName: row.attempts?.participants?.full_name ?? null,
      participantEmail: row.attempts?.participants?.email ?? null,
      audience: artifact.audience,
      reportType: artifact.reportType,
      sourceType: artifact.sourceType,
      reportStatus: artifact.reportStatus,
    },
    artifact,
    recovery,
    promptSource: {
      promptVersionId: artifact.promptVersionId,
      promptKey: TARGET_PROMPT_KEY,
      testId: row.attempts?.test_id ?? null,
    },
  };
}

function assertExecutionPreflight(summary, env = process.env) {
  if (summary.target.reportId !== TARGET_REPORT_ID) {
    throw new Error(`Unexpected target report id: ${summary.target.reportId}`);
  }

  if (summary.target.attemptId !== TARGET_ATTEMPT_ID) {
    throw new Error(`Unexpected target attempt id: ${summary.target.attemptId}`);
  }

  if (summary.target.testId !== TARGET_TEST_ID || summary.target.testSlug !== TARGET_TEST_SLUG) {
    throw new Error("Target test identity does not match Amra/IPIP HR target.");
  }

  if (summary.target.participantName !== TARGET_PARTICIPANT_NAME) {
    throw new Error(`Unexpected participant name: ${summary.target.participantName ?? "null"}`);
  }

  if (summary.target.participantEmail !== TARGET_PARTICIPANT_EMAIL) {
    throw new Error(`Unexpected participant email: ${summary.target.participantEmail ?? "null"}`);
  }

  if (
    summary.target.audience !== TARGET_AUDIENCE ||
    summary.target.reportType !== TARGET_REPORT_TYPE ||
    summary.target.sourceType !== TARGET_SOURCE_TYPE
  ) {
    throw new Error("Target report lane does not match Amra/IPIP HR single-test individual lane.");
  }

  if (summary.target.reportStatus !== "failed") {
    throw new Error(`Target report must be in failed state, got: ${summary.target.reportStatus}`);
  }

  if (summary.recovery.recoveryAction !== "retry_failed") {
    throw new Error(
      `Expected recoveryAction retry_failed, got: ${summary.recovery.recoveryAction}`,
    );
  }

  if (!isExecutionConfirmed(env)) {
    throw new Error(
      `Execution not confirmed. Set ${CONFIRM_ENV}=true to allow the controlled failed retry write.`,
    );
  }

  if (!isDebugDumpEnabled(env)) {
    throw new Error(`Execution requires ${DUMP_ENV}=true.`);
  }
}

function assertPostRunVerification(verification) {
  if (verification.reportStatus !== "ready") {
    throw new Error(`Final reportStatus is not ready: ${verification.reportStatus}`);
  }

  if (!verification.validatorOk) {
    throw new Error(
      `Final validator did not pass: ${(verification.validatorErrors ?? []).join(" | ") || "unknown error"}`,
    );
  }

  if (!verification.inputSnapshotContainsSpremnostNaSaradnju) {
    throw new Error("Final input_snapshot does not contain canonical terminology.");
  }

  if (!verification.reportSnapshotContainsSpremnostNaSaradnju) {
    throw new Error("Final report_snapshot does not contain canonical terminology.");
  }

  if (verification.containsForbiddenTerms) {
    throw new Error("Final artifacts contain forbidden terminology.");
  }

  if (verification.reportSnapshotContainsTiTone) {
    throw new Error("Final report_snapshot contains candidate-facing ti tone.");
  }
}

async function loadTargetRow() {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempt_reports")
    .select(`
      id,
      attempt_id,
      test_slug,
      audience,
      report_type,
      source_type,
      report_status,
      prompt_version_id,
      input_snapshot,
      report_snapshot,
      attempts!inner(
        id,
        test_id,
        status,
        completed_at,
        participants!inner(
          full_name,
          email
        )
      )
    `)
    .eq("id", TARGET_REPORT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target attempt_report: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Target attempt_report ${TARGET_REPORT_ID} not found.`);
  }

  const attempt = Array.isArray(data.attempts) ? data.attempts[0] : data.attempts;
  const participant = Array.isArray(attempt?.participants)
    ? attempt?.participants[0]
    : attempt?.participants;

  return {
    ...data,
    attempts: attempt
      ? {
          ...attempt,
          participants: participant ?? null,
        }
      : null,
  };
}

async function inspectFinalArtifacts() {
  const row = await loadTargetRow();
  const artifact = inspectArtifactRow(row);
  const inputText = JSON.stringify(row.input_snapshot);
  const reportText = JSON.stringify(row.report_snapshot);
  const combinedText = `${inputText}\n${reportText}`;

  return {
    reportStatus: artifact.reportStatus,
    validatorOk: artifact.validatorOk,
    validatorErrors: artifact.validatorErrors,
    inputSnapshotPresent: artifact.inputSnapshotPresent,
    reportSnapshotPresent: artifact.reportSnapshotPresent,
    inputSnapshotContainsSpremnostNaSaradnju:
      artifact.inputSnapshotContainsSpremnostNaSaradnju,
    reportSnapshotContainsSpremnostNaSaradnju:
      artifact.reportSnapshotContainsSpremnostNaSaradnju,
    reportSnapshotContainsTiTone: artifact.reportSnapshotContainsTiTone,
    containsForbiddenTerms: containsForbiddenOutputTerms(combinedText),
  };
}

async function loadPreflightSummary() {
  const row = await loadTargetRow();
  return buildPreflightSummary(row);
}

async function runControlledFailedRetry(options = {}) {
  const env = options.env ?? process.env;
  const deps = {
    loadPreflightSummary: options.loadPreflightSummary ?? loadPreflightSummary,
    recoverHrAttemptReport:
      options.recoverHrAttemptReport ??
      (async (...args) => {
        const { recoverHrAttemptReport } = require("../lib/assessment/reports.ts");
        return await recoverHrAttemptReport(...args);
      }),
    claimNextReportJob:
      options.claimNextReportJob ??
      (async (...args) => {
        const { claimNextReportJob } = require("../lib/assessment/report-job-worker.ts");
        return await claimNextReportJob(...args);
      }),
    processClaimedReportJob:
      options.processClaimedReportJob ??
      (async (...args) => {
        const { processClaimedReportJob } = require("../lib/assessment/report-job-worker.ts");
        return await processClaimedReportJob(...args);
      }),
    findLatestDumpPath: options.findLatestDumpPath ?? findLatestDumpPath,
    readFileSync: options.readFileSync ?? fs.readFileSync,
    inspectFinalArtifacts: options.inspectFinalArtifacts ?? inspectFinalArtifacts,
    assertExecutionPreflight:
      options.assertExecutionPreflight ?? assertExecutionPreflight,
    assertPostRunVerification:
      options.assertPostRunVerification ?? assertPostRunVerification,
    validateDebugDumpAuthorityRecord:
      options.validateDebugDumpAuthorityRecord ?? validateDebugDumpAuthorityRecord,
  };

  const preflight = await deps.loadPreflightSummary();
  const result = {
    preflight,
    execution: null,
  };

  if (!isExecutionConfirmed(env)) {
    return result;
  }

  deps.assertExecutionPreflight(preflight, env);

  const startedAtMs = Date.now();
  const queued = await deps.recoverHrAttemptReport(TARGET_ATTEMPT_ID);

  if (
    queued.action !== "retry_failed" ||
    queued.status !== "queued" ||
    queued.reportId !== TARGET_REPORT_ID
  ) {
    throw new Error(`Unexpected failed retry queue result: ${JSON.stringify(queued)}`);
  }

  const claimedJob = await deps.claimNextReportJob({
    attemptId: TARGET_ATTEMPT_ID,
    audience: TARGET_AUDIENCE,
  });

  if (!claimedJob || claimedJob.id !== TARGET_REPORT_ID) {
    throw new Error("Controlled failed retry could not claim the target HR report job.");
  }

  const workerResult = await deps.processClaimedReportJob(claimedJob);

  if (workerResult.status !== "ready") {
    throw new Error(`Controlled failed retry worker result was not ready: ${JSON.stringify(workerResult)}`);
  }

  const dumpPath = deps.findLatestDumpPath(startedAtMs);

  if (!dumpPath) {
    throw new Error("No debug dump file was found after controlled failed retry.");
  }

  const dumpRecord = JSON.parse(deps.readFileSync(dumpPath, "utf8"));
  const dumpValidation = deps.validateDebugDumpAuthorityRecord(dumpRecord);

  if (!dumpValidation.ok) {
    throw new Error("Debug dump did not satisfy authority metadata or terminology checks.");
  }

  if (!dumpValidation.hasNoSecrets) {
    throw new Error("Debug dump contains forbidden secret markers.");
  }

  const finalArtifacts = await deps.inspectFinalArtifacts();
  deps.assertPostRunVerification(finalArtifacts);

  result.execution = {
    queued,
    workerResult: {
      status: workerResult.status,
      reportId: workerResult.reportId,
    },
    dumpPath,
    finalArtifacts,
  };

  return result;
}

async function main() {
  const result = await runControlledFailedRetry();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET_REPORT_ID,
  TARGET_ATTEMPT_ID,
  TARGET_TEST_ID,
  TARGET_TEST_SLUG,
  TARGET_PARTICIPANT_NAME,
  TARGET_PARTICIPANT_EMAIL,
  TARGET_AUDIENCE,
  TARGET_REPORT_TYPE,
  TARGET_SOURCE_TYPE,
  TARGET_PROMPT_KEY,
  CONFIRM_ENV,
  DUMP_ENV,
  isExecutionConfirmed,
  isDebugDumpEnabled,
  findLatestDumpPath,
  buildPreflightSummary,
  assertExecutionPreflight,
  assertPostRunVerification,
  containsForbiddenOutputTerms,
  inspectFinalArtifacts,
  loadPreflightSummary,
  runControlledFailedRetry,
};
