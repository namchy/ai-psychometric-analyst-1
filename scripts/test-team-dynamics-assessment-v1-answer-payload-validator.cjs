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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const source = fs.readFileSync(
  path.join(
    projectRoot,
    "lib",
    "assessment",
    "team-dynamics-mixed-answer-payload-validator.ts",
  ),
  "utf8",
);

assert.match(source, /export async function validateTeamDynamicsMixedAnswerPayload/);
assert.match(source, /export function buildTeamDynamicsMixedAnswerPayloadValidationResult/);
assert.match(source, /TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG/);
assert.match(source, /responseFormat: "single_select_likert" \| "best_worst"/);
assert.match(source, /uniquenessKey/);
assert.match(source, /bestOptionId/);
assert.match(source, /worstOptionId/);
assert.match(source, /resolveTeamAssessmentExecutionShellState/);
assert.doesNotMatch(source, /\.from\("responses"\)/);
assert.doesNotMatch(source, /\.insert\(/);
assert.doesNotMatch(source, /\.update\(/);
assert.doesNotMatch(source, /\.upsert\(/);
assert.doesNotMatch(source, /saveTeamAssessmentAnswerAction/);
assert.doesNotMatch(source, /autosave/i);
assert.doesNotMatch(source, /completeTeamAssessmentAction/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /Team Fit/);
assert.doesNotMatch(source, /report orchestration/i);
assert.doesNotMatch(source, /report generation/i);
assert.doesNotMatch(source, /payload\.attemptId/);

const {
  buildTeamDynamicsMixedAnswerPayloadValidationResult,
  validateTeamDynamicsMixedAnswerPayload,
} = require("../lib/assessment/team-dynamics-mixed-answer-payload-validator.ts");

function createContextResult(overrides = {}) {
  return {
    ok: true,
    context: {
      teamAssessmentParticipantId: "tap-1",
      teamAssessmentAssignmentId: "assignment-1",
      teamMembershipId: "membership-1",
      participantId: "participant-1",
      attemptId: "attempt-1",
      teamId: "team-1",
      organizationId: "org-1",
      packageSlug: "team_dynamics_assessment_v1",
      wrapperStatus: "started",
      attemptStatus: "in_progress",
      locale: "bs",
      test: {
        id: "test-final-1",
        slug: "team_dynamics_assessment_v1",
        name: "Procjena timske dinamike",
        status: "active",
        isActive: true,
      },
      ...overrides,
    },
  };
}

function createRuntimeSnapshot(overrides = {}) {
  return {
    testRow: {
      id: "test-final-1",
      slug: "team_dynamics_assessment_v1",
      scoring_method: "mixed_v1",
      metadata: null,
      ...overrides.testRow,
    },
    dimensionRows: [],
    questionRows: [],
    optionRows: [],
    ...overrides,
  };
}

function createMixedRuntimeHandoff(overrides = {}) {
  const items = [
    {
      questionId: "likert-q1",
      code: "TDM31_01",
      order: 1,
      blockKey: "tdm-31-V1",
      responseFormat: "single_select_likert",
      questionType: "single_choice",
      localizedText: "Likert pitanje",
      metadata: {},
      options: [
        { optionId: "likert-o1", code: "1", label: "1", value: 1, order: 1, metadata: {} },
        { optionId: "likert-o2", code: "2", label: "2", value: 2, order: 2, metadata: {} },
      ],
    },
    {
      questionId: "sjt-q1",
      code: "SJT_TD_01",
      order: 2,
      blockKey: "situational_judgment",
      responseFormat: "best_worst",
      questionType: "multiple_choice",
      localizedText: "SJT scenario",
      metadata: {},
      options: [
        { optionId: "sjt-o1", code: "A", label: "A", value: null, order: 1, metadata: {} },
        { optionId: "sjt-o2", code: "B", label: "B", value: null, order: 2, metadata: {} },
        { optionId: "sjt-o3", code: "C", label: "C", value: null, order: 3, metadata: {} },
      ],
    },
  ];

  return {
    testSlug: "team_dynamics_assessment_v1",
    assessmentKey: "team_dynamics_assessment_v1",
    importMode: "mixed_format_content_spec_v1",
    locale: "bs",
    scoringMethod: "mixed_v1",
    blockCount: 2,
    itemCount: items.length,
    likertItemCount: 1,
    sjtScenarioCount: 1,
    outcomePulseItemCount: 0,
    blocks: [
      {
        blockKey: "tdm-31-V1",
        blockType: "likert",
        displayOrder: 1,
        title: "Likert",
        itemCodes: ["TDM31_01"],
        itemCount: 1,
        metadata: {},
      },
      {
        blockKey: "situational_judgment",
        blockType: "sjt_best_worst",
        displayOrder: 2,
        title: "SJT",
        itemCodes: ["SJT_TD_01"],
        itemCount: 1,
        metadata: {},
      },
    ],
    items,
    unsupportedItems: [],
    warnings: [],
    ...overrides,
  };
}

const happyLikert = buildTeamDynamicsMixedAnswerPayloadValidationResult({
  payload: {
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    optionId: "likert-o2",
    locale: "hr-Latn-HR",
    clientTimestamp: "2026-05-27T10:00:00.000Z",
  },
  contextResult: createContextResult(),
  runtimeSnapshot: createRuntimeSnapshot(),
  mixedRuntimeHandoff: createMixedRuntimeHandoff(),
});

assert.deepEqual(happyLikert, {
  ok: true,
  status: "validated_only",
  value: {
    teamAssessmentParticipantId: "tap-1",
    attemptId: "attempt-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    optionId: "likert-o2",
    locale: "hr",
    clientTimestamp: "2026-05-27T10:00:00.000Z",
    uniquenessKey: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
    },
    testSlug: "team_dynamics_assessment_v1",
    blockKey: "tdm-31-V1",
    itemKind: "likert",
  },
});

const happySjt = buildTeamDynamicsMixedAnswerPayloadValidationResult({
  payload: {
    teamAssessmentParticipantId: "tap-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
    bestOptionId: "sjt-o1",
    worstOptionId: "sjt-o3",
  },
  contextResult: createContextResult(),
  runtimeSnapshot: createRuntimeSnapshot(),
  mixedRuntimeHandoff: createMixedRuntimeHandoff(),
});

assert.deepEqual(happySjt, {
  ok: true,
  status: "validated_only",
  value: {
    teamAssessmentParticipantId: "tap-1",
    attemptId: "attempt-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
    bestOptionId: "sjt-o1",
    worstOptionId: "sjt-o3",
    locale: "bs",
    uniquenessKey: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
    },
    testSlug: "team_dynamics_assessment_v1",
    blockKey: "situational_judgment",
    itemKind: "sjt_best_worst",
  },
});

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "best_worst",
      bestOptionId: "likert-o1",
      worstOptionId: "likert-o2",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "payload responseFormat does not match the runtime item response_format.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "best_worst",
    testSlug: "team_dynamics_assessment_v1",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "optionId is required for single_select_likert items.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    testSlug: null,
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "sjt-o1",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "Provided optionId does not belong to the provided questionId.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    testSlug: "team_dynamics_assessment_v1",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "missing-q",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "Provided questionId was not found in the final Team Dynamics mixed runtime handoff.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "missing-q",
    responseFormat: "single_select_likert",
    testSlug: "team_dynamics_assessment_v1",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
      bestOptionId: "likert-o1",
      worstOptionId: "likert-o2",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "single_select_likert payload must not include bestOptionId or worstOptionId.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    testSlug: null,
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      worstOptionId: "sjt-o3",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "bestOptionId is required for best_worst items.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
    testSlug: null,
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      bestOptionId: "sjt-o1",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "worstOptionId is required for best_worst items.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
    testSlug: null,
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      bestOptionId: "sjt-o1",
      worstOptionId: "sjt-o1",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "bestOptionId and worstOptionId must be different for best_worst items.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
    testSlug: null,
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      bestOptionId: "missing",
      worstOptionId: "sjt-o3",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "Provided bestOptionId does not belong to the provided questionId.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
    testSlug: "team_dynamics_assessment_v1",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      bestOptionId: "sjt-o1",
      worstOptionId: "missing",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "Provided worstOptionId does not belong to the provided questionId.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
    testSlug: "team_dynamics_assessment_v1",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      bestOptionId: "sjt-o1",
      worstOptionId: "sjt-o3",
      optionId: "sjt-o2",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "best_worst payload must not include optionId.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
    testSlug: null,
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
    },
    contextResult: createContextResult({
      wrapperStatus: "completed",
      attemptStatus: "completed",
    }),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "not_runnable",
    reason: "Team Dynamics wrapper is not in a runnable response-validation state.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    testSlug: "team_dynamics_assessment_v1",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
    },
    contextResult: createContextResult({
      wrapperStatus: "expired",
    }),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "not_runnable",
    reason: "Team Dynamics wrapper is not in a runnable response-validation state.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    testSlug: "team_dynamics_assessment_v1",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
    },
    contextResult: createContextResult({
      packageSlug: "team_dynamics_v1_strong",
      test: {
        id: "legacy-test-1",
        slug: "team_dynamics_v1_strong",
        name: "Legacy Team Dynamics",
        status: "active",
        isActive: true,
      },
    }),
    runtimeSnapshot: null,
    mixedRuntimeHandoff: null,
  }),
  {
    ok: false,
    status: "unsupported",
    reason: "This validator only supports team_dynamics_assessment_v1.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    testSlug: "team_dynamics_v1_strong",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot({
      testRow: {
        id: "test-final-1",
        slug: "team_dynamics_assessment_v1",
        scoring_method: "sum_score",
      },
    }),
    mixedRuntimeHandoff: createMixedRuntimeHandoff({
      scoringMethod: "sum_score",
    }),
  }),
  {
    ok: false,
    status: "unsupported",
    reason: 'Final Team Dynamics runtime must use scoring_method "mixed_v1".',
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    testSlug: "team_dynamics_assessment_v1",
  },
);

assert.deepEqual(
  buildTeamDynamicsMixedAnswerPayloadValidationResult({
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
      locale: "de",
    },
    contextResult: createContextResult(),
    runtimeSnapshot: createRuntimeSnapshot(),
    mixedRuntimeHandoff: createMixedRuntimeHandoff(),
  }),
  {
    ok: false,
    status: "invalid",
    reason: "locale must be a supported AssessmentLocale value when provided.",
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
    testSlug: null,
  },
);

Promise.resolve()
  .then(async () => {
    let snapshotCalls = 0;
    const validateRawAttemptIdIgnored = await validateTeamDynamicsMixedAnswerPayload(
      {
        userId: "user-1",
        payload: {
          teamAssessmentParticipantId: "tap-1",
          questionId: "likert-q1",
          responseFormat: "single_select_likert",
          optionId: "likert-o1",
          attemptId: "malicious-attempt-id",
        },
      },
      {
        loadExecutionContext: async () => createContextResult(),
        loadMixedRuntimeDbSnapshot: async () => {
          snapshotCalls += 1;
          return createRuntimeSnapshot();
        },
        buildMixedRuntimeHandoff: () => createMixedRuntimeHandoff(),
      },
    );

    assert.equal(snapshotCalls, 1);
    assert.equal(validateRawAttemptIdIgnored.ok, true);
    assert.equal(validateRawAttemptIdIgnored.value.attemptId, "attempt-1");

    let snapshotLoadedForLegacy = false;
    const legacyResult = await validateTeamDynamicsMixedAnswerPayload(
      {
        userId: "user-1",
        payload: {
          teamAssessmentParticipantId: "tap-1",
          questionId: "likert-q1",
          responseFormat: "single_select_likert",
          optionId: "likert-o1",
        },
      },
      {
        loadExecutionContext: async () =>
          createContextResult({
            packageSlug: "team_dynamics_v1_strong",
            test: {
              id: "legacy-test-1",
              slug: "team_dynamics_v1_strong",
              name: "Legacy Team Dynamics",
              status: "active",
              isActive: true,
            },
          }),
        loadMixedRuntimeDbSnapshot: async () => {
          snapshotLoadedForLegacy = true;
          return createRuntimeSnapshot();
        },
        buildMixedRuntimeHandoff: () => createMixedRuntimeHandoff(),
      },
    );

    assert.equal(snapshotLoadedForLegacy, false);
    assert.deepEqual(legacyResult, {
      ok: false,
      status: "unsupported",
      reason: "This validator only supports team_dynamics_assessment_v1.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      testSlug: "team_dynamics_v1_strong",
    });

    const blockedResult = await validateTeamDynamicsMixedAnswerPayload(
      {
        userId: "user-1",
        payload: {
          teamAssessmentParticipantId: "tap-1",
          questionId: "likert-q1",
          responseFormat: "single_select_likert",
          optionId: "likert-o1",
        },
      },
      {
        loadExecutionContext: async () =>
          createContextResult({
            wrapperStatus: "completed",
            attemptStatus: "completed",
          }),
        loadMixedRuntimeDbSnapshot: async () => createRuntimeSnapshot(),
        buildMixedRuntimeHandoff: () => createMixedRuntimeHandoff(),
      },
    );

    assert.deepEqual(blockedResult, {
      ok: false,
      status: "not_runnable",
      reason: "Team Dynamics wrapper is not in a runnable response-validation state.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      testSlug: "team_dynamics_assessment_v1",
    });

    console.log("test-team-dynamics-assessment-v1-answer-payload-validator: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
