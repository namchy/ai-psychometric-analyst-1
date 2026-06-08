const assert = require("node:assert/strict");

const {
  TARGET_REPORT_ID,
  TARGET_ATTEMPT_ID,
  TARGET_TEST_ID,
  TARGET_TEST_SLUG,
  TARGET_PROMPT_VERSION_ID,
  TARGET_PROMPT_VERSION,
  TARGET_PROMPT_KEY,
  CONFIRM_ENV,
  DUMP_ENV,
  isExecutionConfirmed,
  isDebugDumpEnabled,
  assertExecutionPreflight,
} = require("./regenerate-amra-ipip-hr-report.cjs");

function buildSummary(overrides = {}) {
  return {
    target: {
      reportId: TARGET_REPORT_ID,
      attemptId: TARGET_ATTEMPT_ID,
      testId: TARGET_TEST_ID,
      testSlug: TARGET_TEST_SLUG,
      ...overrides.target,
    },
    promptSource: {
      promptVersionId: TARGET_PROMPT_VERSION_ID,
      promptVersion: TARGET_PROMPT_VERSION,
      promptKey: TARGET_PROMPT_KEY,
      testId: TARGET_TEST_ID,
      ...overrides.promptSource,
    },
  };
}

function main() {
  assert.equal(isExecutionConfirmed({ [CONFIRM_ENV]: "true" }), true);
  assert.equal(isExecutionConfirmed({ [CONFIRM_ENV]: "false" }), false);
  assert.equal(isDebugDumpEnabled({ [DUMP_ENV]: "true" }), true);
  assert.equal(isDebugDumpEnabled({ [DUMP_ENV]: "false" }), false);

  assert.throws(
    () => assertExecutionPreflight(buildSummary(), { [DUMP_ENV]: "true" }),
    /Execution not confirmed/i,
  );

  assert.throws(
    () => assertExecutionPreflight(buildSummary(), { [CONFIRM_ENV]: "true" }),
    new RegExp(`${DUMP_ENV}=true`),
  );

  assert.throws(
    () =>
      assertExecutionPreflight(
        buildSummary({ promptSource: { promptVersionId: "wrong-prompt-id" } }),
        { [CONFIRM_ENV]: "true", [DUMP_ENV]: "true" },
      ),
    /Unexpected prompt_version_id/i,
  );

  assert.throws(
    () =>
      assertExecutionPreflight(
        buildSummary({ target: { reportId: "wrong-report-id" } }),
        { [CONFIRM_ENV]: "true", [DUMP_ENV]: "true" },
      ),
    /Unexpected target report id/i,
  );

  assert.doesNotThrow(() =>
    assertExecutionPreflight(buildSummary(), {
      [CONFIRM_ENV]: "true",
      [DUMP_ENV]: "true",
    }),
  );

  console.log("test-regenerate-amra-ipip-hr-report-script: ok");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
