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
    request === "@/lib/auth/session" ||
    request === "@/lib/b2b/organizations" ||
    request === "@/lib/assessment/team-assessments" ||
    request === "@/lib/assessment/team-dynamics-action-contract" ||
    request === "@/lib/assessment/team-assessment-execution" ||
    request === "@/lib/assessment/team-assessment-responses"
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
const componentSource = fs.readFileSync(
  path.join(projectRoot, "components", "assessment", "team-dynamics-run-ui-skeleton.tsx"),
  "utf8",
);
const executionSource = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-execution.ts"),
  "utf8",
);

assert.match(actionSource, /export async function completeTeamAssessmentAction/);
assert.match(actionSource, /loadTeamAssessmentExecutionContext/);
assert.match(actionSource, /loadTeamAssessmentQuestionOutline/);
assert.match(actionSource, /loadTeamAssessmentUiOnlyItems/);
assert.match(actionSource, /loadTeamAssessmentCompletionReadinessForContext/);
assert.match(actionSource, /transitionTeamAssessmentExecutionToCompleted/);
assert.doesNotMatch(actionSource, /input\.attemptId/);
assert.doesNotMatch(actionSource, /attempt_reports/);
assert.doesNotMatch(actionSource, /assessment_reports/);
assert.doesNotMatch(actionSource, /orchestrateReportsAfterAttemptCompletion/);
assert.doesNotMatch(actionSource, /persistCompletedAssessmentResults/);
assert.doesNotMatch(actionSource, /score/i);

assert.match(componentSource, /completeTeamAssessmentAction/);
assert.match(componentSource, /Završi procjenu/);
assert.doesNotMatch(componentSource, /AssessmentForm/);
assert.doesNotMatch(componentSource, /attemptId/);

assert.match(executionSource, /export async function transitionTeamAssessmentExecutionToCompleted/);
assert.match(executionSource, /\.from\("attempts"\)/);
assert.match(executionSource, /\.from\("team_assessment_participants"\)/);
assert.doesNotMatch(executionSource, /attempt_reports/);
assert.doesNotMatch(executionSource, /assessment_reports/);

const { completeTeamAssessmentAction } = require("../app/actions/team-assessments.ts");

const startedContext = {
  teamAssessmentParticipantId: "tap-1",
  teamAssessmentAssignmentId: "assignment-1",
  teamMembershipId: "membership-1",
  participantId: "participant-1",
  attemptId: "attempt-1",
  teamId: "team-1",
  organizationId: "org-1",
  packageSlug: "team_dynamics_v1_strong",
  wrapperStatus: "started",
  attemptStatus: "in_progress",
  locale: "bs",
  test: {
    id: "test-team-dynamics",
    slug: "team_dynamics_v1_strong",
    name: "Procjena timske dinamike",
    status: "active",
    isActive: true,
  },
};

const readinessReady = {
  supportedQuestionCount: 2,
  savedValidAnswerCount: 2,
  missingQuestionIds: [],
  invalidSavedAnswerCount: 0,
  isReadyForCompletion: true,
  readinessStatus: "ready",
};

const readinessNotReady = {
  supportedQuestionCount: 2,
  savedValidAnswerCount: 1,
  missingQuestionIds: ["question-2"],
  invalidSavedAnswerCount: 0,
  isReadyForCompletion: false,
  readinessStatus: "not_ready",
};

async function runHappyPath() {
  const calls = {
    questionOutline: 0,
    uiOnlyItems: 0,
    readiness: 0,
    transition: 0,
  };

  const result = await completeTeamAssessmentAction(
    {
      teamAssessmentParticipantId: "tap-1",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: startedContext,
      }),
      loadQuestionOutline: async () => {
        calls.questionOutline += 1;
        return {
          orderedQuestionIds: ["question-1", "question-2"],
          questions: [],
          locale: "bs",
          count: 2,
        };
      },
      loadUiOnlyItems: async () => {
        calls.uiOnlyItems += 1;
        return {
          items: [
            {
              mode: "ui_only_ready",
              questionId: "question-1",
              order: 1,
              localizedTitle: "Q1",
              localizedStem: "Q1",
              optionIds: ["option-1", "option-2"],
              options: [],
              locale: "bs",
              isUiOnlySkeleton: true,
            },
            {
              mode: "ui_only_ready",
              questionId: "question-2",
              order: 2,
              localizedTitle: "Q2",
              localizedStem: "Q2",
              optionIds: ["option-3", "option-4"],
              options: [],
              locale: "bs",
              isUiOnlySkeleton: true,
            },
          ],
          itemCount: 2,
          unsupportedCount: 0,
          mode: "ready",
        };
      },
      resolveShellState: ({ route, wrapperStatus }) => ({
        kind: "run_started",
        route,
        wrapperStatus,
        isRunnable: true,
        shouldTransitionToStarted: false,
        title: "",
        message: "",
      }),
      loadCompletionReadiness: async ({ context, uiOnlyItems }) => {
        calls.readiness += 1;
        assert.equal(context.attemptId, "attempt-1");
        assert.equal(uiOnlyItems.length, 2);
        return readinessReady;
      },
      transitionCompletion: async ({ context }) => {
        calls.transition += 1;
        assert.equal(context.attemptId, "attempt-1");
        return {
          ok: true,
          mode: "completed",
          wrapperStatus: "completed",
          attemptStatus: "completed",
          completedAt: "2026-05-23T10:00:00.000Z",
        };
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    mode: "completed",
    completionReadiness: readinessReady,
  });
  assert.deepEqual(calls, {
    questionOutline: 1,
    uiOnlyItems: 1,
    readiness: 1,
    transition: 1,
  });
}

Promise.resolve()
  .then(async () => {
    await runHappyPath();

    const notReadyResult = await completeTeamAssessmentAction(
      {
        teamAssessmentParticipantId: "tap-1",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => ({
          ok: true,
          context: startedContext,
        }),
        loadQuestionOutline: async () => ({
          orderedQuestionIds: ["question-1", "question-2"],
          questions: [],
          locale: "bs",
          count: 2,
        }),
        loadUiOnlyItems: async () => ({
          items: [
            {
              mode: "ui_only_ready",
              questionId: "question-1",
              order: 1,
              localizedTitle: "Q1",
              localizedStem: "Q1",
              optionIds: ["option-1", "option-2"],
              options: [],
              locale: "bs",
              isUiOnlySkeleton: true,
            },
            {
              mode: "ui_only_ready",
              questionId: "question-2",
              order: 2,
              localizedTitle: "Q2",
              localizedStem: "Q2",
              optionIds: ["option-3", "option-4"],
              options: [],
              locale: "bs",
              isUiOnlySkeleton: true,
            },
          ],
          itemCount: 2,
          unsupportedCount: 0,
          mode: "ready",
        }),
        resolveShellState: ({ route, wrapperStatus }) => ({
          kind: "run_started",
          route,
          wrapperStatus,
          isRunnable: true,
          shouldTransitionToStarted: false,
          title: "",
          message: "",
        }),
        loadCompletionReadiness: async () => readinessNotReady,
        transitionCompletion: async () => {
          throw new Error("transitionCompletion should not run when readiness is false.");
        },
      },
    );

    assert.deepEqual(notReadyResult, {
      ok: false,
      code: "not_ready",
      reason: "Team Dynamics completion readiness is not satisfied.",
      completionReadiness: readinessNotReady,
    });

    const invalidSavedAnswersResult = await completeTeamAssessmentAction(
      {
        teamAssessmentParticipantId: "tap-1",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => ({
          ok: true,
          context: startedContext,
        }),
        loadQuestionOutline: async () => ({
          orderedQuestionIds: ["question-1", "question-2"],
          questions: [],
          locale: "bs",
          count: 2,
        }),
        loadUiOnlyItems: async () => ({
          items: [
            {
              mode: "ui_only_ready",
              questionId: "question-1",
              order: 1,
              localizedTitle: "Q1",
              localizedStem: "Q1",
              optionIds: ["option-1", "option-2"],
              options: [],
              locale: "bs",
              isUiOnlySkeleton: true,
            },
            {
              mode: "ui_only_ready",
              questionId: "question-2",
              order: 2,
              localizedTitle: "Q2",
              localizedStem: "Q2",
              optionIds: ["option-3", "option-4"],
              options: [],
              locale: "bs",
              isUiOnlySkeleton: true,
            },
          ],
          itemCount: 2,
          unsupportedCount: 0,
          mode: "ready",
        }),
        resolveShellState: ({ route, wrapperStatus }) => ({
          kind: "run_started",
          route,
          wrapperStatus,
          isRunnable: true,
          shouldTransitionToStarted: false,
          title: "",
          message: "",
        }),
        loadCompletionReadiness: async () => ({
          ...readinessNotReady,
          invalidSavedAnswerCount: 1,
        }),
        transitionCompletion: async () => {
          throw new Error("transitionCompletion should not run when invalid saved answers block readiness.");
        },
      },
    );

    assert.equal(invalidSavedAnswersResult.ok, false);
    assert.equal(invalidSavedAnswersResult.code, "not_ready");
    assert.equal(invalidSavedAnswersResult.completionReadiness.invalidSavedAnswerCount, 1);

    const accessDeniedResult = await completeTeamAssessmentAction(
      {
        teamAssessmentParticipantId: "tap-2",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => ({
          ok: false,
          code: "wrapper_access_denied",
          message: "Wrapper access denied.",
        }),
      },
    );

    assert.deepEqual(accessDeniedResult, {
      ok: false,
      code: "wrapper_access_denied",
      reason: "Wrapper access denied.",
    });

    const alreadyCompletedResult = await completeTeamAssessmentAction(
      {
        teamAssessmentParticipantId: "tap-1",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => ({
          ok: true,
          context: {
            ...startedContext,
            wrapperStatus: "completed",
            attemptStatus: "completed",
          },
        }),
        loadQuestionOutline: async () => {
          throw new Error("loadQuestionOutline should not run for already completed state.");
        },
        loadUiOnlyItems: async () => {
          throw new Error("loadUiOnlyItems should not run for already completed state.");
        },
        loadCompletionReadiness: async () => {
          throw new Error("loadCompletionReadiness should not run for already completed state.");
        },
        transitionCompletion: async () => {
          throw new Error("transitionCompletion should not run for already completed state.");
        },
      },
    );

    assert.deepEqual(alreadyCompletedResult, {
      ok: true,
      mode: "already_completed",
      completionReadiness: {
        supportedQuestionCount: 0,
        savedValidAnswerCount: 0,
        missingQuestionIds: [],
        invalidSavedAnswerCount: 0,
        isReadyForCompletion: false,
        readinessStatus: "no_supported_items",
      },
    });

    const invitedWrapperResult = await completeTeamAssessmentAction(
      {
        teamAssessmentParticipantId: "tap-1",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => ({
          ok: true,
          context: {
            ...startedContext,
            wrapperStatus: "invited",
          },
        }),
      },
    );

    assert.deepEqual(invitedWrapperResult, {
      ok: false,
      code: "wrapper_not_completable",
      reason: "Team Dynamics wrapper must be started before completion is allowed.",
    });

    const expiredWrapperResult = await completeTeamAssessmentAction(
      {
        teamAssessmentParticipantId: "tap-1",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => ({
          ok: true,
          context: {
            ...startedContext,
            wrapperStatus: "expired",
            attemptStatus: "abandoned",
          },
        }),
      },
    );

    assert.deepEqual(expiredWrapperResult, {
      ok: false,
      code: "wrapper_not_completable",
      reason: "Team Dynamics wrapper must be started before completion is allowed.",
    });

    console.log("test-team-dynamics-completion-action: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
