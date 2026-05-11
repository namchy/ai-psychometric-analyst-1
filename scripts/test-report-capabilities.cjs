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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  getReportGenerationCapability,
  planPostCompletionReportJobs,
} = require("../lib/assessment/report-capabilities.ts");

function buildExistingReport(audience, status, testSlug = "ipip-neo-120-v1") {
  return {
    audience,
    report_type: "individual",
    source_type: "single_test",
    report_status: status,
    test_slug: testSlug,
  };
}

function main() {
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "ipip-neo-120-v1",
      audience: "participant",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "ipip-neo-120-v1",
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "safran_v1",
      audience: "participant",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "safran_v1",
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "mwms_v1",
      audience: "participant",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "mwms_v1",
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: true, status: "active" },
  );
  assert.deepEqual(
    getReportGenerationCapability({
      testSlug: "unknown_test_v1",
      audience: "hr",
      reportType: "individual",
      sourceType: "single_test",
    }),
    { active: false, status: "inactive", reason: "unknown_test" },
  );

  const ipipPlan = planPostCompletionReportJobs({
    testSlug: "ipip-neo-120-v1",
    existingReports: [],
  });
  assert.deepEqual(
    ipipPlan.jobsToEnqueue.map((job) => job.audience),
    ["participant", "hr"],
  );

  const safranPlan = planPostCompletionReportJobs({
    testSlug: "safran_v1",
    existingReports: [],
  });
  assert.deepEqual(
    safranPlan.jobsToEnqueue.map((job) => job.audience),
    ["participant", "hr"],
  );

  const mwmsPlan = planPostCompletionReportJobs({
    testSlug: "mwms_v1",
    existingReports: [],
  });
  assert.deepEqual(
    mwmsPlan.jobsToEnqueue.map((job) => job.audience),
    ["participant", "hr"],
  );
  assert.equal(
    mwmsPlan.lanes.find((lane) => lane.audience === "hr")?.capability.status,
    "active",
  );

  const duplicateHrPlan = planPostCompletionReportJobs({
    testSlug: "ipip-neo-120-v1",
    existingReports: [buildExistingReport("hr", "queued")],
  });
  assert.deepEqual(
    duplicateHrPlan.jobsToEnqueue.map((job) => job.audience),
    ["participant"],
  );

  const failedHrPlan = planPostCompletionReportJobs({
    testSlug: "safran_v1",
    existingReports: [buildExistingReport("hr", "failed", "safran_v1")],
  });
  assert.deepEqual(
    failedHrPlan.jobsToEnqueue.map((job) => job.audience),
    ["participant"],
  );
  assert.equal(
    failedHrPlan.lanes.find((lane) => lane.audience === "hr")?.existingStatus,
    "failed",
  );
  assert.equal(
    failedHrPlan.lanes.find((lane) => lane.audience === "hr")?.shouldEnqueue,
    false,
  );

  const existingReadyPlan = planPostCompletionReportJobs({
    testSlug: "ipip-neo-120-v1",
    existingReports: [
      buildExistingReport("participant", "ready"),
      buildExistingReport("hr", "ready"),
    ],
  });
  assert.deepEqual(existingReadyPlan.jobsToEnqueue, []);

  const unknownPlan = planPostCompletionReportJobs({
    testSlug: "unknown_test_v1",
    existingReports: [],
  });
  assert.deepEqual(unknownPlan.jobsToEnqueue, []);
  assert.equal(
    unknownPlan.lanes.find((lane) => lane.audience === "hr")?.capability.active,
    false,
  );

  console.log("Report capability and post-completion planning tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
