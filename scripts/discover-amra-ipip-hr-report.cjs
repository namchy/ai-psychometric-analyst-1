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
const { getActivePromptVersion } = require("../lib/assessment/prompt-version.ts");
const { resolveHrReportRecoveryOperation } = require("../lib/assessment/reports.ts");

async function main() {
  const supabase = createSupabaseAdminClient();

  const { data: rows, error } = await supabase
    .from("attempts")
    .select(`
      id,
      status,
      completed_at,
      locale,
      test_id,
      participant_id,
      tests!inner(id, slug, name),
      participants!inner(id, full_name, email),
      attempt_reports(
        id,
        report_status,
        report_type,
        audience,
        source_type,
        prompt_version_id,
        generated_at,
        started_at,
        completed_at,
        failure_code,
        failure_reason,
        model_name,
        input_snapshot,
        report_snapshot
      )
    `)
    .eq("tests.slug", "ipip-neo-120-v1")
    .or("full_name.ilike.%amra%,email.ilike.%amra%", { foreignTable: "participants" })
    .order("completed_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Failed to discover Amra IPIP attempts: ${error.message}`);
  }

  const candidates = [];

  for (const row of rows ?? []) {
    const test = Array.isArray(row.tests) ? row.tests[0] : row.tests;
    const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
    const hrReport =
      (row.attempt_reports ?? []).find(
        (report) =>
          report.report_type === "individual" &&
          report.audience === "hr" &&
          report.source_type === "single_test",
      ) ?? null;

    const activePrompt = await getActivePromptVersion(
      {
        testId: row.test_id,
        reportType: "individual",
        audience: "hr",
        sourceType: "single_test",
        generatorType: "openai",
        promptKey: "completed_assessment_report",
      },
      {
        locale: row.locale ?? "bs",
      },
    );

    const recoveryOperation = resolveHrReportRecoveryOperation({
      attemptLifecycle:
        row.status === "completed" && row.completed_at
          ? "completed"
          : row.status === "in_progress"
            ? "in_progress"
            : row.status === "abandoned"
              ? "abandoned"
              : "unknown",
      capability: {
        active: true,
        status: "active",
      },
      existingStatus: hrReport?.report_status ?? null,
    });

    candidates.push({
      attemptId: row.id,
      testId: row.test_id,
      testSlug: test?.slug ?? null,
      testName: test?.name ?? null,
      participantId: row.participant_id,
      participantName: participant?.full_name ?? null,
      participantEmail: participant?.email ?? null,
      attemptStatus: row.status,
      completedAt: row.completed_at,
      hrReport: hrReport
        ? {
            id: hrReport.id,
            reportStatus: hrReport.report_status,
            promptVersionId: hrReport.prompt_version_id,
            generatedAt: hrReport.generated_at,
            startedAt: hrReport.started_at,
            completedAt: hrReport.completed_at,
            failureCode: hrReport.failure_code,
            failureReason: hrReport.failure_reason,
            modelName: hrReport.model_name,
            hasInputSnapshot: Boolean(hrReport.input_snapshot),
            hasReportSnapshot: Boolean(hrReport.report_snapshot),
          }
        : null,
      activePromptVersion: activePrompt
        ? {
            id: activePrompt.id,
            version: activePrompt.version,
            promptKey: activePrompt.promptKey,
            reportType: activePrompt.reportType,
            sourceType: activePrompt.sourceType,
            testId: activePrompt.testId,
          }
        : null,
      recoveryOperation,
    });
  }

  console.log(JSON.stringify({ candidates }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
