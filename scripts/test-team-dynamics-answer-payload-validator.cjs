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

const {
  TEAM_ASSESSMENT_ANSWER_VALIDATION_FAILURE_CODES,
  buildTeamAssessmentAnswerValidationResult,
  validateTeamAssessmentAnswerPayload,
} = require("../lib/assessment/team-assessment-responses.ts");

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-responses.ts"),
  "utf8",
);

assert.match(source, /export async function validateTeamAssessmentAnswerPayload/);
assert.match(source, /export function buildTeamAssessmentAnswerValidationResult/);
assert.match(source, /responseFormat: "single_select_likert"/);
assert.match(source, /uniquenessKey/);
assert.match(source, /resolveTeamAssessmentExecutionShellState/);
assert.match(source, /\.from\("questions"\)/);
assert.match(source, /\.from\("answer_options"\)/);
assert.doesNotMatch(source, /\.from\("responses"\)/);
assert.doesNotMatch(source, /\.insert\(/);
assert.doesNotMatch(source, /\.update\(/);
assert.doesNotMatch(source, /\.upsert\(/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /completeAssessmentAttempt/);
assert.doesNotMatch(source, /saveAssessmentProgress/);
assert.doesNotMatch(source, /Team Fit/);
assert.equal(Array.isArray(TEAM_ASSESSMENT_ANSWER_VALIDATION_FAILURE_CODES), true);

const payload = {
  teamAssessmentParticipantId: "tap-1",
  attemptId: "attempt-1",
  questionId: "question-1",
  optionId: "option-1",
  responseFormat: "single_select_likert",
  locale: "bs",
  clientTimestamp: "2026-05-23T10:00:00.000Z",
};

const contextResult = {
  ok: true,
  context: {
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
  },
};

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload,
    contextResult,
    question: {
      id: "question-1",
      test_id: "test-team-dynamics",
      question_type: "single_choice",
    },
    option: {
      id: "option-1",
      question_id: "question-1",
    },
    questionHasOptions: true,
  }),
  {
    ok: true,
    mode: "validated_only",
    value: {
      teamAssessmentParticipantId: "tap-1",
      attemptId: "attempt-1",
      questionId: "question-1",
      optionId: "option-1",
      responseFormat: "single_select_likert",
      locale: "bs",
      clientTimestamp: "2026-05-23T10:00:00.000Z",
      uniquenessKey: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "question-1",
      },
    },
  },
);

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload: {
      ...payload,
      optionId: "option-2",
    },
    contextResult,
    question: {
      id: "question-1",
      test_id: "test-team-dynamics",
      question_type: "single_choice",
    },
    option: {
      id: "option-2",
      question_id: "question-2",
    },
    questionHasOptions: true,
  }),
  {
    ok: false,
    code: "option_question_mismatch",
    reason: "Provided optionId does not belong to the provided questionId.",
  },
);

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload,
    contextResult,
    question: {
      id: "question-1",
      test_id: "other-test",
      question_type: "single_choice",
    },
    option: {
      id: "option-1",
      question_id: "question-1",
    },
    questionHasOptions: true,
  }),
  {
    ok: false,
    code: "question_not_in_handoff",
    reason: "Provided questionId does not belong to the active Team Dynamics handoff.",
  },
);

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload: {
      ...payload,
      responseFormat: "single_choice",
    },
    contextResult,
    question: {
      id: "question-1",
      test_id: "test-team-dynamics",
      question_type: "single_choice",
    },
    option: {
      id: "option-1",
      question_id: "question-1",
    },
    questionHasOptions: true,
  }),
  {
    ok: false,
    code: "invalid_response_format",
    reason: 'Only responseFormat "single_select_likert" is supported in this validator.',
  },
);

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload,
    contextResult,
    question: {
      id: "question-1",
      test_id: "test-team-dynamics",
      question_type: "single_choice",
    },
    option: {
      id: "option-1",
      question_id: "question-1",
    },
    questionHasOptions: false,
  }),
  {
    ok: false,
    code: "question_missing_options",
    reason: "Team Dynamics question does not have selectable options for this validator.",
  },
);

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload,
    contextResult,
    question: {
      id: "question-1",
      test_id: "test-team-dynamics",
      question_type: "multiple_choice",
    },
    option: {
      id: "option-1",
      question_id: "question-1",
    },
    questionHasOptions: true,
  }),
  {
    ok: false,
    code: "unsupported_question_format",
    reason: "Only Likert-style single-select Team Dynamics items are supported.",
  },
);

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload,
    contextResult: {
      ok: true,
      context: {
        ...contextResult.context,
        wrapperStatus: "completed",
      },
    },
    question: {
      id: "question-1",
      test_id: "test-team-dynamics",
      question_type: "single_choice",
    },
    option: {
      id: "option-1",
      question_id: "question-1",
    },
    questionHasOptions: true,
  }),
  {
    ok: false,
    code: "wrapper_not_writable",
    reason: "Team Dynamics wrapper is not in a writable validation state.",
  },
);

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload,
    contextResult: {
      ok: true,
      context: {
        ...contextResult.context,
        wrapperStatus: "expired",
      },
    },
    question: {
      id: "question-1",
      test_id: "test-team-dynamics",
      question_type: "single_choice",
    },
    option: {
      id: "option-1",
      question_id: "question-1",
    },
    questionHasOptions: true,
  }),
  {
    ok: false,
    code: "wrapper_not_writable",
    reason: "Team Dynamics wrapper is not in a writable validation state.",
  },
);

assert.deepEqual(
  buildTeamAssessmentAnswerValidationResult({
    payload: {
      ...payload,
      attemptId: "attempt-2",
    },
    contextResult,
    question: {
      id: "question-1",
      test_id: "test-team-dynamics",
      question_type: "single_choice",
    },
    option: {
      id: "option-1",
      question_id: "question-1",
    },
    questionHasOptions: true,
  }),
  {
    ok: false,
    code: "attempt_mismatch",
    reason: "Provided attemptId does not match the wrapper-linked Team Dynamics attempt.",
  },
);

function createSupabaseStub(records) {
  return {
    from(table) {
      const state = {
        table,
        filters: [],
        selectOptions: {},
      };

      const builder = {
        select(_columns, options) {
          state.selectOptions = options ?? {};
          return builder;
        },
        eq(column, value) {
          state.filters.push([column, value]);
          return builder;
        },
        async maybeSingle() {
          let rows = records[table] ?? [];

          for (const [column, value] of state.filters) {
            rows = rows.filter((row) => row[column] === value);
          }

          return {
            data: rows[0] ?? null,
            error: null,
          };
        },
        then(resolve, reject) {
          let rows = records[table] ?? [];

          for (const [column, value] of state.filters) {
            rows = rows.filter((row) => row[column] === value);
          }

          const result = {
            data: state.selectOptions.head ? null : rows,
            count: state.selectOptions.count ? rows.length : null,
            error: null,
          };

          return Promise.resolve(result).then(resolve, reject);
        },
      };

      return builder;
    },
  };
}

(async () => {
  const validationResult = await validateTeamAssessmentAnswerPayload(
    {
      userId: "user-1",
      payload,
    },
    {
      loadExecutionContext: async () => contextResult,
      supabase: createSupabaseStub({
        questions: [
          {
            id: "question-1",
            test_id: "test-team-dynamics",
            question_type: "single_choice",
            is_active: true,
          },
        ],
        answer_options: [
          {
            id: "option-1",
            question_id: "question-1",
          },
          {
            id: "option-2",
            question_id: "question-1",
          },
        ],
      }),
    },
  );

  assert.equal(validationResult.ok, true);
  if (validationResult.ok) {
    assert.equal(validationResult.mode, "validated_only");
    assert.deepEqual(validationResult.value.uniquenessKey, {
      teamAssessmentParticipantId: "tap-1",
      questionId: "question-1",
    });
  }

  const rawAttemptWithoutWrapperBoundary = await validateTeamAssessmentAnswerPayload(
    {
      userId: "user-1",
      payload,
    },
    {
      loadExecutionContext: async () => ({
        ok: false,
        code: "wrapper_access_denied",
        message: "Team assessment participant wrapper is not owned by this user.",
      }),
      supabase: createSupabaseStub({
        questions: [],
        answer_options: [],
      }),
    },
  );

  assert.deepEqual(rawAttemptWithoutWrapperBoundary, {
    ok: false,
    code: "wrapper_access_denied",
    reason: "Team assessment participant wrapper is not owned by this user.",
  });

  console.log("Team Dynamics answer payload validator tests passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
