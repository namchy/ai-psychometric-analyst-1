const path = require("node:path");
const Module = require("node:module");
const fs = require("node:fs");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

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

const { createSupabaseAdminClient } = require("../lib/supabase/admin.ts");
const { validateIpipNeo120HrReportV1 } = require("../lib/assessment/ipip-neo-120-report-v1.ts");
const {
  getReportGenerationCapability,
} = require("../lib/assessment/report-capabilities.ts");
const {
  resolveHrReportRecoveryOperation,
} = require("../lib/assessment/reports.ts");

const TARGET_REPORT_ID = "9ef593a9-ebcf-4606-a16e-f245b47deb0c";

function collectStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
    return output;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, output);
    }
  }

  return output;
}

function resolveAttemptLifecycle(attempt) {
  if (!attempt) {
    return "unknown";
  }

  if (attempt.status === "completed" && attempt.completed_at) {
    return "completed";
  }

  if (attempt.status === "in_progress") {
    return "in_progress";
  }

  if (attempt.status === "abandoned") {
    return "abandoned";
  }

  return "unknown";
}

function inspectArtifactRow(row) {
  const inputSnapshotPresent = Boolean(row?.input_snapshot);
  const reportSnapshotPresent = Boolean(row?.report_snapshot);
  const inputText = JSON.stringify(row?.input_snapshot);
  const reportText = JSON.stringify(row?.report_snapshot);
  const validatorSkipped = !reportSnapshotPresent;
  const validation = validatorSkipped
    ? null
    : validateIpipNeo120HrReportV1(row.report_snapshot, {
        strictContract: true,
        enforceGuardrails: true,
      });
  const missingReasons = [];

  if (!inputSnapshotPresent) {
    missingReasons.push("input_snapshot_missing");
  }

  if (!reportSnapshotPresent) {
    missingReasons.push("report_snapshot_missing");
  }

  return {
    reportId: row.id,
    attemptId: row.attempt_id,
    testSlug: row.test_slug,
    audience: row.audience,
    reportType: row.report_type,
    sourceType: row.source_type,
    reportStatus: row.report_status,
    promptVersionId: row.prompt_version_id,
    attemptStatus: row.attempts?.status ?? null,
    attemptCompletedAt: row.attempts?.completed_at ?? null,
    attemptLifecycle: resolveAttemptLifecycle(row.attempts),
    inputSnapshotPresent,
    reportSnapshotPresent,
    inputSnapshotContainsSpremnostNaSaradnju: inputText.includes("Spremnost na saradnju"),
    inputSnapshotContainsUgodnost: inputText.includes("Ugodnost"),
    inputSnapshotContainsugodnost: inputText.includes("ugodnost"),
    reportSnapshotContainsSpremnostNaSaradnju: reportText.includes("Spremnost na saradnju"),
    reportSnapshotContainsUgodnost: reportText.includes("Ugodnost"),
    reportSnapshotContainsugodnost: reportText.includes("ugodnost"),
    reportSnapshotContainsTiTone: reportSnapshotPresent
      ? collectStrings(row.report_snapshot).some((item) =>
          /\bti\b|\btvoj|\btvoja|\btvoje|\btvoji\b/i.test(item),
        )
      : false,
    validatorSkipped,
    validatorOk: validation ? validation.ok : false,
    validatorErrors: validation && !validation.ok
      ? validation.errors.map((entry) => entry.message)
      : [],
    missingReasons,
  };
}

function buildRecoveryReadout(artifact) {
  const capability = getReportGenerationCapability({
    testSlug: artifact.testSlug ?? "",
    audience: "hr",
    reportType: "individual",
    sourceType: "single_test",
  });
  const recoveryAction = resolveHrReportRecoveryOperation({
    attemptLifecycle: artifact.attemptLifecycle,
    capability,
    existingStatus: artifact.reportStatus ?? null,
  });

  return {
    capabilityActive: capability.active,
    capabilityStatus: capability.status,
    recoveryAction,
    recoveryNeeded: recoveryAction === "retry_failed",
  };
}

async function loadTargetRow() {
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
        status,
        completed_at
      )
    `)
    .eq("id", TARGET_REPORT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target attempt_report: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Target report ${TARGET_REPORT_ID} was not found.`);
  }

  const attempt = Array.isArray(data.attempts) ? data.attempts[0] : data.attempts;

  return {
    ...data,
    attempts: attempt ?? null,
  };
}

async function main() {
  const row = await loadTargetRow();
  const artifact = inspectArtifactRow(row);
  const recovery = buildRecoveryReadout(artifact);

  console.log(
    JSON.stringify(
      {
        ...artifact,
        ...recovery,
      },
      null,
      2,
    ),
  );
}

module.exports = {
  TARGET_REPORT_ID,
  collectStrings,
  resolveAttemptLifecycle,
  inspectArtifactRow,
  buildRecoveryReadout,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
