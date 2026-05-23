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
  TEAM_ASSESSMENT_ANSWER_PERSISTENCE_FAILURE_CODES,
  persistValidatedTeamAssessmentAnswer,
} = require("../lib/assessment/team-assessment-responses.ts");

const source = fs.readFileSync(
  path.join(projectRoot, "lib", "assessment", "team-assessment-responses.ts"),
  "utf8",
);

assert.match(source, /export async function persistValidatedTeamAssessmentAnswer/);
assert.match(source, /\.from\("responses"\)/);
assert.doesNotMatch(source, /\.from\("response_selections"\)/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /revalidatePath/);
assert.doesNotMatch(source, /completeAssessmentAttempt/);
assert.doesNotMatch(source, /score/i);
assert.equal(Array.isArray(TEAM_ASSESSMENT_ANSWER_PERSISTENCE_FAILURE_CODES), true);

function createSupabaseStub(initialState = {}) {
  let responseIdCounter = 0;
  const state = {
    questions: [...(initialState.questions ?? [])],
    answer_options: [...(initialState.answer_options ?? [])],
    responses: [...(initialState.responses ?? [])],
    response_selections: [...(initialState.response_selections ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    attempts: [...(initialState.attempts ?? [])],
    team_assessment_participants: [...(initialState.team_assessment_participants ?? [])],
  };

  function applyFilters(rows, filters) {
    return rows.filter((row) => filters.every(([column, value]) => row[column] === value));
  }

  return {
    state,
    from(table) {
      const query = {
        filters: [],
        mode: "select",
        single: false,
        insertRows: null,
        selectOptions: null,
      };

      const builder = {
        select(_columns, options) {
          query.selectOptions = options ?? null;
          if (query.mode !== "insert") {
            query.mode = "select";
          }
          return builder;
        },
        eq(column, value) {
          query.filters.push([column, value]);
          return builder;
        },
        delete() {
          query.mode = "delete";
          return builder;
        },
        insert(rows) {
          query.mode = "insert";
          query.insertRows = Array.isArray(rows) ? rows : [rows];
          return builder;
        },
        single() {
          query.single = true;
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          return { data: rows[0] ?? null, error: null };
        },
        then(resolve, reject) {
          try {
            if (query.mode === "select") {
              const rows = applyFilters(state[table] ?? [], query.filters);
              const result = {
                data: query.selectOptions?.head ? null : rows,
                count: query.selectOptions?.count ? rows.length : null,
                error: null,
              };
              return Promise.resolve(result).then(resolve, reject);
            }

            if (query.mode === "delete") {
              const remainingRows = [];
              const deletedRows = [];

              for (const row of state[table] ?? []) {
                if (query.filters.every(([column, value]) => row[column] === value)) {
                  deletedRows.push(row);
                } else {
                  remainingRows.push(row);
                }
              }

              state[table] = remainingRows;
              return Promise.resolve({ data: deletedRows, error: null }).then(resolve, reject);
            }

            if (query.mode === "insert") {
              const insertedRows = (query.insertRows ?? []).map((row) => {
                responseIdCounter += 1;
                const nextRow = {
                  id: row.id ?? `response-${responseIdCounter}`,
                  ...row,
                };
                state[table].push(nextRow);
                return nextRow;
              });

              const payload = query.single ? insertedRows[0] ?? null : insertedRows;
              return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
            }

            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };

      return builder;
    },
  };
}

const payload = {
  teamAssessmentParticipantId: "tap-1",
  attemptId: "attempt-1",
  questionId: "question-1",
  optionId: "option-1",
  responseFormat: "single_select_likert",
  locale: "bs",
};

const validContextResult = {
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

async function persistWithState(stateOverrides = {}, overrides = {}) {
  const mergedQuestions =
    Object.prototype.hasOwnProperty.call(stateOverrides, "questions")
      ? stateOverrides.questions
      : [
          {
            id: "question-1",
            test_id: "test-team-dynamics",
            question_type: "single_choice",
            is_active: true,
          },
        ];
  const mergedAnswerOptions =
    Object.prototype.hasOwnProperty.call(stateOverrides, "answer_options")
      ? stateOverrides.answer_options
      : [
          {
            id: "option-1",
            question_id: "question-1",
          },
          {
            id: "option-2",
            question_id: "question-1",
          },
        ];
  const supabase = createSupabaseStub({
    questions: mergedQuestions,
    answer_options: mergedAnswerOptions,
    responses: stateOverrides.responses ?? [],
    response_selections: stateOverrides.response_selections ?? [],
    attempt_reports: stateOverrides.attempt_reports ?? [],
    assessment_reports: stateOverrides.assessment_reports ?? [],
    attempts: stateOverrides.attempts ?? [
      {
        id: "attempt-1",
        status: "in_progress",
      },
    ],
    team_assessment_participants: stateOverrides.team_assessment_participants ?? [
      {
        id: "tap-1",
        status: "started",
      },
    ],
  });

  const result = await persistValidatedTeamAssessmentAnswer(
    {
      userId: "user-1",
      payload: {
        ...payload,
        ...(overrides.payload ?? {}),
      },
    },
    {
      supabase,
      loadExecutionContext: async () =>
        overrides.contextResult ?? validContextResult,
    },
  );

  return {
    result,
    state: supabase.state,
  };
}

(async () => {
  const firstSave = await persistWithState();
  assert.equal(firstSave.result.ok, true);
  if (firstSave.result.ok) {
    assert.equal(firstSave.result.mode, "saved");
    assert.equal(firstSave.result.value.optionId, "option-1");
  }
  assert.equal(firstSave.state.responses.length, 1);
  assert.deepEqual(firstSave.state.responses[0], {
    id: "response-1",
    attempt_id: "attempt-1",
    question_id: "question-1",
    response_kind: "single_choice",
    answer_option_id: "option-1",
  });

  const overwriteSave = await persistWithState(
    {
      responses: [
        {
          id: "response-existing",
          attempt_id: "attempt-1",
          question_id: "question-1",
          response_kind: "single_choice",
          answer_option_id: "option-1",
        },
      ],
    },
    {
      payload: {
        optionId: "option-2",
      },
    },
  );
  assert.equal(overwriteSave.result.ok, true);
  if (overwriteSave.result.ok) {
    assert.equal(overwriteSave.result.mode, "overwritten");
  }
  assert.equal(overwriteSave.state.responses.length, 1);
  assert.equal(overwriteSave.state.responses[0].answer_option_id, "option-2");

  const repeatedPayload = await persistWithState({
    responses: [
      {
        id: "response-existing",
        attempt_id: "attempt-1",
        question_id: "question-1",
        response_kind: "single_choice",
        answer_option_id: "option-1",
      },
    ],
  });
  assert.equal(repeatedPayload.result.ok, true);
  if (repeatedPayload.result.ok) {
    assert.equal(repeatedPayload.result.mode, "unchanged");
    assert.equal(repeatedPayload.result.value.responseId, "response-existing");
  }
  assert.equal(repeatedPayload.state.responses.length, 1);
  assert.equal(repeatedPayload.state.responses[0].id, "response-existing");

  const invalidOption = await persistWithState(
    {
      answer_options: [
        {
          id: "option-1",
          question_id: "question-1",
        },
        {
          id: "option-3",
          question_id: "question-2",
        },
      ],
    },
    {
      payload: {
        optionId: "option-3",
      },
    },
  );
  assert.deepEqual(invalidOption.result, {
    ok: false,
    code: "option_question_mismatch",
    reason: "Provided optionId does not belong to the provided questionId.",
  });
  assert.equal(invalidOption.state.responses.length, 0);

  const invalidQuestion = await persistWithState(
    {
      questions: [],
    },
    {
      payload: {
        questionId: "question-unknown",
      },
    },
  );
  assert.deepEqual(invalidQuestion.result, {
    ok: false,
    code: "question_not_in_handoff",
    reason: "Provided questionId does not belong to the active Team Dynamics handoff.",
  });
  assert.equal(invalidQuestion.state.responses.length, 0);

  const invalidFormat = await persistWithState(
    {},
    {
      payload: {
        responseFormat: "single_choice",
      },
    },
  );
  assert.deepEqual(invalidFormat.result, {
    ok: false,
    code: "invalid_response_format",
    reason: 'Only responseFormat "single_select_likert" is supported in this validator.',
  });
  assert.equal(invalidFormat.state.responses.length, 0);

  const completedWrapper = await persistWithState(
    {},
    {
      contextResult: {
        ...validContextResult,
        context: {
          ...validContextResult.context,
          wrapperStatus: "completed",
        },
      },
    },
  );
  assert.deepEqual(completedWrapper.result, {
    ok: false,
    code: "wrapper_not_writable",
    reason: "Team Dynamics wrapper is not in a writable validation state.",
  });
  assert.equal(completedWrapper.state.responses.length, 0);

  const expiredWrapper = await persistWithState(
    {},
    {
      contextResult: {
        ...validContextResult,
        context: {
          ...validContextResult.context,
          wrapperStatus: "expired",
        },
      },
    },
  );
  assert.deepEqual(expiredWrapper.result, {
    ok: false,
    code: "wrapper_not_writable",
    reason: "Team Dynamics wrapper is not in a writable validation state.",
  });
  assert.equal(expiredWrapper.state.responses.length, 0);

  const mismatchedAttempt = await persistWithState(
    {},
    {
      payload: {
        attemptId: "attempt-2",
      },
    },
  );
  assert.deepEqual(mismatchedAttempt.result, {
    ok: false,
    code: "attempt_mismatch",
    reason: "Provided attemptId does not match the wrapper-linked Team Dynamics attempt.",
  });
  assert.equal(mismatchedAttempt.state.responses.length, 0);

  const unsupportedQuestion = await persistWithState(
    {
      questions: [
        {
          id: "question-unsupported",
          test_id: "test-team-dynamics",
          question_type: "multiple_choice",
          is_active: true,
        },
      ],
    },
    {
      payload: {
        questionId: "question-unsupported",
        optionId: "option-1",
      },
    },
  );
  assert.deepEqual(unsupportedQuestion.result, {
    ok: false,
    code: "unsupported_question_format",
    reason: "Only Likert-style single-select Team Dynamics items are supported.",
  });
  assert.equal(unsupportedQuestion.state.responses.length, 0);

  const noOptionsQuestion = await persistWithState(
    {
      answer_options: [],
    },
  );
  assert.deepEqual(noOptionsQuestion.result, {
    ok: false,
    code: "question_missing_options",
    reason: "Team Dynamics question does not have selectable options for this validator.",
  });
  assert.equal(noOptionsQuestion.state.responses.length, 0);

  const noWrapperBoundary = await persistWithState(
    {},
    {
      contextResult: {
        ok: false,
        code: "wrapper_access_denied",
        message: "Team assessment participant wrapper is not owned by this user.",
      },
    },
  );
  assert.deepEqual(noWrapperBoundary.result, {
    ok: false,
    code: "wrapper_access_denied",
    reason: "Team assessment participant wrapper is not owned by this user.",
  });
  assert.equal(noWrapperBoundary.state.responses.length, 0);

  for (const state of [
    firstSave.state,
    overwriteSave.state,
    repeatedPayload.state,
    invalidOption.state,
    invalidQuestion.state,
    invalidFormat.state,
    completedWrapper.state,
    expiredWrapper.state,
    mismatchedAttempt.state,
    unsupportedQuestion.state,
    noOptionsQuestion.state,
    noWrapperBoundary.state,
  ]) {
    assert.equal(state.attempt_reports.length, 0);
    assert.equal(state.assessment_reports.length, 0);
    assert.deepEqual(state.team_assessment_participants, [
      {
        id: "tap-1",
        status: "started",
      },
    ]);
    assert.deepEqual(state.attempts, [
      {
        id: "attempt-1",
        status: "in_progress",
      },
    ]);
  }

  console.log("Team Dynamics response persistence skeleton tests passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
