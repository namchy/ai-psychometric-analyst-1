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
      resolveJsonModule: true,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const {
  orchestrateReportsAfterAttemptCompletion,
} = require("../lib/assessment/report-orchestration.ts");

function buildAttempt(overrides = {}) {
  return {
    attemptId: "attempt-1",
    participantId: "participant-1",
    organizationId: "org-1",
    status: "completed",
    completedAt: "2026-05-14T09:00:00.000Z",
    testSlug: "mwms_v1",
    ...overrides,
  };
}

function buildAttemptJob(audience, overrides = {}) {
  return {
    id: `attempt-report-${audience}`,
    attempt_id: "attempt-1",
    test_slug: "mwms_v1",
    generator_type: "mock",
    generated_at: "2026-05-14T09:00:00.000Z",
    report_status: "processing",
    report_type: "individual",
    audience,
    source_type: "single_test",
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    started_at: "2026-05-14T09:00:01.000Z",
    completed_at: null,
    ...overrides,
  };
}

function buildCompositeJob(overrides = {}) {
  return {
    id: "assessment-report-1",
    assessment_assignment_id: "assignment-1",
    organization_id: "org-1",
    participant_id: "participant-1",
    report_type: "composite",
    audience: "hr",
    source_type: "assessment",
    report_status: "processing",
    generator_type: null,
    contract_version: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    report_snapshot: null,
    failure_code: null,
    failure_reason: null,
    queued_at: "2026-05-14T09:01:00.000Z",
    started_at: "2026-05-14T09:01:05.000Z",
    completed_at: null,
    generated_at: null,
    created_at: "2026-05-14T09:01:00.000Z",
    updated_at: "2026-05-14T09:01:05.000Z",
    metadata: {},
    ...overrides,
  };
}

function buildEnqueueSummary({
  hrStatus = null,
  participantStatus = null,
  jobsToEnqueue = [],
} = {}) {
  return {
    testSlug: "mwms_v1",
    plan: {
      testSlug: "mwms_v1",
      lanes: [
        {
          audience: "participant",
          capability: { active: true, status: "active" },
          existingStatus: participantStatus,
          shouldEnqueue: jobsToEnqueue.includes("participant"),
        },
        {
          audience: "hr",
          capability: { active: true, status: "active" },
          existingStatus: hrStatus,
          shouldEnqueue: jobsToEnqueue.includes("hr"),
        },
      ],
      jobsToEnqueue: jobsToEnqueue.map((audience) => ({
        audience,
        reportType: "individual",
        sourceType: "single_test",
      })),
    },
  };
}

const quietLogger = {
  info() {},
  warn() {},
  error() {},
};

async function testBestEffortErrorHandling() {
  const result = await orchestrateReportsAfterAttemptCompletion(
    { attemptId: "attempt-1" },
    {
      loadAttemptContext: async () => buildAttempt(),
      enqueueAttemptReports: async () => {
        throw new Error("enqueue exploded");
      },
      claimAttemptReportJob: async ({ audience }) =>
        audience === "participant" ? buildAttemptJob("participant") : null,
      processAttemptReportJob: async () => {
        throw new Error("attempt worker exploded");
      },
      loadLatestActiveAssignment: async () => null,
      logger: quietLogger,
    },
  );

  assert.equal(result.attemptId, "attempt-1");
  assert.equal(result.errors.length, 2);
  assert.equal(
    result.errors.some((entry) => entry.includes("attempt enqueue failed")),
    true,
  );
  assert.equal(
    result.errors.some((entry) => entry.includes("attempt worker failed")),
    true,
  );
}

async function testFailedSingleTestHrIsNotRetriedAutomatically() {
  let processedAudiences = [];

  const result = await orchestrateReportsAfterAttemptCompletion(
    { attemptId: "attempt-1" },
    {
      loadAttemptContext: async () => buildAttempt(),
      enqueueAttemptReports: async () =>
        buildEnqueueSummary({
          hrStatus: "failed",
          participantStatus: "queued",
        }),
      claimAttemptReportJob: async ({ audience }) =>
        audience === "participant" ? buildAttemptJob("participant") : null,
      processAttemptReportJob: async (job) => {
        processedAudiences.push(job.audience);
        return {
          status: "ready",
          reportId: job.id,
          snapshot: { reportType: "mock" },
        };
      },
      loadLatestActiveAssignment: async () => null,
      logger: quietLogger,
    },
  );

  assert.deepEqual(processedAudiences, ["participant"]);
  assert.deepEqual(
    result.attemptReportProcessing.map((entry) => [entry.audience, entry.result]),
    [
      ["participant", "ready"],
      ["hr", "not_found"],
    ],
  );
}

async function testExistingQueuedSingleTestReportIsProcessedWithoutDuplicateEnqueue() {
  let enqueueCalls = 0;
  let hrClaims = 0;

  const result = await orchestrateReportsAfterAttemptCompletion(
    { attemptId: "attempt-1" },
    {
      loadAttemptContext: async () => buildAttempt(),
      enqueueAttemptReports: async () => {
        enqueueCalls += 1;
        return buildEnqueueSummary({
          participantStatus: "ready",
          hrStatus: "queued",
        });
      },
      claimAttemptReportJob: async ({ audience }) => {
        if (audience === "hr") {
          hrClaims += 1;
          return buildAttemptJob("hr");
        }

        return null;
      },
      processAttemptReportJob: async (job) => ({
        status: "ready",
        reportId: job.id,
        snapshot: { reportType: "mock" },
      }),
      loadLatestActiveAssignment: async () => null,
      logger: quietLogger,
    },
  );

  assert.equal(enqueueCalls, 1);
  assert.equal(hrClaims, 1);
  assert.deepEqual(
    result.attemptReportProcessing.map((entry) => [entry.audience, entry.result]),
    [
      ["participant", "not_found"],
      ["hr", "ready"],
    ],
  );
}

async function testCompositeQueuedWhenAssignmentBecomesReady() {
  let queueCalls = 0;

  const result = await orchestrateReportsAfterAttemptCompletion(
    { attemptId: "attempt-1" },
    {
      loadAttemptContext: async () => buildAttempt(),
      enqueueAttemptReports: async () => buildEnqueueSummary(),
      claimAttemptReportJob: async () => null,
      processAttemptReportJob: async () => {
        throw new Error("should not process attempt report in this test");
      },
      loadLatestActiveAssignment: async () => ({ id: "assignment-1" }),
      loadAssignmentLinkForAttempt: async () => ({
        assessmentAssignmentId: "assignment-1",
        attemptId: "attempt-1",
        requiredForComposite: true,
      }),
      buildCompositeReadiness: async () => ({
        status: "ready",
        requiredCount: 3,
        completedCount: 3,
        components: [],
        incompleteComponents: [],
      }),
      createQueuedCompositeReport: async () => {
        queueCalls += 1;
        return {
          action: "queued",
          assignment: { id: "assignment-1" },
          readiness: {
            status: "ready",
            requiredCount: 3,
            completedCount: 3,
            components: [],
            incompleteComponents: [],
          },
          report: {
            id: "assessment-report-1",
            report_status: "queued",
          },
        };
      },
      claimCompositeReportJob: async () => buildCompositeJob(),
      processCompositeReportJob: async (job) => ({
        status: "ready",
        reportId: job.id,
        snapshot: { reportType: "composite_hr_v1" },
      }),
      logger: quietLogger,
    },
  );

  assert.equal(queueCalls, 1);
  assert.equal(result.compositeProcessing.assignmentId, "assignment-1");
  assert.equal(result.compositeProcessing.linkedAttempt, true);
  assert.equal(result.compositeProcessing.readinessStatus, "ready");
  assert.equal(result.compositeProcessing.queueAction, "queued");
  assert.equal(result.compositeProcessing.result, "ready");
}

async function testCompositeNotQueuedWhenAssignmentIsNotReady() {
  let queueCalls = 0;
  let compositeClaims = 0;

  const result = await orchestrateReportsAfterAttemptCompletion(
    { attemptId: "attempt-1" },
    {
      loadAttemptContext: async () => buildAttempt(),
      enqueueAttemptReports: async () => buildEnqueueSummary(),
      claimAttemptReportJob: async () => null,
      processAttemptReportJob: async () => {
        throw new Error("should not process attempt report in this test");
      },
      loadLatestActiveAssignment: async () => ({ id: "assignment-1" }),
      loadAssignmentLinkForAttempt: async () => ({
        assessmentAssignmentId: "assignment-1",
        attemptId: "attempt-1",
        requiredForComposite: true,
      }),
      buildCompositeReadiness: async () => ({
        status: "incomplete",
        requiredCount: 3,
        completedCount: 2,
        components: [],
        incompleteComponents: [],
      }),
      createQueuedCompositeReport: async () => {
        queueCalls += 1;
        throw new Error("composite queue should not be called");
      },
      claimCompositeReportJob: async () => {
        compositeClaims += 1;
        return null;
      },
      logger: quietLogger,
    },
  );

  assert.equal(queueCalls, 0);
  assert.equal(compositeClaims, 0);
  assert.equal(result.compositeProcessing.readinessStatus, "incomplete");
  assert.equal(result.compositeProcessing.queueAction, "skipped");
  assert.equal(result.compositeProcessing.result, "skipped");
}

async function testCompositeDoesNotUseHistoricalFallbackOutsideAssignmentLinks() {
  let queueCalls = 0;

  const result = await orchestrateReportsAfterAttemptCompletion(
    { attemptId: "attempt-1" },
    {
      loadAttemptContext: async () => buildAttempt(),
      enqueueAttemptReports: async () => buildEnqueueSummary(),
      claimAttemptReportJob: async () => null,
      processAttemptReportJob: async () => {
        throw new Error("should not process attempt report in this test");
      },
      loadLatestActiveAssignment: async () => ({ id: "assignment-1" }),
      loadAssignmentLinkForAttempt: async () => null,
      buildCompositeReadiness: async () => ({
        status: "ready",
        requiredCount: 3,
        completedCount: 3,
        components: [],
        incompleteComponents: [],
      }),
      createQueuedCompositeReport: async () => {
        queueCalls += 1;
        throw new Error("historical fallback should not queue composite");
      },
      logger: quietLogger,
    },
  );

  assert.equal(queueCalls, 0);
  assert.equal(result.compositeProcessing.assignmentId, "assignment-1");
  assert.equal(result.compositeProcessing.linkedAttempt, false);
  assert.equal(result.compositeProcessing.queueAction, "skipped");
}

async function testFailedCompositeIsNotResetAutomatically() {
  let compositeClaims = 0;

  const result = await orchestrateReportsAfterAttemptCompletion(
    { attemptId: "attempt-1" },
    {
      loadAttemptContext: async () => buildAttempt(),
      enqueueAttemptReports: async () => buildEnqueueSummary(),
      claimAttemptReportJob: async () => null,
      processAttemptReportJob: async () => {
        throw new Error("should not process attempt report in this test");
      },
      loadLatestActiveAssignment: async () => ({ id: "assignment-1" }),
      loadAssignmentLinkForAttempt: async () => ({
        assessmentAssignmentId: "assignment-1",
        attemptId: "attempt-1",
        requiredForComposite: true,
      }),
      buildCompositeReadiness: async () => ({
        status: "ready",
        requiredCount: 3,
        completedCount: 3,
        components: [],
        incompleteComponents: [],
      }),
      createQueuedCompositeReport: async () => ({
        action: "noop_failed",
        assignment: { id: "assignment-1" },
        readiness: {
          status: "ready",
          requiredCount: 3,
          completedCount: 3,
          components: [],
          incompleteComponents: [],
        },
        report: {
          id: "assessment-report-failed",
          report_status: "failed",
        },
      }),
      claimCompositeReportJob: async () => {
        compositeClaims += 1;
        return null;
      },
      logger: quietLogger,
    },
  );

  assert.equal(compositeClaims, 1);
  assert.equal(result.compositeProcessing.queueAction, "noop_failed");
  assert.equal(result.compositeProcessing.claimedReportId, null);
  assert.equal(result.compositeProcessing.result, "not_found");
}

async function main() {
  await testBestEffortErrorHandling();
  await testFailedSingleTestHrIsNotRetriedAutomatically();
  await testExistingQueuedSingleTestReportIsProcessedWithoutDuplicateEnqueue();
  await testCompositeQueuedWhenAssignmentBecomesReady();
  await testCompositeNotQueuedWhenAssignmentIsNotReady();
  await testCompositeDoesNotUseHistoricalFallbackOutsideAssignmentLinks();
  await testFailedCompositeIsNotResetAutomatically();
  console.log("Report orchestration tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
