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
  buildAssessmentCardsFromTests,
  CURATED_BATTERY_TEST_SLUGS,
  getAssessmentCardProgressState,
  mapInitialAttemptsToDashboardAttempts,
} = require("../lib/dashboard/candidate-dashboard-model.ts");

const dashboardSource = fs.readFileSync(
  path.join(projectRoot, "components", "dashboard", "candidate-dashboard.tsx"),
  "utf8",
);
const appPageSource = fs.readFileSync(
  path.join(projectRoot, "app", "(protected)", "app", "page.tsx"),
  "utf8",
);

assert.match(appPageSource, /initialAttempts=\{initialAttempts\}/);
assert.match(dashboardSource, /getSupabaseBrowserClient/);
assert.match(dashboardSource, /\.from\("tests"\)/);
assert.match(dashboardSource, /\.from\("organization_test_access"\)/);
assert.match(dashboardSource, /\.from\("questions"\)/);
assert.match(dashboardSource, /\.from\("dimension_scores"\)/);
assert.match(dashboardSource, /\.from\("responses"\)/);
assert.match(dashboardSource, /buildAssessmentCardsFromTests/);
assert.match(dashboardSource, /mapInitialAttemptsToDashboardAttempts/);

const tests = [
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
    id: "test-addon",
    slug: "culture-fit-v1",
    name: "Culture Fit",
    category: "behavioral",
    description: "Dodatna procjena",
    status: "active",
    scoring_method: "likert_sum",
    duration_minutes: 12,
    is_active: true,
  },
  {
    id: "test-team-dynamics",
    slug: "team_dynamics_v1_strong",
    name: "Team Dynamics",
    category: "behavioral",
    description: "Ne smije na candidate dashboard",
    status: "active",
    scoring_method: "mixed_v1",
    duration_minutes: 30,
    is_active: true,
  },
];

const accessRows = [{ organization_id: "org-1", test_id: "test-addon" }];
const questionCountsByTestId = new Map([
  ["test-ipip", 120],
  ["test-safran", 45],
  ["test-mwms", 19],
  ["test-addon", 10],
  ["test-team-dynamics", 36],
]);

const mappedAttempt = mapInitialAttemptsToDashboardAttempts([
  {
    id: "attempt-empty",
    test_id: "test-ipip",
    status: "in_progress",
    responseCount: 0,
    started_at: null,
    scored_started_at: null,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
    completed_at: null,
    total_time_seconds: null,
  },
])[0];

assert.equal(mappedAttempt.started_at, "2026-07-01T10:00:00.000Z");
assert.equal(mappedAttempt.tests, null);
assert.equal(mappedAttempt.last_answered_at, null);

const cards = buildAssessmentCardsFromTests(tests, [], accessRows, questionCountsByTestId);

assert.deepEqual(
  cards.slice(0, 3).map((card) => card.testSlug),
  CURATED_BATTERY_TEST_SLUGS,
);
assert.equal(cards.some((card) => card.testSlug === "team_dynamics_v1_strong"), false);
assert.equal(cards.find((card) => card.testSlug === "culture-fit-v1")?.disabled, false);

function requireCard(cardsToSearch, testSlug) {
  const card = cardsToSearch.find((entry) => entry.testSlug === testSlug);
  assert.ok(card, `Expected card for ${testSlug}.`);
  return card;
}

const ipipEmptyCards = buildAssessmentCardsFromTests(
  tests.filter((test) => test.id === "test-ipip"),
  [
    {
      id: "ipip-empty",
      test_id: "test-ipip",
      status: "in_progress",
      responseCount: 0,
      started_at: "2026-07-01T10:00:00.000Z",
      scored_started_at: null,
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:00:00.000Z",
      completed_at: null,
      total_time_seconds: null,
      last_answered_at: null,
      tests: null,
    },
  ],
  [],
  questionCountsByTestId,
);

const ipipEmptyCard = requireCard(ipipEmptyCards, "ipip-neo-120-v1");
assert.equal(ipipEmptyCard.ctaLabel, "Započni procjenu");
assert.equal(ipipEmptyCard.ctaKind, "start");
assert.equal(ipipEmptyCard.href, "/app/attempts/ipip-empty/run");

const ipipPartialCards = buildAssessmentCardsFromTests(
  tests.filter((test) => test.id === "test-ipip"),
  [
    {
      id: "ipip-active",
      test_id: "test-ipip",
      status: "in_progress",
      responseCount: 14,
      started_at: "2026-07-01T10:00:00.000Z",
      scored_started_at: null,
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:30:00.000Z",
      completed_at: null,
      total_time_seconds: null,
      last_answered_at: "2026-07-01T10:30:00.000Z",
      tests: null,
    },
  ],
  [],
  questionCountsByTestId,
);

const ipipPartialCard = requireCard(ipipPartialCards, "ipip-neo-120-v1");
assert.equal(ipipPartialCard.ctaLabel, "Nastavi procjenu");
assert.equal(ipipPartialCard.ctaKind, "resume");
assert.equal(ipipPartialCard.status, "U toku");

const safranScoredCards = buildAssessmentCardsFromTests(
  tests.filter((test) => test.id === "test-safran"),
  [
    {
      id: "safran-scored",
      test_id: "test-safran",
      status: "in_progress",
      responseCount: 0,
      started_at: "2026-07-01T10:00:00.000Z",
      scored_started_at: "2026-07-01T10:05:00.000Z",
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:05:00.000Z",
      completed_at: null,
      total_time_seconds: null,
      last_answered_at: null,
      tests: null,
    },
  ],
  [],
  questionCountsByTestId,
);

const safranScoredCard = requireCard(safranScoredCards, "safran_v1");
assert.equal(safranScoredCard.ctaKind, "resume");
assert.equal(safranScoredCard.href, "/app/attempts/safran-scored/run?mode=scored");

const completedCards = buildAssessmentCardsFromTests(
  tests.filter((test) => test.id === "test-mwms"),
  [
    {
      id: "mwms-complete",
      test_id: "test-mwms",
      status: "completed",
      responseCount: 19,
      started_at: "2026-07-01T10:00:00.000Z",
      scored_started_at: null,
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:30:00.000Z",
      completed_at: "2026-07-01T10:30:00.000Z",
      total_time_seconds: 900,
      last_answered_at: "2026-07-01T10:29:00.000Z",
      tests: null,
    },
  ],
  [],
  questionCountsByTestId,
);

const completedCard = requireCard(completedCards, "mwms_v1");
assert.equal(completedCard.ctaLabel, "Pogledaj rezultate");
assert.equal(completedCard.ctaKind, "report");
assert.equal(completedCard.status, "Završeno");

const completedBeatsNewEmptyCards = buildAssessmentCardsFromTests(
  tests.filter((test) => test.id === "test-safran"),
  [
    {
      id: "safran-completed",
      test_id: "test-safran",
      status: "completed",
      responseCount: 45,
      started_at: "2026-07-01T09:00:00.000Z",
      scored_started_at: null,
      created_at: "2026-07-01T09:00:00.000Z",
      updated_at: "2026-07-01T09:30:00.000Z",
      completed_at: "2026-07-01T09:30:00.000Z",
      total_time_seconds: 1800,
      last_answered_at: "2026-07-01T09:29:00.000Z",
      tests: null,
    },
    {
      id: "safran-new-empty",
      test_id: "test-safran",
      status: "in_progress",
      responseCount: 0,
      started_at: "2026-07-01T11:00:00.000Z",
      scored_started_at: null,
      created_at: "2026-07-01T11:00:00.000Z",
      updated_at: "2026-07-01T11:00:00.000Z",
      completed_at: null,
      total_time_seconds: null,
      last_answered_at: null,
      tests: null,
    },
  ],
  [],
  questionCountsByTestId,
);

const completedBeatsNewEmptyCard = requireCard(completedBeatsNewEmptyCards, "safran_v1");
assert.equal(completedBeatsNewEmptyCard.attemptId, "safran-completed");
assert.equal(completedBeatsNewEmptyCard.ctaKind, "report");

const abandonedCards = buildAssessmentCardsFromTests(
  tests.filter((test) => test.id === "test-ipip"),
  [
    {
      id: "ipip-abandoned",
      test_id: "test-ipip",
      status: "abandoned",
      responseCount: 8,
      started_at: "2026-07-01T08:00:00.000Z",
      scored_started_at: null,
      created_at: "2026-07-01T08:00:00.000Z",
      updated_at: "2026-07-01T08:10:00.000Z",
      completed_at: null,
      total_time_seconds: null,
      last_answered_at: "2026-07-01T08:09:00.000Z",
      tests: null,
    },
  ],
  [],
  questionCountsByTestId,
);

const abandonedCard = requireCard(abandonedCards, "ipip-neo-120-v1");
assert.equal(abandonedCard.ctaKind, "start");
assert.equal(abandonedCard.ctaLabel, "Započni procjenu");
assert.equal(abandonedCard.href, undefined);

assert.deepEqual(
  getAssessmentCardProgressState({
    answeredQuestions: 0,
    totalQuestions: 120,
    ctaKind: "start",
  }),
  {
    answeredQuestions: 0,
    totalQuestions: 120,
    progressPercent: 0,
  },
);

assert.deepEqual(
  getAssessmentCardProgressState({
    answeredQuestions: 23,
    totalQuestions: 120,
    ctaKind: "resume",
  }),
  {
    answeredQuestions: 23,
    totalQuestions: 120,
    progressPercent: 19,
  },
);

assert.deepEqual(
  getAssessmentCardProgressState({
    answeredQuestions: 44,
    totalQuestions: 45,
    ctaKind: "report",
  }),
  {
    answeredQuestions: 44,
    totalQuestions: 45,
    progressPercent: 100,
  },
);

console.log("Candidate dashboard model characterization tests passed.");
