const assert = require("node:assert/strict");
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

const reportsSource = fs.readFileSync(
  path.join(projectRoot, "lib/assessment/reports.ts"),
  "utf8",
);

const {
  buildRegenerateReadySingleTestHrReportPatch,
  resolveReadySingleTestHrRegenerationOperation,
} = require("../lib/assessment/reports.ts");

function buildReport(overrides = {}) {
  return {
    id: "report-1",
    attempt_id: "attempt-1",
    test_slug: "ipip-neo-120-v1",
    audience: "hr",
    report_type: "individual",
    source_type: "single_test",
    report_status: "ready",
    generator_type: "openai",
    ...overrides,
  };
}

function main() {
  assert.doesNotMatch(reportsSource, /app\/actions|next\/navigation|revalidatePath|redirect/);

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: null,
      report: buildReport(),
      capability: { active: true, status: "active" },
    }),
    "noop_mode_not_confirmed",
  );

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: "regenerate_ready",
      report: null,
      capability: { active: true, status: "active" },
    }),
    "noop_missing_report",
  );

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: "regenerate_ready",
      report: buildReport({ audience: "participant" }),
      capability: { active: true, status: "active" },
    }),
    "noop_wrong_lane",
  );

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: "regenerate_ready",
      report: buildReport({ report_type: "composite" }),
      capability: { active: true, status: "active" },
    }),
    "noop_wrong_lane",
  );

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: "regenerate_ready",
      report: buildReport({ source_type: "assessment" }),
      capability: { active: true, status: "active" },
    }),
    "noop_wrong_lane",
  );

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: "regenerate_ready",
      report: buildReport({ test_slug: "unknown_v1" }),
      capability: { active: true, status: "active" },
    }),
    "noop_unsupported_test",
  );

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: "regenerate_ready",
      report: buildReport({ report_status: "failed" }),
      capability: { active: true, status: "active" },
    }),
    "noop_wrong_status",
  );

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: "regenerate_ready",
      report: buildReport(),
      capability: { active: false, status: "inactive" },
    }),
    "noop_inactive_capability",
  );

  assert.equal(
    resolveReadySingleTestHrRegenerationOperation({
      mode: "regenerate_ready",
      report: buildReport(),
      capability: { active: true, status: "active" },
    }),
    "regenerate_ready",
  );

  const patch = buildRegenerateReadySingleTestHrReportPatch({
    generatedAt: "2026-06-08T12:00:00.000Z",
  });
  assert.deepEqual(patch, {
    report_status: "queued",
    generated_at: "2026-06-08T12:00:00.000Z",
    started_at: null,
    completed_at: null,
    failure_code: null,
    failure_reason: null,
    report_snapshot: null,
    input_snapshot: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
  });

  console.log("test-single-test-hr-regenerate-ready-lifecycle: ok");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
