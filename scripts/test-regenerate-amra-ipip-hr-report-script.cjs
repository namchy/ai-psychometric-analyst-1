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
  validateDebugDumpAuthorityRecord,
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

function buildCleanDumpRecord(overrides = {}) {
  return {
    prompt_key: TARGET_PROMPT_KEY,
    report_contract_key: "ipip_neo_120_hr_v2",
    report_schema_name: "ipip-neo-120-hr-v2",
    authority_metadata: {
      reportFamily: "single_test_hr",
      reportKind: "ipip_hr",
      reportLaneId: "ipip_hr:ipip-neo-120-v1:hr",
      promptKey: TARGET_PROMPT_KEY,
      reportContractKey: "ipip_neo_120_hr_v2",
      reportSchemaName: "ipip-neo-120-hr-v2",
      authorityLayers: [
        "global_hr_report_rules",
        "global_terminology_rules",
        "single_test_hr_family_rules",
        "test_specific_rules",
        "runtime_input_facts",
      ],
      terminologyAuthority: {
        key: "ipip_hr_canonical_terminology",
        canonicalAgreeablenessLabel: "Spremnost na saradnju",
        canonicalAgreeablenessNarrativeLabel: "spremnost na saradnju",
      },
    },
    rendered_user_prompt:
      "Koristi tačno 5 domain_overview stavki u ovom redoslijedu: Ekstraverzija, Spremnost na saradnju, Savjesnost, Neuroticizam, Otvorenost prema iskustvu.",
    request_body: {
      response_format: {
        type: "json_schema",
      },
    },
    ...overrides,
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

  assert.equal(validateDebugDumpAuthorityRecord(buildCleanDumpRecord()).ok, true);
  assert.equal(
    validateDebugDumpAuthorityRecord(
      buildCleanDumpRecord({ rendered_user_prompt: "Legacy Ugodnost should fail." }),
    ).ok,
    false,
  );
  assert.equal(
    validateDebugDumpAuthorityRecord(
      buildCleanDumpRecord({ rendered_user_prompt: "legacy ugodnost should fail." }),
    ).ok,
    false,
  );
  assert.equal(
    validateDebugDumpAuthorityRecord(
      buildCleanDumpRecord({ authority_metadata: null }),
    ).ok,
    false,
  );
  assert.equal(
    validateDebugDumpAuthorityRecord(
      buildCleanDumpRecord({
        prompt_key: "ipip_neo_120_hr_v2",
        authority_metadata: {
          ...buildCleanDumpRecord().authority_metadata,
          promptKey: "ipip_neo_120_hr_v2",
        },
      }),
    ).ok,
    false,
  );

  console.log("test-regenerate-amra-ipip-hr-report-script: ok");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
