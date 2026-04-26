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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const { MWMS_DIMENSION_CODES, MWMS_ITEM_CODES } = require("../lib/assessment/mwms-scoring.ts");
const {
  scoreMwmsAttemptResponses,
  scoreMwmsAttemptResponsesFromDatabase,
  writeMwmsAttemptDimensionScores,
} = require("../lib/assessment/mwms-attempt-scoring.ts");
const {
  persistCompletedAssessmentDimensionScores,
} = require("../lib/assessment/scoring.ts");

function createMockSupabase(tableHandlers, operations = []) {
  class MockFilterBuilder {
    constructor(tableName, mode = "select", payload = null) {
      this.tableName = tableName;
      this.mode = mode;
      this.payload = payload;
      this.filters = {};
      this.selectedColumns = null;
      this.singleMode = "many";
    }

    select(columns) {
      this.selectedColumns = columns;

      if (this.mode === "insert") {
        operations.push({
          type: "insert-select",
          table: this.tableName,
          columns,
          payload: this.payload,
        });

        return Promise.resolve({ data: this.payload ?? null, error: null });
      }

      return this;
    }

    eq(column, value) {
      this.filters[column] = value;
      return this;
    }

    in(column, values) {
      this.filters[column] = values;
      return this;
    }

    maybeSingle() {
      this.singleMode = "maybeSingle";
      return Promise.resolve(this._execute());
    }

    single() {
      this.singleMode = "single";
      return Promise.resolve(this._execute());
    }

    then(onFulfilled, onRejected) {
      return Promise.resolve(this._execute()).then(onFulfilled, onRejected);
    }

    _execute() {
      operations.push({
        type: this.mode,
        table: this.tableName,
        selectedColumns: this.selectedColumns,
        filters: { ...this.filters },
        singleMode: this.singleMode,
        payload: this.payload,
      });

      const handler = tableHandlers[this.tableName];

      if (!handler) {
        return { data: null, error: { message: `Unhandled table ${this.tableName}` } };
      }

      const result = handler({
        tableName: this.tableName,
        mode: this.mode,
        selectedColumns: this.selectedColumns,
        filters: this.filters,
        singleMode: this.singleMode,
        payload: this.payload,
      });

      return {
        data: result.data ?? null,
        error: result.error ?? null,
      };
    }
  }

  return {
    operations,
    from(tableName) {
      return {
        select(columns) {
          return new MockFilterBuilder(tableName, "select").select(columns);
        },
        insert(payload) {
          return new MockFilterBuilder(tableName, "insert", payload);
        },
        delete() {
          return new MockFilterBuilder(tableName, "delete");
        },
      };
    },
  };
}

async function main() {
  const happyPathResponses = MWMS_ITEM_CODES.map((questionCode, index) => ({
    questionCode,
    value: (index % 7) + 1,
  }));

  const happyPathResult = scoreMwmsAttemptResponses(happyPathResponses);
  assert.equal(happyPathResult.isComplete, true);

  if (!happyPathResult.isComplete) {
    throw new Error("Expected complete MWMS attempt scoring result.");
  }

  assert.equal("totalScore" in happyPathResult, false);
  assert.equal("overallScore" in happyPathResult, false);
  assert.equal("percentage" in happyPathResult, false);
  assert.equal("passFail" in happyPathResult, false);

  const missingResponseResult = scoreMwmsAttemptResponses(happyPathResponses.slice(0, 18));
  assert.equal(missingResponseResult.isComplete, false);
  assert.equal(missingResponseResult.error.code, "response_count_mismatch");

  const duplicateQuestionCodeResult = scoreMwmsAttemptResponses([
    ...happyPathResponses.slice(0, 18),
    { questionCode: "MWMS_18", value: 4 },
  ]);
  assert.equal(duplicateQuestionCodeResult.isComplete, false);
  assert.equal(duplicateQuestionCodeResult.error.code, "duplicate_question_code");

  const unknownQuestionCodeResult = scoreMwmsAttemptResponses([
    ...happyPathResponses.slice(0, 18),
    { questionCode: "MWMS_99", value: 4 },
  ]);
  assert.equal(unknownQuestionCodeResult.isComplete, false);
  assert.equal(unknownQuestionCodeResult.error.code, "unknown_item");

  const invalidLowValueResult = scoreMwmsAttemptResponses([
    { questionCode: "MWMS_01", value: 0 },
    ...happyPathResponses.slice(1),
  ]);
  assert.equal(invalidLowValueResult.isComplete, false);
  assert.equal(invalidLowValueResult.error.code, "invalid_value");

  const invalidHighValueResult = scoreMwmsAttemptResponses([
    ...happyPathResponses.slice(0, 18),
    { questionCode: "MWMS_19", value: 8 },
  ]);
  assert.equal(invalidHighValueResult.isComplete, false);
  assert.equal(invalidHighValueResult.error.code, "invalid_value");

  const ATTEMPT_ID = "attempt-1";
  const TEST_ID = "test-mwms";

  const mockQuestions = MWMS_ITEM_CODES.map((code, index) => ({
    id: `question-${index + 1}`,
    code,
  }));

  const mockAnswerOptions = MWMS_ITEM_CODES.map((_, index) => ({
    id: `option-${index + 1}`,
    value: (index % 7) + 1,
  }));

  const mockResponses = MWMS_ITEM_CODES.map((_, index) => ({
    question_id: mockQuestions[index].id,
    answer_option_id: mockAnswerOptions[index].id,
    raw_value: null,
  }));

  const happyPathSupabase = createMockSupabase({
    attempts: ({ filters }) => ({
      data: filters.id === ATTEMPT_ID ? { id: ATTEMPT_ID, test_id: TEST_ID } : null,
    }),
    tests: ({ filters }) => ({
      data: filters.id === TEST_ID ? { id: TEST_ID, slug: "mwms_v1" } : null,
    }),
    responses: ({ filters }) => ({
      data: filters.attempt_id === ATTEMPT_ID ? mockResponses : [],
    }),
    questions: ({ filters }) => ({
      data: mockQuestions.filter((question) => filters.id.includes(question.id)),
    }),
    answer_options: ({ filters }) => ({
      data: mockAnswerOptions.filter((option) => filters.id.includes(option.id)),
    }),
  });

  const dbHappyPathResult = await scoreMwmsAttemptResponsesFromDatabase(
    happyPathSupabase,
    ATTEMPT_ID,
  );
  assert.equal(dbHappyPathResult.isComplete, true);

  await assert.rejects(
    async () =>
      scoreMwmsAttemptResponsesFromDatabase(
        createMockSupabase({
          attempts: () => ({ data: null }),
        }),
        "missing-attempt",
      ),
    /MWMS attempt not found/,
  );

  await assert.rejects(
    async () =>
      scoreMwmsAttemptResponsesFromDatabase(
        createMockSupabase({
          attempts: () => ({ data: { id: ATTEMPT_ID, test_id: TEST_ID } }),
          tests: () => ({ data: { id: TEST_ID, slug: "ipip-neo-120-v1" } }),
        }),
        ATTEMPT_ID,
      ),
    /does not belong to mwms_v1/,
  );

  const missingAnswerOptionValueResult = await scoreMwmsAttemptResponsesFromDatabase(
    createMockSupabase({
      attempts: () => ({ data: { id: ATTEMPT_ID, test_id: TEST_ID } }),
      tests: () => ({ data: { id: TEST_ID, slug: "mwms_v1" } }),
      responses: () => ({
        data: [{ question_id: "question-1", answer_option_id: "missing-option", raw_value: null }],
      }),
      questions: () => ({ data: [{ id: "question-1", code: "MWMS_01" }] }),
      answer_options: () => ({ data: [] }),
    }),
    ATTEMPT_ID,
  );
  assert.equal(missingAnswerOptionValueResult.isComplete, false);
  assert.equal(missingAnswerOptionValueResult.error.code, "response_mapping_error");

  const duplicateResponseResult = await scoreMwmsAttemptResponsesFromDatabase(
    createMockSupabase({
      attempts: () => ({ data: { id: ATTEMPT_ID, test_id: TEST_ID } }),
      tests: () => ({ data: { id: TEST_ID, slug: "mwms_v1" } }),
      responses: () => ({
        data: [
          { question_id: "question-1", answer_option_id: null, raw_value: 4 },
          { question_id: "question-1", answer_option_id: null, raw_value: 5 },
          ...mockResponses.slice(2),
        ],
      }),
      questions: ({ filters }) => ({
        data: mockQuestions.filter((question) => filters.id.includes(question.id)),
      }),
      answer_options: ({ filters }) => ({
        data: mockAnswerOptions.filter((option) => filters.id.includes(option.id)),
      }),
    }),
    ATTEMPT_ID,
  );
  assert.equal(duplicateResponseResult.isComplete, false);
  assert.equal(duplicateResponseResult.error.code, "duplicate_question_code");

  const writeOperations = [];
  const writeSupabase = createMockSupabase(
    {
      attempts: ({ filters }) => ({
        data: filters.id === ATTEMPT_ID ? { id: ATTEMPT_ID, test_id: TEST_ID } : null,
      }),
      tests: ({ filters }) => ({
        data: filters.id === TEST_ID ? { id: TEST_ID, slug: "mwms_v1" } : null,
      }),
      responses: ({ filters }) => ({
        data: filters.attempt_id === ATTEMPT_ID ? mockResponses : [],
      }),
      questions: ({ filters }) => ({
        data: mockQuestions.filter((question) => filters.id.includes(question.id)),
      }),
      answer_options: ({ filters }) => ({
        data: mockAnswerOptions.filter((option) => filters.id.includes(option.id)),
      }),
      dimension_scores: ({ mode, filters, payload }) => {
        if (mode === "delete") {
          return { data: [] };
        }

        if (mode === "insert") {
          return { data: payload };
        }

        return { data: [] };
      },
    },
    writeOperations,
  );

  const writeResult = await writeMwmsAttemptDimensionScores(writeSupabase, ATTEMPT_ID);
  assert.equal(writeResult.writtenDimensionScoreCount, 6);
  assert.equal(writeResult.scoringResult.isComplete, true);

  const deleteOperation = writeOperations.find(
    (operation) => operation.type === "delete" && operation.table === "dimension_scores",
  );
  assert.deepEqual(deleteOperation.filters.attempt_id, ATTEMPT_ID);
  assert.deepEqual(deleteOperation.filters.dimension, MWMS_DIMENSION_CODES);

  const insertOperation = writeOperations.find(
    (operation) =>
      (operation.type === "insert-select" || operation.type === "insert") &&
      operation.table === "dimension_scores",
  );
  assert.equal(insertOperation.payload.length, 6);
  assert.deepEqual(
    insertOperation.payload.map((row) => row.dimension),
    MWMS_DIMENSION_CODES,
  );
  assert.equal(
    insertOperation.payload.every((row) => row.normalized_score === null),
    true,
  );
  assert.equal(
    insertOperation.payload.every((row) => row.percentile_score === null),
    true,
  );
  assert.equal(
    insertOperation.payload.every((row) => row.interpretation === null),
    true,
  );
  assert.equal(
    insertOperation.payload.some((row) =>
      row.dimension === "autonomous_motivation" || row.dimension === "controlled_motivation",
    ),
    false,
  );
  assert.equal(
    insertOperation.payload.some((row) =>
      "totalScore" in row || "overallScore" in row || "percentage" in row || "passFail" in row,
    ),
    false,
  );

  const failedWriteOperations = [];
  await assert.rejects(
    async () =>
      writeMwmsAttemptDimensionScores(
        createMockSupabase(
          {
            attempts: () => ({ data: { id: ATTEMPT_ID, test_id: TEST_ID } }),
            tests: () => ({ data: { id: TEST_ID, slug: "mwms_v1" } }),
            responses: () => ({ data: mockResponses.slice(0, 18) }),
            questions: ({ filters }) => ({
              data: mockQuestions.filter((question) => filters.id.includes(question.id)),
            }),
            answer_options: ({ filters }) => ({
              data: mockAnswerOptions.filter((option) => filters.id.includes(option.id)),
            }),
            dimension_scores: ({ mode }) => {
              throw new Error(`dimension_scores should not be touched during failed scoring (${mode})`);
            },
          },
          failedWriteOperations,
        ),
        ATTEMPT_ID,
      ),
    /did not produce a complete result/,
  );
  assert.equal(
    failedWriteOperations.some((operation) => operation.table === "dimension_scores"),
    false,
  );

  let mwmsWriterCall = null;
  await persistCompletedAssessmentDimensionScores({
    supabase: createMockSupabase({}, []),
    attemptId: ATTEMPT_ID,
    testSlug: "mwms_v1",
    computedDimensions: [],
    persistMwmsDimensionScores: async (_supabase, attemptId) => {
      mwmsWriterCall = attemptId;
      return {
        scoringResult: writeResult.scoringResult,
        writtenDimensionScoreCount: 6,
      };
    },
  });
  assert.equal(mwmsWriterCall, ATTEMPT_ID);

  const nonMwmsOps = [];
  await persistCompletedAssessmentDimensionScores({
    supabase: createMockSupabase(
      {
        dimension_scores: ({ mode, payload }) => {
          if (mode === "delete") {
            return { data: [] };
          }

          if (mode === "insert") {
            return { data: payload };
          }

          return { data: [] };
        },
      },
      nonMwmsOps,
    ),
    attemptId: ATTEMPT_ID,
    testSlug: "ipip-neo-120-v1",
    computedDimensions: [
      { dimension: "EXTRAVERSION", rawScore: 12, scoredQuestionCount: 10 },
      { dimension: "AGREEABLENESS", rawScore: 14, scoredQuestionCount: 10 },
    ],
    persistMwmsDimensionScores: async () => {
      throw new Error("MWMS write helper must not be called for non-MWMS tests.");
    },
  });
  assert.equal(
    nonMwmsOps.some((operation) => operation.type === "delete" && operation.table === "dimension_scores"),
    true,
  );
  assert.equal(
    nonMwmsOps.some(
      (operation) =>
        (operation.type === "insert-select" || operation.type === "insert") &&
        operation.table === "dimension_scores",
    ),
    true,
  );

  console.log("MWMS attempt scoring tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
