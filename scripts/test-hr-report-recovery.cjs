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

const {
  buildHrAttemptReportQueueInsertPayload,
  resolveHrReportRecoveryOperation,
} = require("../lib/assessment/reports.ts");
const { getReportGenerationCapability } = require("../lib/assessment/report-capabilities.ts");

function capability(testSlug) {
  return getReportGenerationCapability({
    testSlug,
    audience: "hr",
    reportType: "individual",
    sourceType: "single_test",
  });
}

function main() {
  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "completed",
      capability: capability("ipip-neo-120-v1"),
      existingStatus: "failed",
    }),
    "retry_failed",
  );

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "completed",
      capability: capability("safran_v1"),
      existingStatus: null,
    }),
    "generate",
  );

  const safranQueuePayload = buildHrAttemptReportQueueInsertPayload({
    attemptId: "bad42da0-aa18-4ee0-bc6e-552eee8cd38b",
    testSlug: "safran_v1",
    generatorType: "mock",
    modelName: null,
    generatedAt: "2026-05-11T10:00:00.000Z",
  });
  assert.deepEqual(safranQueuePayload, {
    attempt_id: "bad42da0-aa18-4ee0-bc6e-552eee8cd38b",
    test_slug: "safran_v1",
    generator_type: "mock",
    generated_at: "2026-05-11T10:00:00.000Z",
    report_status: "queued",
    failure_code: null,
    failure_reason: null,
    report_snapshot: null,
    completed_at: null,
    report_type: "individual",
    audience: "hr",
    source_type: "single_test",
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    started_at: null,
  });

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "completed",
      capability: capability("ipip-neo-120-v1"),
      existingStatus: "ready",
    }),
    "noop_ready",
  );

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "completed",
      capability: capability("ipip-neo-120-v1"),
      existingStatus: "queued",
    }),
    "noop_active_job",
  );

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "completed",
      capability: capability("ipip-neo-120-v1"),
      existingStatus: "processing",
    }),
    "noop_active_job",
  );

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "completed",
      capability: capability("mwms_v1"),
      existingStatus: null,
    }),
    "generate",
  );

  const mwmsQueuePayload = buildHrAttemptReportQueueInsertPayload({
    attemptId: "6dd2ef0f-9393-48d5-8f6f-d64c80ba5f40",
    testSlug: "mwms_v1",
    generatorType: "mock",
    modelName: null,
    generatedAt: "2026-05-11T10:05:00.000Z",
  });
  assert.equal(mwmsQueuePayload.test_slug, "mwms_v1");
  assert.equal(mwmsQueuePayload.audience, "hr");
  assert.equal(mwmsQueuePayload.report_type, "individual");
  assert.equal(mwmsQueuePayload.source_type, "single_test");
  assert.equal(mwmsQueuePayload.report_status, "queued");

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "in_progress",
      capability: capability("safran_v1"),
      existingStatus: null,
    }),
    "noop_incomplete_attempt",
  );

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "abandoned",
      capability: capability("ipip-neo-120-v1"),
      existingStatus: null,
    }),
    "noop_incomplete_attempt",
  );

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "completed",
      capability: capability("ipip-neo-120-v1"),
      existingStatus: "failed",
    }) === "generate",
    false,
  );

  assert.equal(
    resolveHrReportRecoveryOperation({
      attemptLifecycle: "completed",
      capability: capability("ipip-neo-120-v1"),
      existingStatus: "ready",
    }) === "retry_failed",
    false,
  );

  console.log("HR report recovery operation tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
