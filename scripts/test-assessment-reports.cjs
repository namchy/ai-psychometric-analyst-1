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
  buildCompositeReadinessFromLinkedAttempts,
} = require("../lib/assessment/assessment-reports.ts");

function buildLink({
  assignmentId = "assignment-1",
  attemptId,
  testSlug,
  status,
  completedAt = null,
  requiredForComposite = true,
  position = 0,
}) {
  return {
    assessment_assignment_id: assignmentId,
    attempt_id: attemptId,
    test_slug: testSlug,
    required_for_composite: requiredForComposite,
    position,
    attempts: {
      status,
      completed_at: completedAt,
    },
  };
}

function main() {
  const noRequired = buildCompositeReadinessFromLinkedAttempts([]);
  assert.equal(noRequired.status, "no_required_components");
  assert.equal(noRequired.requiredCount, 0);

  const incomplete = buildCompositeReadinessFromLinkedAttempts(
    [
      buildLink({
        attemptId: "attempt-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-01-01T10:00:00.000Z",
        position: 0,
      }),
    ],
    {
      expectedRequiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
    },
  );
  assert.equal(incomplete.status, "incomplete");
  assert.equal(incomplete.requiredCount, 3);
  assert.equal(incomplete.completedCount, 1);
  assert.equal(incomplete.incompleteComponents.length, 2);
  assert.equal(
    incomplete.incompleteComponents.every((component) => component.attempt_status === "missing"),
    true,
  );

  const ready = buildCompositeReadinessFromLinkedAttempts(
    [
      buildLink({
        attemptId: "attempt-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-01-01T10:00:00.000Z",
        position: 0,
      }),
      buildLink({
        attemptId: "attempt-safran",
        testSlug: "safran_v1",
        status: "completed",
        completedAt: "2026-01-01T11:00:00.000Z",
        position: 1,
      }),
      buildLink({
        attemptId: "attempt-mwms",
        testSlug: "mwms_v1",
        status: "completed",
        completedAt: "2026-01-01T12:00:00.000Z",
        position: 2,
      }),
    ],
    {
      expectedRequiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
    },
  );
  assert.equal(ready.status, "ready");
  assert.equal(ready.requiredCount, 3);
  assert.equal(ready.completedCount, 3);

  console.log("Assessment reports readiness helper tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
