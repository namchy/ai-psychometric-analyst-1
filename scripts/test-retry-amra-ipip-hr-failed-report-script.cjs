const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "retry-amra-ipip-hr-failed-report.cjs"),
  "utf8",
);

const {
  TARGET_REPORT_ID,
  TARGET_ATTEMPT_ID,
  TARGET_TEST_ID,
  TARGET_TEST_SLUG,
  TARGET_PARTICIPANT_NAME,
  TARGET_PARTICIPANT_EMAIL,
  TARGET_AUDIENCE,
  TARGET_REPORT_TYPE,
  TARGET_SOURCE_TYPE,
  CONFIRM_ENV,
  DUMP_ENV,
  isExecutionConfirmed,
  isDebugDumpEnabled,
  assertExecutionPreflight,
  assertPostRunVerification,
  containsForbiddenOutputTerms,
  runControlledFailedRetry,
} = require("./retry-amra-ipip-hr-failed-report.cjs");

function buildPreflight(overrides = {}) {
  return {
    target: {
      reportId: TARGET_REPORT_ID,
      attemptId: TARGET_ATTEMPT_ID,
      testId: TARGET_TEST_ID,
      testSlug: TARGET_TEST_SLUG,
      participantName: TARGET_PARTICIPANT_NAME,
      participantEmail: TARGET_PARTICIPANT_EMAIL,
      audience: TARGET_AUDIENCE,
      reportType: TARGET_REPORT_TYPE,
      sourceType: TARGET_SOURCE_TYPE,
      reportStatus: "failed",
      ...overrides.target,
    },
    artifact: {
      inputSnapshotPresent: true,
      reportSnapshotPresent: false,
      validatorSkipped: true,
      validatorOk: false,
      validatorErrors: [],
      missingReasons: ["report_snapshot_missing"],
      ...overrides.artifact,
    },
    recovery: {
      capabilityActive: true,
      capabilityStatus: "active",
      recoveryAction: "retry_failed",
      recoveryNeeded: true,
      ...overrides.recovery,
    },
    promptSource: {
      promptVersionId: "46ba8f80-2a95-4404-8141-a7e74ebbd957",
      promptKey: "completed_assessment_report",
      testId: TARGET_TEST_ID,
      ...overrides.promptSource,
    },
  };
}

async function main() {
  assert.equal(isExecutionConfirmed({ [CONFIRM_ENV]: "true" }), true);
  assert.equal(isExecutionConfirmed({ [CONFIRM_ENV]: "false" }), false);
  assert.equal(isDebugDumpEnabled({ [DUMP_ENV]: "true" }), true);
  assert.equal(isDebugDumpEnabled({ [DUMP_ENV]: "false" }), false);

  assert.throws(
    () => assertExecutionPreflight(buildPreflight(), { [DUMP_ENV]: "true" }),
    /Execution not confirmed/i,
  );

  assert.throws(
    () => assertExecutionPreflight(buildPreflight(), { [CONFIRM_ENV]: "true" }),
    new RegExp(`${DUMP_ENV}=true`),
  );

  assert.throws(
    () =>
      assertExecutionPreflight(
        buildPreflight({ target: { reportStatus: "ready" } }),
        { [CONFIRM_ENV]: "true", [DUMP_ENV]: "true" },
      ),
    /must be in failed state/i,
  );

  assert.throws(
    () =>
      assertExecutionPreflight(
        buildPreflight({ recovery: { recoveryAction: "noop_ready" } }),
        { [CONFIRM_ENV]: "true", [DUMP_ENV]: "true" },
      ),
    /Expected recoveryAction retry_failed/i,
  );

  assert.throws(
    () =>
      assertExecutionPreflight(
        buildPreflight({ target: { reportId: "wrong-report-id" } }),
        { [CONFIRM_ENV]: "true", [DUMP_ENV]: "true" },
      ),
    /Unexpected target report id/i,
  );

  assert.doesNotThrow(() =>
    assertExecutionPreflight(buildPreflight(), {
      [CONFIRM_ENV]: "true",
      [DUMP_ENV]: "true",
    }),
  );

  assert.equal(containsForbiddenOutputTerms("Spremnost na saradnju"), false);
  assert.equal(containsForbiddenOutputTerms("Saradljivost"), true);
  assert.equal(containsForbiddenOutputTerms("Kooperativnost"), true);
  assert.equal(containsForbiddenOutputTerms("overuse"), true);
  assert.equal(containsForbiddenOutputTerms("handling"), true);

  assert.doesNotThrow(() =>
    assertPostRunVerification({
      reportStatus: "ready",
      validatorOk: true,
      validatorErrors: [],
      inputSnapshotContainsSpremnostNaSaradnju: true,
      reportSnapshotContainsSpremnostNaSaradnju: true,
      containsForbiddenTerms: false,
      reportSnapshotContainsTiTone: false,
    }),
  );

  assert.throws(
    () =>
      assertPostRunVerification({
        reportStatus: "failed",
        validatorOk: true,
        validatorErrors: [],
        inputSnapshotContainsSpremnostNaSaradnju: true,
        reportSnapshotContainsSpremnostNaSaradnju: true,
        containsForbiddenTerms: false,
        reportSnapshotContainsTiTone: false,
      }),
    /not ready/i,
  );

  let recoverCalled = false;
  let claimCalled = false;
  let processCalled = false;
  const noConfirmResult = await runControlledFailedRetry({
    env: {
      [CONFIRM_ENV]: "false",
      [DUMP_ENV]: "true",
    },
    loadPreflightSummary: async () => buildPreflight(),
    recoverHrAttemptReport: async () => {
      recoverCalled = true;
      return null;
    },
    claimNextReportJob: async () => {
      claimCalled = true;
      return null;
    },
    processClaimedReportJob: async () => {
      processCalled = true;
      return null;
    },
  });
  assert.equal(noConfirmResult.preflight.target.reportId, TARGET_REPORT_ID);
  assert.equal(noConfirmResult.execution, null);
  assert.equal(recoverCalled, false);
  assert.equal(claimCalled, false);
  assert.equal(processCalled, false);

  let inspectCalled = false;
  const confirmedResult = await runControlledFailedRetry({
    env: {
      [CONFIRM_ENV]: "true",
      [DUMP_ENV]: "true",
    },
    loadPreflightSummary: async () => buildPreflight(),
    recoverHrAttemptReport: async (attemptId) => {
      assert.equal(attemptId, TARGET_ATTEMPT_ID);
      return {
        action: "retry_failed",
        status: "queued",
        reason: null,
        reportId: TARGET_REPORT_ID,
      };
    },
    claimNextReportJob: async (selector) => {
      assert.deepEqual(selector, {
        attemptId: TARGET_ATTEMPT_ID,
        audience: "hr",
      });
      return {
        id: TARGET_REPORT_ID,
        attempt_id: TARGET_ATTEMPT_ID,
      };
    },
    processClaimedReportJob: async (claimedJob) => {
      assert.equal(claimedJob.id, TARGET_REPORT_ID);
      return {
        status: "ready",
        reportId: TARGET_REPORT_ID,
      };
    },
    findLatestDumpPath: () => "/tmp/amra-ipip-debug-dump.json",
    readFileSync: () =>
      JSON.stringify({
        prompt_key: "completed_assessment_report",
        report_contract_key: "ipip_neo_120_hr_v2",
        report_schema_name: "ipip-neo-120-hr-v2",
        authority_metadata: {
          reportFamily: "single_test_hr",
          reportKind: "ipip_hr",
          reportLaneId: "ipip_hr:ipip-neo-120-v1:hr",
          promptKey: "completed_assessment_report",
          reportContractKey: "ipip_neo_120_hr_v2",
          reportSchemaName: "ipip-neo-120-hr-v2",
          authorityLayers: [
            "global_bhs_language_policy",
            "global_hr_report_policy",
            "single_test_hr_family_policy",
            "test_specific_terminology_policy",
            "runtime_input_facts",
          ],
          terminologyAuthority: {
            key: "ipip_hr_canonical_terminology",
            canonicalAgreeablenessLabel: "Spremnost na saradnju",
            canonicalAgreeablenessNarrativeLabel: "spremnost na saradnju",
          },
        },
        rendered_user_prompt:
          "Spremnost na saradnju",
      }),
    inspectFinalArtifacts: async () => {
      inspectCalled = true;
      return {
        reportStatus: "ready",
        validatorOk: true,
        validatorErrors: [],
        inputSnapshotPresent: true,
        reportSnapshotPresent: true,
        inputSnapshotContainsSpremnostNaSaradnju: true,
        reportSnapshotContainsSpremnostNaSaradnju: true,
        reportSnapshotContainsTiTone: false,
        containsForbiddenTerms: false,
      };
    },
  });
  assert.equal(confirmedResult.execution.queued.action, "retry_failed");
  assert.equal(confirmedResult.execution.workerResult.status, "ready");
  assert.equal(confirmedResult.execution.dumpPath, "/tmp/amra-ipip-debug-dump.json");
  assert.equal(inspectCalled, true);

  assert.match(source, /const TARGET_REPORT_ID = "9ef593a9-ebcf-4606-a16e-f245b47deb0c"/);
  assert.match(source, /const TARGET_ATTEMPT_ID = "2432eb12-2b54-4881-bef2-2ac687b59e0b"/);
  assert.doesNotMatch(source, /process\.argv/);
  assert.doesNotMatch(source, /argv\[/);
  assert.doesNotMatch(source, /report_snapshot\s*:/);

  console.log("test-retry-amra-ipip-hr-failed-report-script: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
