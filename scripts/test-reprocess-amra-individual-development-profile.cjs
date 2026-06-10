const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.join(
  __dirname,
  "reprocess-amra-individual-development-profile.cjs",
);
const source = fs.readFileSync(scriptPath, "utf8");
const {
  TARGET_REPORT_ID,
  TARGET_PARTICIPANT_ID,
  TARGET_ASSESSMENT_ASSIGNMENT_ID,
  TARGET_REPORT_TYPE,
  TARGET_AUDIENCE,
  TARGET_SOURCE_TYPE,
  CONFIRM_ENV,
  isExecutionConfirmed,
  assertDevelopmentOnly,
  assertTargetGuards,
  runControlledReprocess,
} = require(scriptPath);

function buildTarget(overrides = {}) {
  return {
    reportId: TARGET_REPORT_ID,
    organizationId: "organization-1",
    participantId: TARGET_PARTICIPANT_ID,
    assessmentAssignmentId: TARGET_ASSESSMENT_ASSIGNMENT_ID,
    reportType: TARGET_REPORT_TYPE,
    audience: TARGET_AUDIENCE,
    sourceType: TARGET_SOURCE_TYPE,
    reportStatus: "ready",
    ...overrides,
  };
}

async function main() {
  assert.equal(isExecutionConfirmed({ [CONFIRM_ENV]: "true" }), true);
  assert.equal(isExecutionConfirmed({ [CONFIRM_ENV]: "false" }), false);
  assert.throws(() => assertDevelopmentOnly({ NODE_ENV: "production" }), /dev-only/i);
  assert.throws(() => assertDevelopmentOnly({}), /NODE_ENV=development/i);
  assert.doesNotThrow(() => assertDevelopmentOnly({ NODE_ENV: "development" }));

  for (const [field, value, pattern] of [
    ["reportId", "wrong-report", /assessment_report_id/i],
    ["participantId", "wrong-participant", /participant_id/i],
    ["assessmentAssignmentId", "wrong-assignment", /assessment_assignment_id/i],
    ["reportType", "composite", /report_type/i],
    ["audience", "participant", /audience/i],
    ["sourceType", "team", /source_type/i],
  ]) {
    assert.throws(() => assertTargetGuards(buildTarget({ [field]: value })), pattern);
  }

  assert.doesNotThrow(() => assertTargetGuards(buildTarget()));
  assert.doesNotThrow(() =>
    assertTargetGuards(buildTarget({ reportStatus: "failed" })),
  );
  assert.doesNotThrow(() =>
    assertTargetGuards(buildTarget({ reportStatus: "queued" })),
  );
  assert.throws(
    () => assertTargetGuards(buildTarget({ reportStatus: "processing" })),
    /already processing/i,
  );
  assert.throws(
    () => assertTargetGuards(buildTarget({ reportStatus: "cancelled" })),
    /unsupported target report status/i,
  );

  let resetCalls = 0;
  let processCalls = 0;
  let finalStatusCalls = 0;
  const dryRun = await runControlledReprocess({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "false",
    },
    loadTargetReport: async () => buildTarget(),
    resetTargetReadyReportToQueued: async () => {
      resetCalls += 1;
    },
    processReport: async () => {
      processCalls += 1;
    },
    loadFinalStatus: async () => {
      finalStatusCalls += 1;
    },
  });

  assert.equal(dryRun.target.reportId, TARGET_REPORT_ID);
  assert.equal(dryRun.execution, null);
  assert.equal(resetCalls, 0);
  assert.equal(processCalls, 0);
  assert.equal(finalStatusCalls, 0);

  const callOrder = [];
  const successful = await runControlledReprocess({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
    },
    loadTargetReport: async () => buildTarget(),
    resetTargetReadyReportToQueued: async (target) => {
      callOrder.push("reset");
      assert.deepEqual(target, buildTarget());
      return buildTarget({ reportStatus: "queued" });
    },
    processReport: async (input) => {
      callOrder.push("process");
      assert.deepEqual(input, {
        assessmentReportId: TARGET_REPORT_ID,
        organizationId: "organization-1",
        participantId: TARGET_PARTICIPANT_ID,
      });
      return {
        ok: true,
        reportId: TARGET_REPORT_ID,
        status: "ready",
      };
    },
    loadFinalStatus: async () => {
      callOrder.push("inspect");
      return {
        reportId: TARGET_REPORT_ID,
        reportStatus: "ready",
        failureCode: null,
        failureReason: null,
        generatorType: "mock",
        modelName: null,
      };
    },
  });

  assert.deepEqual(callOrder, ["reset", "process", "inspect"]);
  assert.equal(successful.execution.queueAction, "reset_ready_to_queued");
  assert.equal(successful.execution.processorResult.status, "ready");
  assert.equal(successful.execution.finalStatus.reportStatus, "ready");

  const failedCallOrder = [];
  const failedRetry = await runControlledReprocess({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
    },
    loadTargetReport: async () => buildTarget({ reportStatus: "failed" }),
    resetTargetReadyReportToQueued: async () => {
      failedCallOrder.push("ready-reset");
      return buildTarget({ reportStatus: "queued" });
    },
    resetTargetFailedReportToQueued: async (target) => {
      failedCallOrder.push("failed-retry");
      assert.equal(target.reportStatus, "failed");
      return buildTarget({ reportStatus: "queued" });
    },
    processReport: async () => {
      failedCallOrder.push("process");
      return {
        ok: true,
        reportId: TARGET_REPORT_ID,
        status: "ready",
      };
    },
    loadFinalStatus: async () => {
      failedCallOrder.push("inspect");
      return {
        reportId: TARGET_REPORT_ID,
        reportStatus: "ready",
        failureCode: null,
        failureReason: null,
        generatorType: "mock",
        modelName: null,
      };
    },
  });

  assert.deepEqual(failedCallOrder, ["failed-retry", "process", "inspect"]);
  assert.equal(failedRetry.execution.queueAction, "retry_failed_to_queued");
  assert.equal(failedRetry.execution.queued.reportStatus, "queued");

  const queuedCallOrder = [];
  const queuedRetry = await runControlledReprocess({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
    },
    loadTargetReport: async () => buildTarget({ reportStatus: "queued" }),
    resetTargetReadyReportToQueued: async () => {
      queuedCallOrder.push("ready-reset");
    },
    resetTargetFailedReportToQueued: async () => {
      queuedCallOrder.push("failed-retry");
    },
    processReport: async () => {
      queuedCallOrder.push("process");
      return {
        ok: true,
        reportId: TARGET_REPORT_ID,
        status: "ready",
      };
    },
    loadFinalStatus: async () => {
      queuedCallOrder.push("inspect");
      return {
        reportId: TARGET_REPORT_ID,
        reportStatus: "ready",
        failureCode: null,
        failureReason: null,
        generatorType: "mock",
        modelName: null,
      };
    },
  });

  assert.deepEqual(queuedCallOrder, ["process", "inspect"]);
  assert.equal(queuedRetry.execution.queueAction, "already_queued");

  const processingCalls = [];
  await assert.rejects(
    () =>
      runControlledReprocess({
        env: {
          NODE_ENV: "development",
          [CONFIRM_ENV]: "true",
        },
        loadTargetReport: async () =>
          buildTarget({ reportStatus: "processing" }),
        resetTargetReadyReportToQueued: async () => {
          processingCalls.push("ready-reset");
        },
        resetTargetFailedReportToQueued: async () => {
          processingCalls.push("failed-retry");
        },
        processReport: async () => {
          processingCalls.push("process");
        },
        loadFinalStatus: async () => {
          processingCalls.push("inspect");
        },
      }),
    /already processing/i,
  );
  assert.deepEqual(processingCalls, []);

  const controlledFailure = await runControlledReprocess({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
    },
    loadTargetReport: async () => buildTarget(),
    resetTargetReadyReportToQueued: async () => buildTarget({ reportStatus: "queued" }),
    processReport: async () => ({
      ok: false,
      reason: "validation_failed",
      reportId: TARGET_REPORT_ID,
      message: "IDP HR report language quality failed.",
    }),
    loadFinalStatus: async () => ({
      reportId: TARGET_REPORT_ID,
      reportStatus: "failed",
      failureCode: "IDP_REPORT_VALIDATION_FAILED",
      failureReason: "IDP HR report language quality failed.",
      generatorType: "mock",
      modelName: null,
    }),
  });

  assert.equal(controlledFailure.execution.processorResult.reason, "validation_failed");
  assert.equal(controlledFailure.execution.finalStatus.reportStatus, "failed");
  assert.equal(
    controlledFailure.execution.failure_code,
    "IDP_REPORT_VALIDATION_FAILED",
  );
  assert.equal(
    controlledFailure.execution.failure_reason,
    "IDP HR report language quality failed.",
  );

  assert.match(source, new RegExp(TARGET_REPORT_ID));
  assert.match(source, new RegExp(TARGET_PARTICIPANT_ID));
  assert.match(source, new RegExp(TARGET_ASSESSMENT_ASSIGNMENT_ID));
  assert.match(source, /processIndividualDevelopmentProfileAssessmentReport/);
  assert.match(
    source,
    /resetIndividualDevelopmentProfileAssessmentReportToQueued/,
  );
  assert.match(source, /validateReportLanguageQuality|individual-development-profile-processor/);
  assert.doesNotMatch(source, /process\.argv|argv\[/);
  assert.doesNotMatch(source, /report_snapshot\s*:/);
  assert.doesNotMatch(source, /\.update\(\{[\s\S]*?report_snapshot/);

  console.log("test-reprocess-amra-individual-development-profile: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
