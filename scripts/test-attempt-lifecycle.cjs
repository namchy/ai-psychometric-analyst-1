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
  getAssessmentAttemptLifecycle,
  getSafranScoredRunHref,
  isSafranScoredStartedAttempt,
  selectPrimaryAttemptForTest,
} = require("../lib/assessment/attempt-lifecycle.ts");

assert.equal(
  getAssessmentAttemptLifecycle({
    status: "in_progress",
    responseCount: 0,
    testSlug: "safran_v1",
    scoredStartedAt: null,
  }),
  "not_started",
);

assert.equal(
  getAssessmentAttemptLifecycle({
    status: "in_progress",
    responseCount: 0,
    testSlug: "safran_v1",
    scoredStartedAt: "2026-04-24T12:00:00.000Z",
  }),
  "in_progress",
);

assert.equal(
  getAssessmentAttemptLifecycle({
    status: "in_progress",
    responseCount: 3,
    testSlug: "safran_v1",
    scoredStartedAt: null,
  }),
  "in_progress",
);

assert.equal(
  getAssessmentAttemptLifecycle({
    status: "completed",
    responseCount: 0,
    testSlug: "safran_v1",
    scoredStartedAt: "2026-04-24T12:00:00.000Z",
  }),
  "completed",
);

assert.equal(
  getAssessmentAttemptLifecycle({
    status: "abandoned",
    responseCount: 5,
    testSlug: "safran_v1",
    scoredStartedAt: "2026-04-24T12:00:00.000Z",
  }),
  "abandoned",
);

assert.equal(
  getAssessmentAttemptLifecycle({
    status: "in_progress",
    responseCount: 0,
    testSlug: "ipip-neo-120-v1",
    scoredStartedAt: "2026-04-24T12:00:00.000Z",
  }),
  "not_started",
);

assert.equal(
  isSafranScoredStartedAttempt({
    testSlug: "safran_v1",
    scoredStartedAt: "2026-04-24T12:00:00.000Z",
  }),
  true,
);

assert.equal(getSafranScoredRunHref("attempt-123"), "/app/attempts/attempt-123/run?mode=scored");

const safranAttempts = [
  {
    id: "completed-old",
    test_id: "test-safran",
    status: "completed",
    responseCount: 45,
    scored_started_at: null,
    created_at: "2026-04-23T13:24:00.000Z",
  },
  {
    id: "abandoned-old",
    test_id: "test-safran",
    status: "abandoned",
    responseCount: 0,
    scored_started_at: null,
    created_at: "2026-04-24T08:49:00.000Z",
  },
  {
    id: "in-progress-scored",
    test_id: "test-safran",
    status: "in_progress",
    responseCount: 0,
    scored_started_at: "2026-04-24T09:13:23.368Z",
    created_at: "2026-04-24T09:11:28.294Z",
  },
];

assert.equal(
  selectPrimaryAttemptForTest({
    attempts: safranAttempts,
    testId: "test-safran",
    testSlug: "safran_v1",
  })?.id,
  "in-progress-scored",
);

assert.equal(
  getAssessmentAttemptLifecycle({
    status: "in_progress",
    responseCount: 0,
    testSlug: "safran_v1",
    scoredStartedAt: "2026-04-24T09:13:23.368Z",
  }),
  "in_progress",
);

const ipipAttempts = [
  {
    id: "ipip-not-started",
    test_id: "test-ipip",
    status: "in_progress",
    responseCount: 0,
    scored_started_at: "2026-04-24T09:13:23.368Z",
    created_at: "2026-04-24T09:11:28.294Z",
  },
  {
    id: "ipip-completed",
    test_id: "test-ipip",
    status: "completed",
    responseCount: 120,
    scored_started_at: null,
    created_at: "2026-04-23T09:11:28.294Z",
  },
];

assert.equal(
  selectPrimaryAttemptForTest({
    attempts: ipipAttempts,
    testId: "test-ipip",
    testSlug: "ipip-neo-120-v1",
  })?.id,
  "ipip-not-started",
);

console.log("Attempt lifecycle tests passed.");
