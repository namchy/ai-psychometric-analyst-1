const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;

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

const dashboardSource = fs.readFileSync(
  path.join(projectRoot, "components", "dashboard", "candidate-dashboard.tsx"),
  "utf8",
);
const appPageSource = fs.readFileSync(
  path.join(projectRoot, "app", "(protected)", "app", "page.tsx"),
  "utf8",
);
const dashboardDataSource = fs.readFileSync(
  path.join(projectRoot, "lib", "dashboard", "candidate-dashboard-data.ts"),
  "utf8",
);

assert.doesNotMatch(dashboardSource, /getSupabaseBrowserClient/);
assert.doesNotMatch(dashboardSource, /loadDashboardData/);
assert.doesNotMatch(dashboardSource, /\.from\("tests"\)/);
assert.doesNotMatch(dashboardSource, /\.from\("organization_test_access"\)/);
assert.doesNotMatch(dashboardSource, /\.from\("questions"\)/);
assert.doesNotMatch(dashboardSource, /\.from\("dimension_scores"\)/);
assert.doesNotMatch(dashboardSource, /\.from\("responses"\)/);
assert.match(dashboardSource, /preparedDashboardData: CandidateDashboardPreparedData/);
assert.match(dashboardSource, /dashboardLoadError: boolean/);
assert.match(dashboardSource, /DashboardUnavailableState/);
assert.match(appPageSource, /getCandidateDashboardData/);
assert.match(appPageSource, /preparedDashboardData=\{preparedDashboardData\}/);
assert.match(appPageSource, /dashboardLoadError=\{dashboardLoadError\}/);
assert.match(appPageSource, /dashboardLoadError = true/);
assert.match(dashboardDataSource, /buildAssessmentCardsFromTests/);
assert.match(dashboardDataSource, /mapInitialAttemptsToDashboardAttempts/);

const queryLog = [];
const tables = {
  tests: [
    {
      id: "test-ipip",
      slug: "ipip-neo-120-v1",
      name: "IPIP-NEO-120",
      category: "personality",
      description: "IPIP opis",
      status: "active",
      scoring_method: "likert_mean",
      duration_minutes: 20,
      is_active: true,
    },
    {
      id: "test-safran",
      slug: "safran_v1",
      name: "SAFRAN",
      category: "cognitive",
      description: "SAFRAN opis",
      status: "active",
      scoring_method: "correct_answers",
      duration_minutes: 15,
      is_active: true,
    },
    {
      id: "test-mwms",
      slug: "mwms_v1",
      name: "MWMS",
      category: "behavioral",
      description: "MWMS opis",
      status: "active",
      scoring_method: "likert_sum",
      duration_minutes: 5,
      is_active: true,
    },
  ],
  organization_test_access: [
    { organization_id: "org-1", test_id: "test-ipip" },
    { organization_id: "org-1", test_id: "test-safran" },
    { organization_id: "org-1", test_id: "test-mwms" },
  ],
  questions: Array.from({ length: 120 }, () => ({ test_id: "test-ipip" }))
    .concat(Array.from({ length: 45 }, () => ({ test_id: "test-safran" })))
    .concat(Array.from({ length: 19 }, () => ({ test_id: "test-mwms" }))),
  dimension_scores: [
    { attempt_id: "attempt-completed", normalized_score: 88 },
    { attempt_id: "attempt-active", normalized_score: 71 },
  ],
  responses: [
    { attempt_id: "attempt-active", answered_at: "2026-07-01T10:15:00.000Z" },
    { attempt_id: "attempt-active", answered_at: "2026-07-01T10:25:00.000Z" },
    { attempt_id: "attempt-completed", answered_at: "2026-07-01T09:55:00.000Z" },
  ],
};

function createQueryBuilder(table) {
  const result = { data: tables[table] ?? [], error: null };

  return {
    select(value) {
      queryLog.push({ table, method: "select", value });
      return this;
    },
    order(column, options) {
      queryLog.push({ table, method: "order", column, options });
      return this;
    },
    eq(column, value) {
      queryLog.push({ table, method: "eq", column, value });
      return this;
    },
    in(column, value) {
      queryLog.push({ table, method: "in", column, value });
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

const fakeSupabase = {
  from(table) {
    queryLog.push({ table, method: "from" });
    return createQueryBuilder(table);
  },
};

Module._load = function load(request, parent, isMain) {
  if (request === "@/lib/supabase/admin") {
    return {
      createSupabaseAdminClient() {
        return fakeSupabase;
      },
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const {
  buildAssessmentCardsFromTests,
  mapInitialAttemptsToDashboardAttempts,
} = require("../lib/dashboard/candidate-dashboard-model.ts");
const {
  getCandidateDashboardData,
  getEmptyCandidateDashboardData,
} = require("../lib/dashboard/candidate-dashboard-data.ts");

const attempts = [
  {
    id: "attempt-active",
    test_id: "test-ipip",
    locale: "bs",
    user_id: "user-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    status: "in_progress",
    lifecycle: "in_progress",
    started_at: "2026-07-01T10:00:00.000Z",
    scored_started_at: null,
    completed_at: null,
    total_time_seconds: null,
    responseCount: 14,
    tests: { slug: "ipip-neo-120-v1", name: "IPIP", description: null, duration_minutes: 20 },
    participants: null,
    organizations: null,
  },
  {
    id: "attempt-completed",
    test_id: "test-safran",
    locale: "bs",
    user_id: "user-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    status: "completed",
    lifecycle: "completed",
    started_at: "2026-07-01T09:00:00.000Z",
    scored_started_at: "2026-07-01T09:10:00.000Z",
    completed_at: "2026-07-01T10:00:00.000Z",
    total_time_seconds: 3600,
    responseCount: 45,
    tests: { slug: "safran_v1", name: "SAFRAN", description: null, duration_minutes: 15 },
    participants: null,
    organizations: null,
  },
];

(async () => {
  const emptyPrepared = await getCandidateDashboardData({
    attempts: [],
    organizationId: "org-1",
  });

  assert.deepEqual(
    emptyPrepared,
    {
      assessments: buildAssessmentCardsFromTests(
        tables.tests,
        [],
        tables.organization_test_access,
        new Map([
          ["test-ipip", 120],
          ["test-safran", 45],
          ["test-mwms", 19],
        ]),
      ),
      completedAttempts: 0,
      totalPaidTestsCount: 3,
      totalTimeSeconds: 0,
      averageNormalizedScore: 0,
    },
  );

  const prepared = await getCandidateDashboardData({
    attempts,
    organizationId: "org-1",
  });

  const initialAttempts = attempts.map((attempt) => ({
    id: attempt.id,
    test_id: attempt.test_id,
    status: attempt.status,
    responseCount: attempt.responseCount,
    started_at: attempt.started_at,
    scored_started_at: attempt.scored_started_at,
    created_at: attempt.started_at,
    updated_at: attempt.completed_at ?? attempt.started_at,
    completed_at: attempt.completed_at,
    total_time_seconds: attempt.total_time_seconds,
  }));
  const mappedAttempts = mapInitialAttemptsToDashboardAttempts(initialAttempts).map((attempt) => ({
    ...attempt,
    last_answered_at:
      attempt.id === "attempt-active"
        ? "2026-07-01T10:25:00.000Z"
        : attempt.id === "attempt-completed"
          ? "2026-07-01T09:55:00.000Z"
          : null,
  }));
  const questionCountsByTestId = new Map([
    ["test-ipip", 120],
    ["test-safran", 45],
    ["test-mwms", 19],
  ]);
  const expectedAssessments = buildAssessmentCardsFromTests(
    tables.tests,
    mappedAttempts,
    tables.organization_test_access,
    questionCountsByTestId,
  );

  assert.deepEqual(
    prepared.assessments,
    expectedAssessments,
  );
  assert.equal(prepared.completedAttempts, 1);
  assert.equal(prepared.totalPaidTestsCount, 3);
  assert.equal(prepared.totalTimeSeconds, 3600);
  assert.equal(prepared.averageNormalizedScore, 79.5);
  assert.deepEqual(
    queryLog.filter((entry) => entry.method === "from").map((entry) => entry.table),
    [
      "tests",
      "organization_test_access",
      "questions",
      "tests",
      "organization_test_access",
      "questions",
      "dimension_scores",
      "responses",
    ],
  );

  const failureFallback = getEmptyCandidateDashboardData();
  assert.deepEqual(failureFallback, {
    assessments: [],
    completedAttempts: 0,
    totalPaidTestsCount: 0,
    totalTimeSeconds: 0,
    averageNormalizedScore: 0,
  });
  assert.notDeepEqual(failureFallback, emptyPrepared);

  Module._load = originalLoad;
  console.log("Candidate dashboard server read-model tests passed.");
})().catch((error) => {
  Module._load = originalLoad;
  console.error(error);
  process.exitCode = 1;
});
