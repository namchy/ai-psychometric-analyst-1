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
  if (
    request === "server-only" ||
    request === "@/lib/b2b/organizations" ||
    request === "@/lib/assessment/team-assessments" ||
    request === "@/lib/assessment/team-assessment-execution" ||
    request === "@/lib/assessment/team-assessment-score-persistence" ||
    request === "@/lib/assessment/team-assessment-responses" ||
    request === "@/lib/assessment/team-dynamics-action-contract" ||
    request === "@/lib/assessment/team-dynamics-mixed-answer-persistence" ||
    request === "@/lib/assessment/team-dynamics-mixed-completion-readiness" ||
    request === "@/lib/assessment/team-dynamics-mixed-runtime"
  ) {
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

const actionSource = fs.readFileSync(
  path.join(projectRoot, "app", "actions", "team-assessments.ts"),
  "utf8",
);
const actionStart = actionSource.indexOf(
  "export async function completeTeamDynamicsMixedAssessmentAction",
);
const actionBlock = actionStart >= 0 ? actionSource.slice(actionStart) : actionSource;

assert.match(actionSource, /export async function completeTeamDynamicsMixedAssessmentAction/);
assert.match(actionBlock, /loadTeamDynamicsMixedCompletionReadinessForContext/);
assert.match(actionBlock, /loadTeamDynamicsMixedRuntimeHandoff/);
assert.match(actionBlock, /transitionTeamAssessmentExecutionToCompleted/);
assert.match(actionBlock, /TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG/);
assert.doesNotMatch(actionBlock, /input\.attemptId/);
assert.doesNotMatch(actionBlock, /attemptId:/);
assert.doesNotMatch(actionBlock, /AssessmentForm/);
assert.doesNotMatch(actionBlock, /persistTeamAssessmentMinimalScoreForContext/);
assert.doesNotMatch(actionBlock, /team-assessment-aggregation/);
assert.doesNotMatch(actionBlock, /attempt_reports/);
assert.doesNotMatch(actionBlock, /assessment_reports/);
assert.doesNotMatch(actionSource, /deep-profile-todo/);

const { AuthenticationRequiredError } = require("../lib/auth/session.ts");
const {
  completeTeamDynamicsMixedAssessmentAction,
} = require("../app/actions/team-assessments.ts");

const finalContext = {
  teamAssessmentParticipantId: "tap-final-1",
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
    name: "Team Dynamics Final",
    status: "active",
    isActive: true,
  },
};

const runtimeHandoff = {
  testSlug: "team_dynamics_assessment_v1",
  scoringMethod: "mixed_v1",
  items: [],
};

const readinessReady = {
  readinessStatus: "ready",
  isReadyForCompletion: true,
  supportedItemCount: 2,
  savedValidAnswerCount: 2,
  missingQuestionIds: [],
  invalidSavedAnswerCount: 0,
  ignoredStaleAnswerCount: 0,
  likertItemCount: 1,
  sjtItemCount: 1,
  savedLikertAnswerCount: 1,
  savedSjtAnswerCount: 1,
  warnings: [],
};

const readinessNotReady = {
  ...readinessReady,
  readinessStatus: "not_ready",
  isReadyForCompletion: false,
  savedValidAnswerCount: 1,
  missingQuestionIds: ["question-2"],
};

const readinessNoSupportedItems = {
  ...readinessReady,
  readinessStatus: "no_supported_items",
  isReadyForCompletion: false,
  supportedItemCount: 0,
  savedValidAnswerCount: 0,
  missingQuestionIds: [],
  savedLikertAnswerCount: 0,
  savedSjtAnswerCount: 0,
};

async function runNotReadyTest() {
  let transitionCalls = 0;

  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: finalContext,
      }),
      loadMixedRuntimeHandoff: async ({ locale }) => {
        assert.equal(locale, "bs");
        return runtimeHandoff;
      },
      loadMixedCompletionReadiness: async ({ context, runtimeHandoff: handoff }) => {
        assert.equal(context.attemptId, "attempt-1");
        assert.equal(handoff.testSlug, "team_dynamics_assessment_v1");
        return readinessNotReady;
      },
      transitionCompletion: async () => {
        transitionCalls += 1;
        throw new Error("transitionCompletion should not run for not_ready.");
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: "not_ready",
    reason: "Team Dynamics mixed-format completion readiness is not satisfied.",
    teamAssessmentParticipantId: "tap-final-1",
    readinessStatus: "not_ready",
    supportedItemCount: 2,
    savedValidAnswerCount: 1,
    missingQuestionIds: ["question-2"],
  });
  assert.equal(transitionCalls, 0);
}

async function runReadyPathTest() {
  let transitionCalls = 0;

  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: finalContext,
      }),
      loadMixedRuntimeHandoff: async () => runtimeHandoff,
      loadMixedCompletionReadiness: async () => readinessReady,
      transitionCompletion: async ({ context }) => {
        transitionCalls += 1;
        assert.equal(context.attemptId, "attempt-1");
        return {
          ok: true,
          mode: "completed",
          wrapperStatus: "completed",
          attemptStatus: "completed",
          completedAt: "2026-05-27T12:00:00.000Z",
        };
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    status: "completed",
    teamAssessmentParticipantId: "tap-final-1",
    readinessStatus: "ready",
    supportedItemCount: 2,
    savedValidAnswerCount: 2,
    missingQuestionIds: [],
  });
  assert.equal(transitionCalls, 1);
  assert.equal("attemptId" in result, false);
}

async function runAlreadyCompletedTest() {
  let transitionCalls = 0;

  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: {
          ...finalContext,
          wrapperStatus: "completed",
          attemptStatus: "completed",
        },
      }),
      loadMixedRuntimeHandoff: async () => runtimeHandoff,
      loadMixedCompletionReadiness: async () => readinessReady,
      transitionCompletion: async () => {
        transitionCalls += 1;
        throw new Error("transitionCompletion should not run for already_completed.");
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    status: "already_completed",
    teamAssessmentParticipantId: "tap-final-1",
    readinessStatus: "ready",
    supportedItemCount: 2,
    savedValidAnswerCount: 2,
    missingQuestionIds: [],
  });
  assert.equal(transitionCalls, 0);
}

async function runNotRunnableTest() {
  let transitionCalls = 0;

  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: {
          ...finalContext,
          wrapperStatus: "expired",
          attemptStatus: "completed",
        },
      }),
      loadMixedRuntimeHandoff: async () => runtimeHandoff,
      loadMixedCompletionReadiness: async () => readinessReady,
      transitionCompletion: async () => {
        transitionCalls += 1;
        throw new Error("transitionCompletion should not run for not_runnable.");
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: "not_runnable",
    reason: "Team Dynamics mixed-format assessment is not in a completable state.",
    teamAssessmentParticipantId: "tap-final-1",
    readinessStatus: "ready",
    supportedItemCount: 2,
    savedValidAnswerCount: 2,
    missingQuestionIds: [],
  });
  assert.equal(transitionCalls, 0);
}

async function runWrongSlugTest() {
  let runtimeCalls = 0;
  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: {
          ...finalContext,
          packageSlug: "team_dynamics_v1_strong",
          test: {
            ...finalContext.test,
            slug: "team_dynamics_v1_strong",
          },
        },
      }),
      loadMixedRuntimeHandoff: async () => {
        runtimeCalls += 1;
        throw new Error("loadMixedRuntimeHandoff should not run for wrong slug.");
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: "unsupported",
    reason: "This completion action only supports team_dynamics_assessment_v1.",
    teamAssessmentParticipantId: "tap-final-1",
  });
  assert.equal(runtimeCalls, 0);
}

async function runNoSupportedItemsTest() {
  let transitionCalls = 0;
  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: finalContext,
      }),
      loadMixedRuntimeHandoff: async () => runtimeHandoff,
      loadMixedCompletionReadiness: async () => readinessNoSupportedItems,
      transitionCompletion: async () => {
        transitionCalls += 1;
        throw new Error("transitionCompletion should not run for no_supported_items.");
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: "not_ready",
    reason: "Team Dynamics mixed-format completion readiness is not satisfied.",
    teamAssessmentParticipantId: "tap-final-1",
    readinessStatus: "no_supported_items",
    supportedItemCount: 0,
    savedValidAnswerCount: 0,
    missingQuestionIds: [],
  });
  assert.equal(transitionCalls, 0);
}

async function runTransitionFailureTest() {
  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: finalContext,
      }),
      loadMixedRuntimeHandoff: async () => runtimeHandoff,
      loadMixedCompletionReadiness: async () => readinessReady,
      transitionCompletion: async () => ({
        ok: false,
        code: "attempt_transition_failed",
        reason: "Linked Team Dynamics attempt did not transition to completed.",
      }),
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: "not_runnable",
    reason: "Linked Team Dynamics attempt did not transition to completed.",
    teamAssessmentParticipantId: "tap-final-1",
    readinessStatus: "ready",
    supportedItemCount: 2,
    savedValidAnswerCount: 2,
    missingQuestionIds: [],
  });
}

async function runUnauthorizedTest() {
  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => {
        throw new AuthenticationRequiredError();
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: "error",
    reason: "Authentication required.",
    teamAssessmentParticipantId: "tap-final-1",
  });
}

async function runUnexpectedErrorTest() {
  const result = await completeTeamDynamicsMixedAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-final-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => {
        throw new Error("boom");
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: "error",
    reason: "Unable to complete the Team Dynamics assessment right now.",
    teamAssessmentParticipantId: "tap-final-1",
  });
}

Promise.resolve()
  .then(async () => {
    await runNotReadyTest();
    await runReadyPathTest();
    await runAlreadyCompletedTest();
    await runNotRunnableTest();
    await runWrongSlugTest();
    await runNoSupportedItemsTest();
    await runTransitionFailureTest();
    await runUnauthorizedTest();
    await runUnexpectedErrorTest();
  })
  .then(() => {
    console.log("test-team-dynamics-assessment-v1-completion-action: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
