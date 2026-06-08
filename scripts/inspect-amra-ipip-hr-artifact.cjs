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

async function main() {
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
      report_snapshot
    `)
    .eq("id", TARGET_REPORT_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load target attempt_report: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Target report ${TARGET_REPORT_ID} was not found.`);
  }

  const inputText = JSON.stringify(data.input_snapshot);
  const reportText = JSON.stringify(data.report_snapshot);
  const validation = validateIpipNeo120HrReportV1(data.report_snapshot, {
    strictContract: true,
    enforceGuardrails: true,
  });

  console.log(
    JSON.stringify(
      {
        reportId: data.id,
        attemptId: data.attempt_id,
        testSlug: data.test_slug,
        audience: data.audience,
        reportType: data.report_type,
        sourceType: data.source_type,
        reportStatus: data.report_status,
        promptVersionId: data.prompt_version_id,
        inputSnapshotContainsSpremnostNaSaradnju: inputText.includes("Spremnost na saradnju"),
        inputSnapshotContainsUgodnost: inputText.includes("Ugodnost"),
        inputSnapshotContainsugodnost: inputText.includes("ugodnost"),
        reportSnapshotContainsSpremnostNaSaradnju: reportText.includes("Spremnost na saradnju"),
        reportSnapshotContainsUgodnost: reportText.includes("Ugodnost"),
        reportSnapshotContainsugodnost: reportText.includes("ugodnost"),
        reportSnapshotContainsTiTone: collectStrings(data.report_snapshot).some((item) =>
          /\bti\b|\btvoj|\btvoja|\btvoje|\btvoji\b/i.test(item),
        ),
        validatorOk: validation.ok,
        validatorErrors: validation.ok ? [] : validation.errors.map((entry) => entry.message),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
