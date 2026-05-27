const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260527094919_add_best_worst_response_storage.sql",
);
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
  path.join(projectRoot, "lib", "assessment", "team-dynamics-mixed-answer-persistence.ts"),
  "utf8",
);
const migrationSource = fs.readFileSync(migrationPath, "utf8");

assert.match(source, /export async function persistValidatedTeamDynamicsMixedAnswer/);
assert.match(source, /validateTeamDynamicsMixedAnswerPayload/);
assert.match(source, /\.from\("responses"\)/);
assert.match(source, /\.from\("response_selections"\)/);
assert.match(source, /response_kind: "best_worst"/);
assert.match(source, /selection_role: "best"/);
assert.match(source, /selection_role: "worst"/);
assert.doesNotMatch(source, /AssessmentForm/);
assert.doesNotMatch(source, /saveTeamAssessmentAnswerAction/);
assert.doesNotMatch(source, /completeTeamAssessmentAction/);
assert.doesNotMatch(source, /attempt_reports/);
assert.doesNotMatch(source, /assessment_reports/);
assert.doesNotMatch(source, /score/i);
assert.doesNotMatch(source, /aggregation/i);
assert.doesNotMatch(source, /AI\/report/i);
assert.doesNotMatch(source, /deep-profile-todo/);

assert.match(migrationSource, /add column if not exists selection_role text/);
assert.match(migrationSource, /response_kind in \('single_choice', 'multiple_choice', 'text', 'best_worst'\)/);
assert.match(
  migrationSource,
  /\(response_kind = 'best_worst' and answer_option_id is null and text_value is null\)/,
);
assert.match(
  migrationSource,
  /check \(selection_role in \('best', 'worst'\) or selection_role is null\)/,
);
assert.match(
  migrationSource,
  /create unique index if not exists idx_response_selections_response_id_selection_role_unique/,
);
assert.match(migrationSource, /where selection_role is not null/);

const {
  persistValidatedTeamDynamicsMixedAnswer,
} = require("../lib/assessment/team-dynamics-mixed-answer-persistence.ts");

function createSupabaseStub(initialState = {}) {
  let responseIdCounter = 0;
  const state = {
    responses: [...(initialState.responses ?? [])],
    response_selections: [...(initialState.response_selections ?? [])],
    attempt_reports: [...(initialState.attempt_reports ?? [])],
    assessment_reports: [...(initialState.assessment_reports ?? [])],
    dimension_scores: [...(initialState.dimension_scores ?? [])],
  };
  const operations = [];

  function applyFilters(rows, filters) {
    return rows.filter((row) => filters.every(([column, value]) => row[column] === value));
  }

  return {
    state,
    operations,
    from(table) {
      const query = {
        table,
        mode: "select",
        filters: [],
        insertRows: null,
        updateRow: null,
        single: false,
      };

      const builder = {
        select() {
          if (query.mode !== "insert" && query.mode !== "update") {
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
        update(row) {
          query.mode = "update";
          query.updateRow = row;
          return builder;
        },
        single() {
          query.single = true;
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(state[table] ?? [], query.filters);
          operations.push({ table, mode: "maybeSingle", filters: [...query.filters] });
          return { data: rows[0] ?? null, error: null };
        },
        then(resolve, reject) {
          try {
            operations.push({
              table,
              mode: query.mode,
              filters: [...query.filters],
              insertRows: query.insertRows ? [...query.insertRows] : null,
              updateRow: query.updateRow ? { ...query.updateRow } : null,
            });

            if (query.mode === "select") {
              return Promise.resolve({
                data: applyFilters(state[table] ?? [], query.filters),
                error: null,
              }).then(resolve, reject);
            }

            if (query.mode === "delete") {
              const keptRows = [];
              const deletedRows = [];

              for (const row of state[table] ?? []) {
                if (query.filters.every(([column, value]) => row[column] === value)) {
                  deletedRows.push(row);
                } else {
                  keptRows.push(row);
                }
              }

              state[table] = keptRows;
              return Promise.resolve({ data: deletedRows, error: null }).then(resolve, reject);
            }

            if (query.mode === "insert") {
              const insertedRows = (query.insertRows ?? []).map((row) => {
                const nextRow = {
                  ...row,
                };

                if (table === "responses" && !("id" in nextRow)) {
                  responseIdCounter += 1;
                  nextRow.id = `response-${responseIdCounter}`;
                }

                state[table].push(nextRow);
                return nextRow;
              });

              return Promise.resolve({
                data: query.single ? insertedRows[0] ?? null : insertedRows,
                error: null,
              }).then(resolve, reject);
            }

            if (query.mode === "update") {
              const updatedRows = [];

              state[table] = (state[table] ?? []).map((row) => {
                if (query.filters.every(([column, value]) => row[column] === value)) {
                  const nextRow = {
                    ...row,
                    ...(query.updateRow ?? {}),
                  };
                  updatedRows.push(nextRow);
                  return nextRow;
                }

                return row;
              });

              return Promise.resolve({
                data: query.single ? updatedRows[0] ?? null : updatedRows,
                error: null,
              }).then(resolve, reject);
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

function createValidatedLikert(overrides = {}) {
  return {
    ok: true,
    status: "validated_only",
    value: {
      teamAssessmentParticipantId: "tap-1",
      attemptId: "attempt-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      optionId: "likert-o1",
      locale: "bs",
      uniquenessKey: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
      },
      testSlug: "team_dynamics_assessment_v1",
      blockKey: "tdm-31-V1",
      itemKind: "likert",
      ...overrides,
    },
  };
}

function createValidatedSjt(overrides = {}) {
  return {
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
      ...overrides,
    },
  };
}

async function persistWith({ payload, validationResult, initialState }) {
  const supabase = createSupabaseStub(initialState);
  let validateCalls = 0;

  const result = await persistValidatedTeamDynamicsMixedAnswer(
    {
      userId: "user-1",
      payload,
    },
    {
      validatePayload: async (input) => {
        validateCalls += 1;
        assert.equal(input.userId, "user-1");
        assert.deepEqual(input.payload, payload);
        return validationResult;
      },
      supabase,
    },
  );

  return {
    result,
    state: supabase.state,
    operations: supabase.operations,
    validateCalls,
  };
}

Promise.resolve()
  .then(async () => {
    const invalidValidator = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o1",
      },
      validationResult: {
        ok: false,
        status: "invalid",
        reason: "Provided optionId does not belong to the provided questionId.",
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        testSlug: "team_dynamics_assessment_v1",
      },
      initialState: {},
    });

    assert.equal(invalidValidator.validateCalls, 1);
    assert.deepEqual(invalidValidator.result, {
      ok: false,
      status: "invalid",
      reason: "Provided optionId does not belong to the provided questionId.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      uniquenessKey: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
      },
    });
    assert.equal(invalidValidator.state.responses.length, 0);
    assert.equal(invalidValidator.state.response_selections.length, 0);
    assert.equal(invalidValidator.operations.length, 0);

    const wrongSlug = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o1",
      },
      validationResult: {
        ok: false,
        status: "unsupported",
        reason: "This validator only supports team_dynamics_assessment_v1.",
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        testSlug: "team_dynamics_v1_strong",
      },
      initialState: {},
    });

    assert.equal(wrongSlug.state.responses.length, 0);
    assert.equal(wrongSlug.state.response_selections.length, 0);
    assert.equal(wrongSlug.operations.length, 0);

    const notRunnable = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o1",
      },
      validationResult: {
        ok: false,
        status: "not_runnable",
        reason: "Team Dynamics wrapper is not in a runnable response-validation state.",
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        testSlug: "team_dynamics_assessment_v1",
      },
      initialState: {},
    });

    assert.equal(notRunnable.state.responses.length, 0);
    assert.equal(notRunnable.state.response_selections.length, 0);
    assert.equal(notRunnable.operations.length, 0);

    const firstLikertSave = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o1",
      },
      validationResult: createValidatedLikert(),
      initialState: {},
    });

    assert.deepEqual(firstLikertSave.result, {
      ok: true,
      status: "saved",
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
    });
    assert.equal(firstLikertSave.state.responses.length, 1);
    assert.deepEqual(firstLikertSave.state.responses[0], {
      id: "response-1",
      attempt_id: "attempt-1",
      question_id: "likert-q1",
      response_kind: "single_choice",
      answer_option_id: "likert-o1",
    });

    const repeatedLikert = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o1",
      },
      validationResult: createValidatedLikert(),
      initialState: {
        responses: [
          {
            id: "response-existing",
            attempt_id: "attempt-1",
            question_id: "likert-q1",
            response_kind: "single_choice",
            answer_option_id: "likert-o1",
          },
        ],
      },
    });

    assert.deepEqual(repeatedLikert.result, {
      ok: true,
      status: "unchanged",
      value: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o1",
        uniquenessKey: {
          teamAssessmentParticipantId: "tap-1",
          questionId: "likert-q1",
        },
        responseId: "response-existing",
      },
    });
    assert.equal(repeatedLikert.state.responses.length, 1);

    const overwrittenLikert = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o2",
      },
      validationResult: createValidatedLikert({
        optionId: "likert-o2",
      }),
      initialState: {
        responses: [
          {
            id: "response-existing",
            attempt_id: "attempt-1",
            question_id: "likert-q1",
            response_kind: "single_choice",
            answer_option_id: "likert-o1",
          },
        ],
      },
    });

    assert.deepEqual(overwrittenLikert.result, {
      ok: true,
      status: "overwritten",
      value: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o2",
        uniquenessKey: {
          teamAssessmentParticipantId: "tap-1",
          questionId: "likert-q1",
        },
        responseId: "response-1",
      },
    });
    assert.equal(overwrittenLikert.state.responses.length, 1);
    assert.equal(overwrittenLikert.state.responses[0].answer_option_id, "likert-o2");

    const conflictingLikertKind = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
        responseFormat: "single_select_likert",
        optionId: "likert-o2",
      },
      validationResult: createValidatedLikert({
        optionId: "likert-o2",
      }),
      initialState: {
        responses: [
          {
            id: "response-existing",
            attempt_id: "attempt-1",
            question_id: "likert-q1",
            response_kind: "best_worst",
            answer_option_id: null,
          },
        ],
      },
    });

    assert.deepEqual(conflictingLikertKind.result, {
      ok: false,
      status: "invalid",
      reason:
        "Existing stored response kind conflicts with final mixed-format Likert persistence.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "likert-q1",
      responseFormat: "single_select_likert",
      uniquenessKey: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "likert-q1",
      },
    });

    const firstSjtSave = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o1",
        worstOptionId: "sjt-o3",
      },
      validationResult: createValidatedSjt(),
      initialState: {},
    });

    assert.deepEqual(firstSjtSave.result, {
      ok: true,
      status: "saved",
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
        responseId: "response-1",
      },
    });
    assert.equal(firstSjtSave.state.responses.length, 1);
    assert.deepEqual(firstSjtSave.state.responses[0], {
      id: "response-1",
      attempt_id: "attempt-1",
      question_id: "sjt-q1",
      response_kind: "best_worst",
      answer_option_id: null,
    });
    assert.equal(firstSjtSave.state.response_selections.length, 2);
    assert.deepEqual(
      firstSjtSave.state.response_selections
        .slice()
        .sort((left, right) => left.selection_role.localeCompare(right.selection_role)),
      [
        {
          response_id: "response-1",
          question_id: "sjt-q1",
          answer_option_id: "sjt-o1",
          selection_role: "best",
        },
        {
          response_id: "response-1",
          question_id: "sjt-q1",
          answer_option_id: "sjt-o3",
          selection_role: "worst",
        },
      ],
    );

    const repeatedSjt = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o1",
        worstOptionId: "sjt-o3",
      },
      validationResult: createValidatedSjt(),
      initialState: {
        responses: [
          {
            id: "response-existing",
            attempt_id: "attempt-1",
            question_id: "sjt-q1",
            response_kind: "best_worst",
            answer_option_id: null,
          },
        ],
        response_selections: [
          {
            response_id: "response-existing",
            question_id: "sjt-q1",
            answer_option_id: "sjt-o1",
            selection_role: "best",
          },
          {
            response_id: "response-existing",
            question_id: "sjt-q1",
            answer_option_id: "sjt-o3",
            selection_role: "worst",
          },
        ],
      },
    });

    assert.deepEqual(repeatedSjt.result, {
      ok: true,
      status: "unchanged",
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
        responseId: "response-existing",
      },
    });
    assert.equal(repeatedSjt.state.responses.length, 1);
    assert.equal(repeatedSjt.state.response_selections.length, 2);

    const overwrittenSjt = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o2",
        worstOptionId: "sjt-o3",
      },
      validationResult: createValidatedSjt({
        bestOptionId: "sjt-o2",
      }),
      initialState: {
        responses: [
          {
            id: "response-existing",
            attempt_id: "attempt-1",
            question_id: "sjt-q1",
            response_kind: "best_worst",
            answer_option_id: null,
          },
        ],
        response_selections: [
          {
            response_id: "response-existing",
            question_id: "sjt-q1",
            answer_option_id: "sjt-o1",
            selection_role: "best",
          },
          {
            response_id: "response-existing",
            question_id: "sjt-q1",
            answer_option_id: "sjt-o3",
            selection_role: "worst",
          },
        ],
      },
    });

    assert.deepEqual(overwrittenSjt.result, {
      ok: true,
      status: "overwritten",
      value: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o2",
        worstOptionId: "sjt-o3",
        uniquenessKey: {
          teamAssessmentParticipantId: "tap-1",
          questionId: "sjt-q1",
        },
        responseId: "response-1",
      },
    });
    assert.equal(overwrittenSjt.state.responses.length, 1);
    assert.equal(overwrittenSjt.state.responses[0].response_kind, "best_worst");
    assert.equal(overwrittenSjt.state.response_selections.length, 2);
    assert.deepEqual(
      overwrittenSjt.state.response_selections
        .slice()
        .sort((left, right) => left.selection_role.localeCompare(right.selection_role)),
      [
        {
          response_id: "response-1",
          question_id: "sjt-q1",
          answer_option_id: "sjt-o2",
          selection_role: "best",
        },
        {
          response_id: "response-1",
          question_id: "sjt-q1",
          answer_option_id: "sjt-o3",
          selection_role: "worst",
        },
      ],
    );

    const staleDuplicateSelections = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o2",
        worstOptionId: "sjt-o3",
      },
      validationResult: createValidatedSjt({
        bestOptionId: "sjt-o2",
      }),
      initialState: {
        responses: [
          {
            id: "response-existing",
            attempt_id: "attempt-1",
            question_id: "sjt-q1",
            response_kind: "best_worst",
            answer_option_id: null,
          },
        ],
        response_selections: [
          {
            response_id: "response-existing",
            question_id: "sjt-q1",
            answer_option_id: "sjt-o1",
            selection_role: "best",
          },
          {
            response_id: "response-existing",
            question_id: "sjt-q1",
            answer_option_id: "sjt-o2",
            selection_role: "best",
          },
          {
            response_id: "response-existing",
            question_id: "sjt-q1",
            answer_option_id: "sjt-o3",
            selection_role: "worst",
          },
        ],
      },
    });

    assert.equal(staleDuplicateSelections.result.ok, true);
    assert.equal(staleDuplicateSelections.result.status, "overwritten");
    assert.equal(staleDuplicateSelections.state.responses.length, 1);
    assert.equal(staleDuplicateSelections.state.response_selections.length, 2);

    const conflictingSjtKind = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o1",
        worstOptionId: "sjt-o3",
      },
      validationResult: createValidatedSjt(),
      initialState: {
        responses: [
          {
            id: "response-existing",
            attempt_id: "attempt-1",
            question_id: "sjt-q1",
            response_kind: "single_choice",
            answer_option_id: "sjt-o1",
          },
        ],
      },
    });

    assert.deepEqual(conflictingSjtKind.result, {
      ok: false,
      status: "invalid",
      reason:
        "Existing stored response kind conflicts with final mixed-format best_worst persistence.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      uniquenessKey: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
      },
    });

    const invalidSjtSameOption = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "best_worst",
        bestOptionId: "sjt-o1",
        worstOptionId: "sjt-o1",
      },
      validationResult: createValidatedSjt({
        bestOptionId: "sjt-o1",
        worstOptionId: "sjt-o1",
      }),
      initialState: {},
    });

    assert.deepEqual(invalidSjtSameOption.result, {
      ok: false,
      status: "invalid",
      reason:
        "bestOptionId and worstOptionId must be different for best_worst persistence.",
      teamAssessmentParticipantId: "tap-1",
      questionId: "sjt-q1",
      responseFormat: "best_worst",
      uniquenessKey: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
      },
    });
    assert.equal(invalidSjtSameOption.state.responses.length, 0);
    assert.equal(invalidSjtSameOption.state.response_selections.length, 0);

    const invalidSjtByValidator = await persistWith({
      payload: {
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "single_select_likert",
        optionId: "sjt-o1",
      },
      validationResult: {
        ok: false,
        status: "invalid",
        reason: "payload responseFormat does not match the runtime item response_format.",
        teamAssessmentParticipantId: "tap-1",
        questionId: "sjt-q1",
        responseFormat: "single_select_likert",
        testSlug: "team_dynamics_assessment_v1",
      },
      initialState: {},
    });

    assert.equal(invalidSjtByValidator.state.responses.length, 0);
    assert.equal(invalidSjtByValidator.state.response_selections.length, 0);

    for (const snapshot of [
      invalidValidator,
      wrongSlug,
      notRunnable,
      firstLikertSave,
      repeatedLikert,
      overwrittenLikert,
      conflictingLikertKind,
      firstSjtSave,
      repeatedSjt,
      overwrittenSjt,
      staleDuplicateSelections,
      conflictingSjtKind,
      invalidSjtSameOption,
      invalidSjtByValidator,
    ]) {
      assert.equal(snapshot.state.dimension_scores.length, 0);
      assert.equal(snapshot.state.attempt_reports.length, 0);
      assert.equal(snapshot.state.assessment_reports.length, 0);
    }

    console.log("test-team-dynamics-assessment-v1-answer-persistence: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
