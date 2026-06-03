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

const source = fs.readFileSync(
  path.join(projectRoot, "app", "actions", "team-assessments.ts"),
  "utf8",
);
const componentSource = fs.readFileSync(
  path.join(projectRoot, "components", "assessment", "team-dynamics-run-ui-skeleton.tsx"),
  "utf8",
);

assert.match(source, /export async function saveTeamAssessmentAnswerAction/);
assert.match(source, /export async function completeTeamAssessmentAction/);
assert.match(source, /persistValidatedTeamAssessmentAnswer/);
assert.match(source, /loadTeamAssessmentExecutionContext/);
assert.match(source, /responseFormat: "single_select_likert"/);
assert.match(source, /attemptId: contextResult\.context\.attemptId/);
assert.doesNotMatch(source, /input\.attemptId/);
assert.doesNotMatch(source, /\/app\/attempts\/\[attemptId\]\/run/);
assert.doesNotMatch(source, /revalidatePath/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /score/i);
assert.doesNotMatch(source, /completeAssessmentAttempt/);

assert.match(componentSource, /saveTeamAssessmentAnswerAction/);
assert.match(componentSource, /completeTeamAssessmentAction/);
assert.match(componentSource, /Spremi odgovor/);
assert.match(componentSource, /Završi procjenu/);
assert.match(componentSource, /disabled=\{isSaveDisabled\}/);
assert.match(componentSource, /Nema autosave-a, save-on-selecta,/);
assert.doesNotMatch(componentSource, /AssessmentForm/);
assert.doesNotMatch(componentSource, /attemptId/);

const {
  saveTeamAssessmentAnswerAction,
} = require("../app/actions/team-assessments.ts");

async function runSuccessModeTest(mode) {
  const persistCalls = [];
  const result = await saveTeamAssessmentAnswerAction(
    {
      teamAssessmentParticipantId: "tap-1",
      questionId: "question-1",
      optionId: "option-1",
      locale: "bs",
    },
    {
      requireUser: async () => ({ id: "user-1" }),
      loadExecutionContext: async () => ({
        ok: true,
        context: {
          attemptId: "attempt-1",
        },
      }),
      persistAnswer: async (input) => {
        persistCalls.push(input);
        return {
          ok: true,
          mode,
          value: {
            ...input.payload,
            uniquenessKey: {
              teamAssessmentParticipantId: "tap-1",
              questionId: "question-1",
            },
            responseId: "response-1",
          },
        };
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
    mode,
  });
  assert.equal(persistCalls.length, 1);
  assert.deepEqual(persistCalls[0], {
    userId: "user-1",
    payload: {
      teamAssessmentParticipantId: "tap-1",
      attemptId: "attempt-1",
      questionId: "question-1",
      optionId: "option-1",
      responseFormat: "single_select_likert",
      locale: "bs",
    },
  });
}

Promise.resolve()
  .then(async () => {
    await runSuccessModeTest("saved");
    await runSuccessModeTest("overwritten");
    await runSuccessModeTest("unchanged");

    let persistCalls = 0;
    const invalidPayloadResult = await saveTeamAssessmentAnswerAction(
      {
        teamAssessmentParticipantId: "",
        questionId: "question-1",
        optionId: "option-1",
        locale: "bs",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => {
          throw new Error("loadExecutionContext should not run for invalid payload.");
        },
        persistAnswer: async () => {
          persistCalls += 1;
          throw new Error("persistAnswer should not run for invalid payload.");
        },
      },
    );

    assert.deepEqual(invalidPayloadResult, {
      ok: false,
      code: "invalid_payload",
      reason: "teamAssessmentParticipantId, questionId and optionId are required.",
    });
    assert.equal(persistCalls, 0);

    const contextFailureResult = await saveTeamAssessmentAnswerAction(
      {
        teamAssessmentParticipantId: "tap-1",
        questionId: "question-1",
        optionId: "option-1",
        locale: "bs",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => ({
          ok: false,
          code: "wrapper_access_denied",
          message: "Wrapper access denied.",
        }),
        persistAnswer: async () => {
          throw new Error("persistAnswer should not run when wrapper context fails.");
        },
      },
    );

    assert.deepEqual(contextFailureResult, {
      ok: false,
      code: "wrapper_access_denied",
      reason: "Wrapper access denied.",
    });

    const persistFailureResult = await saveTeamAssessmentAnswerAction(
      {
        teamAssessmentParticipantId: "tap-1",
        questionId: "question-1",
        optionId: "option-9",
        locale: "bs",
      },
      {
        requireUser: async () => ({ id: "user-1" }),
        loadExecutionContext: async () => ({
          ok: true,
          context: {
            attemptId: "attempt-1",
          },
        }),
        persistAnswer: async () => ({
          ok: false,
          code: "option_question_mismatch",
          reason: "Provided optionId does not belong to the provided questionId.",
        }),
      },
    );

    assert.deepEqual(persistFailureResult, {
      ok: false,
      code: "option_question_mismatch",
      reason: "Provided optionId does not belong to the provided questionId.",
    });

    console.log("test-team-dynamics-manual-save-action: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
