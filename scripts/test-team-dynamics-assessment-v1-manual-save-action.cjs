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
    request === "@/lib/assessment/team-dynamics-action-contract"
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
const mixedActionStart = actionSource.indexOf("export async function saveTeamDynamicsMixedAnswerAction");
const mixedActionEnd = actionSource.indexOf("export async function completeTeamAssessmentAction");
const mixedActionSource =
  mixedActionStart >= 0 && mixedActionEnd > mixedActionStart
    ? actionSource.slice(mixedActionStart, mixedActionEnd)
    : actionSource;

assert.match(actionSource, /export async function saveTeamDynamicsMixedAnswerAction/);
assert.match(mixedActionSource, /persistValidatedTeamDynamicsMixedAnswer/);
assert.match(mixedActionSource, /requireAuthenticatedUserForAction/);
assert.doesNotMatch(mixedActionSource, /input\.attemptId/);
assert.doesNotMatch(mixedActionSource, /attemptId:/);
assert.doesNotMatch(mixedActionSource, /\/app\/attempts\/\[attemptId\]\/run/);
assert.doesNotMatch(mixedActionSource, /AssessmentForm/);
assert.doesNotMatch(mixedActionSource, /deep-profile-todo/);
assert.doesNotMatch(mixedActionSource, /transitionTeamAssessmentExecutionToCompleted/);
assert.doesNotMatch(mixedActionSource, /persistTeamAssessmentMinimalScoreForContext/);

const {
  AuthenticationRequiredError,
} = require("../lib/auth/session.ts");
const {
  saveTeamDynamicsMixedAnswerAction,
} = require("../app/actions/team-assessments.ts");

async function runLikertSuccessTest(status) {
  const persistCalls = [];
  const result = await saveTeamDynamicsMixedAnswerAction(
    {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
      locale: "bs",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      persistMixedAnswer: async (input) => {
        persistCalls.push(input);
        return {
          ok: true,
          status,
          value: {
            teamAssessmentParticipantId: "tap-1",
            questionId: "likert-q1",
            responseFormat: "single_select_likert",
            optionId: "likert-o1",
            uniquenessKey: {
              teamAssessmentParticipantId: "tap-1",
              questionId: "likert-q1",
            },
            responseId: "response-1",
          },
        };
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    status,
    teamAssessmentParticipantId: "tap-1",
    questionId: "likert-q1",
    responseFormat: "single_select_likert",
  });
  assert.equal(persistCalls.length, 1);
  assert.deepEqual(persistCalls[0], {
    userId: "user-1",
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
      locale: "bs",
    },
  });
}

async function runSjtSuccessTest(status) {
  const persistCalls = [];
  const result = await saveTeamDynamicsMixedAnswerAction(
    {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      bestOptionId: "sjt-o1",
      worstOptionId: "sjt-o3",
      locale: "bs",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      persistMixedAnswer: async (input) => {
        persistCalls.push(input);
        return {
          ok: true,
          status,
          value: {
            teamAssessmentParticipantId: "tap-1",
            questionId: "sjt-q1",
            responseFormat: "best_worst",
            bestOptionId: "sjt-o1",
            worstOptionId: "sjt-o3",
            uniquenessKey: {
              teamAssessmentParticipantId: "tap-1",
              questionId: "sjt-q1",
            },
            responseId: "response-2",
          },
        };
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    status,
    teamAssessmentParticipantId: "tap-1",
    questionId: "sjt-q1",
    responseFormat: "best_worst",
  });
  assert.equal(persistCalls.length, 1);
  assert.deepEqual(persistCalls[0], {
    userId: "user-1",
    payload: {
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      bestOptionId: "sjt-o1",
      worstOptionId: "sjt-o3",
      locale: "bs",
    },
  });
}

Promise.resolve()
  .then(async () => {
    await runLikertSuccessTest("saved");
    await runLikertSuccessTest("unchanged");
    await runLikertSuccessTest("overwritten");

    await runSjtSuccessTest("saved");
    await runSjtSuccessTest("unchanged");
    await runSjtSuccessTest("overwritten");

    let persistCalls = 0;
    const invalidLikertPayload = await saveTeamDynamicsMixedAnswerAction(
      {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        persistMixedAnswer: async () => {
          persistCalls += 1;
          throw new Error("persistMixedAnswer should not run for invalid Likert payload.");
        },
      },
    );

    assert.deepEqual(invalidLikertPayload, {
      ok: false,
      status: "invalid",
      reason: "optionId is required for single_select_likert answers.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
    });
    assert.equal(persistCalls, 0);

    const invalidSjtPayload = await saveTeamDynamicsMixedAnswerAction(
      {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o1",
        worstOptionId: "",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        persistMixedAnswer: async () => {
          throw new Error("persistMixedAnswer should not run for invalid SJT payload.");
        },
      },
    );

    assert.deepEqual(invalidSjtPayload, {
      ok: false,
      status: "invalid",
      reason: "bestOptionId and worstOptionId are required for best_worst answers.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
    });

    const invalidPersistenceResult = await saveTeamDynamicsMixedAnswerAction(
      {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o1",
        worstOptionId: "sjt-o1",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        persistMixedAnswer: async () => ({
          ok: false,
          status: "invalid",
          reason: "bestOptionId and worstOptionId must be different for best_worst items.",
          teamAssessmentParticipantId: "tap-1",
          questionId: "sjt-q1",
          responseFormat: "best_worst",
          uniquenessKey: {
            teamAssessmentParticipantId: "tap-1",
            questionId: "sjt-q1",
          },
        }),
      },
    );

    assert.deepEqual(invalidPersistenceResult, {
      ok: false,
      status: "invalid",
      reason: "bestOptionId and worstOptionId must be different for best_worst items.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
    });

    const notRunnableResult = await saveTeamDynamicsMixedAnswerAction(
      {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o1",
        worstOptionId: "sjt-o3",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        persistMixedAnswer: async () => ({
          ok: false,
          status: "not_runnable",
          reason: "Team Dynamics wrapper is not in a runnable response-validation state.",
          teamAssessmentParticipantId: "tap-1",
          questionId: "sjt-q1",
          responseFormat: "best_worst",
          uniquenessKey: {
            teamAssessmentParticipantId: "tap-1",
            questionId: "sjt-q1",
          },
        }),
      },
    );

    assert.deepEqual(notRunnableResult, {
      ok: false,
      status: "not_runnable",
      reason: "Team Dynamics wrapper is not in a runnable response-validation state.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
    });

    const unauthorizedResult = await saveTeamDynamicsMixedAnswerAction(
      {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o1",
      },
      {
        requireUser: async () => {
          throw new AuthenticationRequiredError();
        },
        persistMixedAnswer: async () => {
          throw new Error("persistMixedAnswer should not run for unauthorized requests.");
        },
      },
    );

    assert.deepEqual(unauthorizedResult, {
      ok: false,
      status: "error",
      reason: "Authentication required.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
    });

    const unknownErrorResult = await saveTeamDynamicsMixedAnswerAction(
      {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o1",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        persistMixedAnswer: async () => {
          throw new Error("db unavailable");
        },
      },
    );

    assert.deepEqual(unknownErrorResult, {
      ok: false,
      status: "error",
      reason: "Unable to save the Team Dynamics answer right now.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
    });

    console.log("test-team-dynamics-assessment-v1-manual-save-action: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
