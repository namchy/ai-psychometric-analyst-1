const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-input.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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

assert.match(helperSource, /INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE/);
assert.match(helperSource, /buildIndividualDevelopmentProfileInputSnapshot/);
assert.match(helperSource, /\.from\("assessment_assignments"\)/);
assert.match(helperSource, /\.from\("participants"\)/);
assert.match(helperSource, /\.from\("assessment_assignment_attempts"\)/);
assert.doesNotMatch(helperSource, /\.from\("assessment_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("attempt_reports"\)/);
assert.doesNotMatch(helperSource, /\.from\("team_fit_reports"\)/);
assert.doesNotMatch(helperSource, /\.insert\(/);
assert.doesNotMatch(helperSource, /\.update\(/);
assert.doesNotMatch(helperSource, /OpenAI|provider|renderer|route|worker|scheduler/i);

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
  buildIndividualDevelopmentProfileInputSnapshot,
} = require(helperPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSupabaseStub(initialState = {}) {
  const state = {
    assessment_assignments: [...(initialState.assessment_assignments ?? [])],
    participants: [...(initialState.participants ?? [])],
    assessment_assignment_attempts: [...(initialState.assessment_assignment_attempts ?? [])],
  };

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === "eq") {
          return row[filter.column] === filter.value;
        }

        return true;
      }),
    );
  }

  return {
    from(table) {
      const query = {
        filters: [],
        mode: "select",
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          query.filters.push({ type: "eq", column, value });
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
        then(resolve, reject) {
          try {
            const rows = applyFilters(state[table] ?? [], query.filters);
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };

      return builder;
    },
  };
}

function buildAssignment(overrides = {}) {
  return {
    id: "assignment-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    assignment_type: "standard_battery",
    status: "active",
    locale: "bs",
    created_at: "2026-06-03T09:00:00.000Z",
    ...overrides,
  };
}

function buildParticipant(overrides = {}) {
  return {
    id: "participant-1",
    organization_id: "org-1",
    full_name: "Amina Candidate",
    ...overrides,
  };
}

function buildLinkedAttempt({
  attemptId,
  testId,
  testSlug,
  position,
  status = "completed",
  completedAt = "2026-06-03T09:30:00.000Z",
}) {
  return {
    assessment_assignment_id: "assignment-1",
    attempt_id: attemptId,
    test_id: testId,
    test_slug: testSlug,
    required_for_composite: true,
    required_for_team_fit: false,
    position,
    attempts: {
      status,
      completed_at: completedAt,
      addressing_form_snapshot: "feminine",
    },
  };
}

function buildIpipResults() {
  const facetScores = [
    ["FRIENDLINESS", 24],
    ["GREGARIOUSNESS", 20],
    ["ASSERTIVENESS", 18],
    ["ACTIVITY_LEVEL", 23],
    ["EXCITEMENT_SEEKING", 17],
    ["CHEERFULNESS", 25],
    ["TRUST", 21],
    ["MORALITY", 22],
    ["ALTRUISM", 23],
    ["COOPERATION", 19],
    ["MODESTY", 18],
    ["SYMPATHY", 24],
    ["SELF_EFFICACY", 25],
    ["ORDERLINESS", 23],
    ["DUTIFULNESS", 24],
    ["ACHIEVEMENT_STRIVING", 22],
    ["SELF_DISCIPLINE", 21],
    ["CAUTIOUSNESS", 20],
    ["ANXIETY", 10],
    ["ANGER", 11],
    ["DEPRESSION", 9],
    ["SELF_CONSCIOUSNESS", 12],
    ["IMMODERATION", 13],
    ["VULNERABILITY", 10],
    ["IMAGINATION", 23],
    ["ARTISTIC_INTERESTS", 22],
    ["EMOTIONALITY", 20],
    ["ADVENTUROUSNESS", 24],
    ["INTELLECT", 25],
    ["LIBERALISM", 21],
  ];

  return {
    attemptId: "attempt-ipip",
    scoringMethod: "likert_sum",
    dimensions: facetScores.map(([dimension, rawScore]) => ({
      dimension,
      rawScore,
      scoredQuestionCount: 6,
    })),
    scoredResponseCount: 120,
    unscoredResponses: [],
  };
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran",
    scoringMethod: "correct_answers",
    dimensions: [],
    scoredResponseCount: 54,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 14,
        figuralScore: 10,
        numericalRawScore: 15,
        numericalAdjustedScore: 12,
        numericalScore: 12,
        numericalSeriesScore: 12,
        cognitiveCompositeScore: 36,
        cognitiveCompositeV1: 36,
      },
    },
  };
}

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms",
    scoringMethod: "likert_sum",
    dimensions: [
      { dimension: "intrinsic", rawScore: 6.2, scoredQuestionCount: 1 },
      { dimension: "identified", rawScore: 5.8, scoredQuestionCount: 1 },
      { dimension: "introjected", rawScore: 3.9, scoredQuestionCount: 1 },
      { dimension: "external_social", rawScore: 3.1, scoredQuestionCount: 1 },
      { dimension: "external_material", rawScore: 4.2, scoredQuestionCount: 1 },
      { dimension: "amotivation", rawScore: 1.8, scoredQuestionCount: 1 },
    ],
    scoredResponseCount: 18,
    unscoredResponses: [],
  };
}

function buildBaseState() {
  return {
    assessment_assignments: [buildAssignment()],
    participants: [buildParticipant()],
    assessment_assignment_attempts: [
      buildLinkedAttempt({
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        position: 0,
      }),
      buildLinkedAttempt({
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        position: 1,
      }),
      buildLinkedAttempt({
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        position: 2,
      }),
    ],
  };
}

function buildScoringStub(overrides = {}) {
  const map = {
    "attempt-ipip": buildIpipResults(),
    "attempt-safran": buildSafranResults(),
    "attempt-mwms": buildMwmsResults(),
    ...overrides,
  };

  return async function calculateCompletedResults(testId, attemptId) {
    if (attemptId in map) {
      const value = map[attemptId];

      if (value instanceof Error) {
        throw value;
      }

      return clone(value);
    }

    return null;
  };
}

function assertNoForbiddenArtifacts(value) {
  const serialized = JSON.stringify(value);
  [
    "\"rawAnswers\"",
    "\"rawResponses\"",
    "\"fullSnapshot\"",
    "\"candidateFacing\"",
    "\"fitScore\"",
    "\"hireRecommendation\"",
    "\"teamFit\"",
    "\"teamDynamics\"",
  ].forEach((needle) => {
    assert.equal(serialized.includes(needle), false, `Found forbidden artifact ${needle}`);
  });
}

async function main() {
  const availableResult = await buildIndividualDevelopmentProfileInputSnapshot(
    {
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
      participantId: "participant-1",
      locale: "bs",
    },
    {
      supabase: createSupabaseStub(buildBaseState()),
      calculateCompletedResults: buildScoringStub(),
    },
  );

  assert.equal(availableResult.ok, true);
  assert.equal(availableResult.inputSnapshot.inputType, INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE);
  assert.equal(availableResult.inputSnapshot.inputVersion, INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION);
  assert.equal(availableResult.inputSnapshot.participant.displayName, "Amina Candidate");
  assert.equal(availableResult.inputSnapshot.sourceSignals.personality.sourceStatus, "available");
  assert.equal(availableResult.inputSnapshot.sourceSignals.motivation.sourceStatus, "available");
  assert.equal(availableResult.inputSnapshot.sourceSignals.problemSolving.sourceStatus, "available");
  assert.equal(availableResult.inputSnapshot.sourceSignals.composite.sourceStatus, "available");
  assert.ok((availableResult.inputSnapshot.sourceSignals.personality.relevantSignals?.length ?? 0) >= 1);
  assert.ok((availableResult.inputSnapshot.sourceSignals.composite.integratedSignals?.length ?? 0) >= 1);
  assertNoForbiddenArtifacts(availableResult.inputSnapshot);

  const partialState = buildBaseState();
  partialState.assessment_assignment_attempts[2] = buildLinkedAttempt({
    attemptId: "attempt-mwms",
    testId: "test-mwms",
    testSlug: "mwms_v1",
    position: 2,
    status: "in_progress",
    completedAt: null,
  });

  const partialResult = await buildIndividualDevelopmentProfileInputSnapshot(
    {
      assessmentAssignmentId: "assignment-1",
    },
    {
      supabase: createSupabaseStub(partialState),
      calculateCompletedResults: buildScoringStub(),
    },
  );

  assert.equal(partialResult.ok, true);
  assert.equal(partialResult.inputSnapshot.sourceSignals.motivation.sourceStatus, "partial");
  assert.equal(partialResult.inputSnapshot.sourceSignals.composite.sourceStatus, "partial");

  const unavailableState = buildBaseState();
  unavailableState.assessment_assignment_attempts = unavailableState.assessment_assignment_attempts.filter(
    (entry) => entry.test_slug !== "safran_v1",
  );

  const unavailableResult = await buildIndividualDevelopmentProfileInputSnapshot(
    {
      assessmentAssignmentId: "assignment-1",
    },
    {
      supabase: createSupabaseStub(unavailableState),
      calculateCompletedResults: buildScoringStub(),
    },
  );

  assert.equal(unavailableResult.ok, true);
  assert.equal(unavailableResult.inputSnapshot.sourceSignals.problemSolving.sourceStatus, "unavailable");
  assert.equal(unavailableResult.inputSnapshot.sourceSignals.composite.sourceStatus, "partial");

  const invalidResult = await buildIndividualDevelopmentProfileInputSnapshot(
    {
      assessmentAssignmentId: "assignment-1",
    },
    {
      supabase: createSupabaseStub(buildBaseState()),
      calculateCompletedResults: buildScoringStub({
        "attempt-ipip": new Error("deterministic_results_failed"),
      }),
    },
  );

  assert.equal(invalidResult.ok, true);
  assert.equal(invalidResult.inputSnapshot.sourceSignals.personality.sourceStatus, "invalid");
  assert.equal(invalidResult.inputSnapshot.sourceSignals.composite.sourceStatus, "invalid");

  const missingAssignmentResult = await buildIndividualDevelopmentProfileInputSnapshot(
    {
      assessmentAssignmentId: "missing-assignment",
    },
    {
      supabase: createSupabaseStub(buildBaseState()),
      calculateCompletedResults: buildScoringStub(),
    },
  );

  assert.equal(missingAssignmentResult.ok, false);
  assert.equal(missingAssignmentResult.reason, "assignment_not_found");

  console.log("test-individual-development-profile-input: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
