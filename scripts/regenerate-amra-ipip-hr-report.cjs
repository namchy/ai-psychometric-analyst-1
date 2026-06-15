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
const TARGET_PROMPT_VERSION_ID = "ca910d21-a5ac-4f23-9025-c4e047cc4779";
const TARGET_PROMPT_VERSION = "v1_ipip_hr_focused_20260606";
const TARGET_PROMPT_KEY = "ipip_neo_120_hr_v2";
const CONFIRM_ENV = "CONFIRM_AMRA_IPIP_HR_REGENERATION";
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

function isExecutionConfirmed(env = process.env) {
  return env[CONFIRM_ENV]?.trim().toLowerCase() === "true";
}

function isDebugDumpEnabled(env = process.env) {
  return env[DUMP_ENV]?.trim().toLowerCase() === "true";
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

  if (summary.promptSource.promptVersionId !== TARGET_PROMPT_VERSION_ID) {
    throw new Error(
      `Unexpected prompt_version_id: ${summary.promptSource.promptVersionId ?? "null"}`,
    );
  }

  if (summary.promptSource.promptVersion !== TARGET_PROMPT_VERSION) {
    throw new Error(`Unexpected prompt version: ${summary.promptSource.promptVersion ?? "null"}`);
  }

  if (summary.promptSource.promptKey !== TARGET_PROMPT_KEY) {
    throw new Error(`Unexpected prompt key: ${summary.promptSource.promptKey ?? "null"}`);
  }

  if (!isExecutionConfirmed(env)) {
    throw new Error(
      `Execution not confirmed. Set ${CONFIRM_ENV}=true to allow the controlled regeneration write.`,
    );
  }

  if (!isDebugDumpEnabled(env)) {
    throw new Error(`Execution requires ${DUMP_ENV}=true.`);
  }
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

function containsForbiddenTerm(text) {
  const withoutExplicitPolicyTerms = text
    .replace(/\\"Ugodnost\\"/g, "")
    .replace(/\\"ugodnost\\"/g, "")
    .replace(/"Ugodnost"/g, "")
    .replace(/"ugodnost"/g, "");

  return (
    withoutExplicitPolicyTerms.includes("Ugodnost") ||
    withoutExplicitPolicyTerms.includes("ugodnost")
  );
}

function validateDebugDumpAuthorityRecord(dumpRecord) {
  const dumpText = JSON.stringify(dumpRecord);
  const authorityMetadata = dumpRecord?.authority_metadata;
  const authorityLayers = authorityMetadata?.authorityLayers;

  const hasAuthorityMetadata = Boolean(
    authorityMetadata &&
      authorityMetadata.reportFamily === "single_test_hr" &&
      authorityMetadata.reportKind === "ipip_hr" &&
      authorityMetadata.reportLaneId === "ipip_hr:ipip-neo-120-v1:hr",
  );
  const hasAuthorityLayers =
    Array.isArray(authorityLayers) &&
    authorityLayers.includes("global_bhs_language_policy") &&
    authorityLayers.includes("global_hr_report_policy") &&
    authorityLayers.includes("single_test_hr_family_policy") &&
    authorityLayers.includes("test_specific_terminology_policy") &&
    authorityLayers.includes("runtime_input_facts");
  const hasPromptSourceMetadata =
    dumpRecord?.prompt_key === TARGET_PROMPT_KEY &&
    authorityMetadata?.promptKey === TARGET_PROMPT_KEY &&
    dumpRecord?.report_contract_key === "ipip_neo_120_hr_v2" &&
    authorityMetadata?.reportContractKey === "ipip_neo_120_hr_v2" &&
    dumpRecord?.report_schema_name === "ipip-neo-120-hr-v2" &&
    authorityMetadata?.reportSchemaName === "ipip-neo-120-hr-v2";
  const hasTerminology =
    dumpText.includes("Spremnost na saradnju") &&
    !containsForbiddenTerm(dumpText);
  const hasNoSecrets =
    !dumpText.includes("OPENAI_API_KEY") &&
    !dumpText.includes("Authorization") &&
    !dumpText.includes("Bearer");

  return {
    ok:
      hasAuthorityMetadata &&
      hasAuthorityLayers &&
      hasPromptSourceMetadata &&
      hasTerminology &&
      hasNoSecrets,
    hasAuthorityMetadata,
    hasAuthorityLayers,
    hasPromptSourceMetadata,
    hasTerminology,
    hasNoSecrets,
  };
}

async function loadPreflightSummary() {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { getActivePromptVersion } = require("../lib/assessment/prompt-version.ts");
  const { resolveReadySingleTestHrRegenerationOperation } = require("../lib/assessment/reports.ts");

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
      attempts!inner(
        id,
        test_id,
        status,
        completed_at,
        locale,
        participant_id,
        participants!inner(full_name, email)
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
  const activePrompt = await getActivePromptVersion(
    {
      testId: attempt?.test_id ?? null,
      reportType: data.report_type,
      audience: data.audience,
      sourceType: data.source_type,
      generatorType: "openai",
      promptKey: TARGET_PROMPT_KEY,
    },
    {
      locale: attempt?.locale ?? "bs",
    },
  );
  const regenerationAction = resolveReadySingleTestHrRegenerationOperation({
    mode: "regenerate_ready",
    report: {
      id: data.id,
      attempt_id: data.attempt_id,
      test_slug: data.test_slug,
      audience: data.audience,
      report_type: data.report_type,
      source_type: data.source_type,
      report_status: data.report_status,
      generator_type: "openai",
    },
    capability: {
      active: true,
      status: "active",
    },
  });

  return {
    target: {
      reportId: data.id,
      attemptId: data.attempt_id,
      testId: attempt?.test_id ?? null,
      testSlug: data.test_slug,
      participantName: participant?.full_name ?? null,
      participantEmail: participant?.email ?? null,
      audience: data.audience,
      reportType: data.report_type,
      sourceType: data.source_type,
      reportStatus: data.report_status,
    },
    promptSource: {
      promptVersionId: activePrompt?.id ?? data.prompt_version_id ?? null,
      promptVersion: activePrompt?.version ?? null,
      promptKey: activePrompt?.promptKey ?? TARGET_PROMPT_KEY,
      testId: activePrompt?.testId ?? attempt?.test_id ?? null,
    },
    regenerationAction,
  };
}

async function inspectFinalArtifacts() {
  const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
  const { validateIpipNeo120HrReportV1 } = require("../lib/assessment/ipip-neo-120-report-v1.ts");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempt_reports")
    .select("id, attempt_id, report_status, input_snapshot, report_snapshot, prompt_version_id")
    .eq("id", TARGET_REPORT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to inspect regenerated attempt_report: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Regenerated attempt_report ${TARGET_REPORT_ID} not found.`);
  }

  const inputText = JSON.stringify(data.input_snapshot);
  const reportText = JSON.stringify(data.report_snapshot);
  const validation = validateIpipNeo120HrReportV1(data.report_snapshot, {
    strictContract: true,
    enforceGuardrails: true,
  });

  if (!inputText.includes("Spremnost na saradnju") || containsForbiddenTerm(inputText)) {
    throw new Error("Regenerated input_snapshot did not satisfy terminology authority checks.");
  }

  if (!reportText.includes("Spremnost na saradnju") || containsForbiddenTerm(reportText)) {
    throw new Error("Regenerated report_snapshot did not satisfy terminology authority checks.");
  }

  if (!validation.ok) {
    throw new Error(
      `Regenerated report_snapshot failed validation: ${validation.errors.map((entry) => entry.message).join(" | ")}`,
    );
  }

  return {
    reportStatus: data.report_status,
    promptVersionId: data.prompt_version_id,
  };
}

async function main() {
  const {
    regenerateReadySingleTestHrReport,
  } = require("../lib/assessment/reports.ts");
  const {
    claimNextReportJob,
    processClaimedReportJob,
  } = require("../lib/assessment/report-job-worker.ts");

  const summary = await loadPreflightSummary();
  const result = {
    preflight: summary,
    execution: null,
  };

  if (!isExecutionConfirmed(process.env)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  assertExecutionPreflight(summary, process.env);

  const startedAtMs = Date.now();
  const queued = await regenerateReadySingleTestHrReport(TARGET_REPORT_ID, {
    mode: "regenerate_ready",
  });

  if (queued.action !== "regenerate_ready" || queued.status !== "queued") {
    throw new Error(`Unexpected regeneration queue result: ${JSON.stringify(queued)}`);
  }

  const claimedJob = await claimNextReportJob({
    attemptId: TARGET_ATTEMPT_ID,
    audience: "hr",
  });

  if (!claimedJob || claimedJob.id !== TARGET_REPORT_ID) {
    throw new Error("Controlled regeneration could not claim the target HR report job.");
  }

  const workerResult = await processClaimedReportJob(claimedJob);

  if (workerResult.status !== "ready") {
    throw new Error(`Controlled regeneration worker result was not ready: ${JSON.stringify(workerResult)}`);
  }

  const dumpPath = findLatestDumpPath(startedAtMs);

  if (!dumpPath) {
    throw new Error("No debug dump file was found after controlled regeneration.");
  }

  const dumpText = fs.readFileSync(dumpPath, "utf8");
  const dumpRecord = JSON.parse(dumpText);
  const dumpValidation = validateDebugDumpAuthorityRecord(dumpRecord);

  if (!dumpValidation.ok) {
    throw new Error("Debug dump did not satisfy authority metadata or terminology checks.");
  }

  if (!dumpValidation.hasNoSecrets) {
    throw new Error("Debug dump contains forbidden secret markers.");
  }

  const finalArtifacts = await inspectFinalArtifacts();

  result.execution = {
    queued,
    workerResult: {
      status: workerResult.status,
      reportId: workerResult.reportId,
    },
    dumpPath,
    finalArtifacts,
  };

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
  TARGET_PROMPT_VERSION_ID,
  TARGET_PROMPT_VERSION,
  TARGET_PROMPT_KEY,
  CONFIRM_ENV,
  DUMP_ENV,
  isExecutionConfirmed,
  isDebugDumpEnabled,
  assertExecutionPreflight,
  validateDebugDumpAuthorityRecord,
};
