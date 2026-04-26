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
  const attemptId = "attempt-mwms-completed";
  const testId = "test-mwms";

  const questions = MWMS_ITEM_CODES.map((code, index) => ({
    id: `question-${index + 1}`,
    code,
  }));

  const answerOptions = MWMS_ITEM_CODES.map((_, index) => ({
    id: `option-${index + 1}`,
    value: (index % 7) + 1,
  }));

  const responses = MWMS_ITEM_CODES.map((_, index) => ({
    question_id: questions[index].id,
    answer_option_id: answerOptions[index].id,
    raw_value: null,
  }));

  const operations = [];
  const supabase = createMockSupabase(
    {
      attempts: ({ filters }) => ({
        data: filters.id === attemptId ? { id: attemptId, test_id: testId } : null,
      }),
      tests: ({ filters }) => ({
        data: filters.id === testId ? { id: testId, slug: "mwms_v1" } : null,
      }),
      responses: ({ filters }) => ({
        data: filters.attempt_id === attemptId ? responses : [],
      }),
      questions: ({ filters }) => ({
        data: questions.filter((question) => filters.id.includes(question.id)),
      }),
      answer_options: ({ filters }) => ({
        data: answerOptions.filter((option) => filters.id.includes(option.id)),
      }),
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
    operations,
  );

  await persistCompletedAssessmentDimensionScores({
    supabase,
    attemptId,
    testSlug: "mwms_v1",
    computedDimensions: [],
  });

  const deleteOp = operations.find(
    (operation) => operation.type === "delete" && operation.table === "dimension_scores",
  );
  assert.ok(deleteOp, "Expected MWMS completed flow to delete existing dimension scores.");
  assert.equal(deleteOp.filters.attempt_id, attemptId);
  assert.deepEqual(deleteOp.filters.dimension, MWMS_DIMENSION_CODES);

  const insertOp = operations.find(
    (operation) =>
      (operation.type === "insert-select" || operation.type === "insert") &&
      operation.table === "dimension_scores",
  );
  assert.ok(insertOp, "Expected MWMS completed flow to insert dimension scores.");
  assert.equal(insertOp.payload.length, 6);
  assert.deepEqual(
    insertOp.payload.map((row) => row.dimension),
    MWMS_DIMENSION_CODES,
  );
  assert.equal(
    insertOp.payload.some(
      (row) =>
        row.dimension === "autonomous_motivation" ||
        row.dimension === "controlled_motivation",
    ),
    false,
  );
  assert.equal(
    insertOp.payload.some(
      (row) =>
        "totalScore" in row ||
        "overallScore" in row ||
        "percentage" in row ||
        "passFail" in row,
    ),
    false,
  );
  assert.equal(
    insertOp.payload.every(
      (row) =>
        row.attempt_id === attemptId &&
        row.normalized_score === null &&
        row.percentile_score === null &&
        row.interpretation === null,
    ),
    true,
  );

  console.log("MWMS completed flow smoke test passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
