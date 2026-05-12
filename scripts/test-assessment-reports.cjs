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
  buildCompositeReadinessFromLinkedAttempts,
  buildQueuedCompositeAssessmentReportInsert,
  buildRetryFailedCompositeAssessmentReportPatch,
  resolveCompositeReportQueueDecision,
} = require("../lib/assessment/assessment-reports.ts");

function buildLink({
  assignmentId = "assignment-1",
  attemptId,
  testSlug,
  status,
  completedAt = null,
  requiredForComposite = true,
  position = 0,
}) {
  return {
    assessment_assignment_id: assignmentId,
    attempt_id: attemptId,
    test_slug: testSlug,
    required_for_composite: requiredForComposite,
    position,
    attempts: {
      status,
      completed_at: completedAt,
    },
  };
}

function main() {
  const noRequired = buildCompositeReadinessFromLinkedAttempts([]);
  assert.equal(noRequired.status, "no_required_components");
  assert.equal(noRequired.requiredCount, 0);

  const incomplete = buildCompositeReadinessFromLinkedAttempts(
    [
      buildLink({
        attemptId: "attempt-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-01-01T10:00:00.000Z",
        position: 0,
      }),
    ],
    {
      expectedRequiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
    },
  );
  assert.equal(incomplete.status, "incomplete");
  assert.equal(incomplete.requiredCount, 3);
  assert.equal(incomplete.completedCount, 1);
  assert.equal(incomplete.incompleteComponents.length, 2);
  assert.equal(
    incomplete.incompleteComponents.every((component) => component.attempt_status === "missing"),
    true,
  );

  const ready = buildCompositeReadinessFromLinkedAttempts(
    [
      buildLink({
        attemptId: "attempt-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-01-01T10:00:00.000Z",
        position: 0,
      }),
      buildLink({
        attemptId: "attempt-safran",
        testSlug: "safran_v1",
        status: "completed",
        completedAt: "2026-01-01T11:00:00.000Z",
        position: 1,
      }),
      buildLink({
        attemptId: "attempt-mwms",
        testSlug: "mwms_v1",
        status: "completed",
        completedAt: "2026-01-01T12:00:00.000Z",
        position: 2,
      }),
    ],
    {
      expectedRequiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
    },
  );
  assert.equal(ready.status, "ready");
  assert.equal(ready.requiredCount, 3);
  assert.equal(ready.completedCount, 3);

  const queuedInsert = buildQueuedCompositeAssessmentReportInsert({
    assessmentAssignmentId: "assignment-ready",
    organizationId: "org-1",
    participantId: "participant-1",
    requestedByUserId: "user-1",
    queuedAt: "2026-01-03T09:00:00.000Z",
  });
  assert.equal(queuedInsert.report_type, "composite");
  assert.equal(queuedInsert.audience, "hr");
  assert.equal(queuedInsert.source_type, "assessment");
  assert.equal(queuedInsert.report_status, "queued");
  assert.equal(queuedInsert.queued_at, "2026-01-03T09:00:00.000Z");
  assert.equal(queuedInsert.report_snapshot, null);
  assert.equal(queuedInsert.metadata.requested_by_user_id, "user-1");

  const generateDecision = resolveCompositeReportQueueDecision({
    action: "generate",
    readiness: ready,
    existingReport: null,
  });
  assert.equal(generateDecision.allowed, true);
  assert.equal(generateDecision.operation, "create");

  const duplicateQueuedDecision = resolveCompositeReportQueueDecision({
    action: "generate",
    readiness: ready,
    existingReport: {
      id: "assessment-report-queued",
      assessment_assignment_id: "assignment-ready",
      organization_id: "org-1",
      participant_id: "participant-1",
      report_type: "composite",
      audience: "hr",
      source_type: "assessment",
      report_status: "queued",
      generator_type: null,
      contract_version: null,
      prompt_version_id: null,
      model_name: null,
      generator_version: null,
      input_snapshot: null,
      report_snapshot: null,
      failure_code: null,
      failure_reason: null,
      queued_at: "2026-01-03T09:00:00.000Z",
      started_at: null,
      completed_at: null,
      generated_at: null,
      created_at: "2026-01-03T09:00:00.000Z",
      updated_at: "2026-01-03T09:00:00.000Z",
      metadata: {},
    },
  });
  assert.equal(duplicateQueuedDecision.allowed, false);
  assert.equal(duplicateQueuedDecision.operation, "already_queued");

  const retryPatch = buildRetryFailedCompositeAssessmentReportPatch({
    existingReport: {
      id: "assessment-report-failed",
      assessment_assignment_id: "assignment-ready",
      organization_id: "org-1",
      participant_id: "participant-1",
      report_type: "composite",
      audience: "hr",
      source_type: "assessment",
      report_status: "failed",
      generator_type: null,
      contract_version: null,
      prompt_version_id: null,
      model_name: null,
      generator_version: null,
      input_snapshot: { old: true },
      report_snapshot: { old: true },
      failure_code: "generation_failed",
      failure_reason: "Failed",
      queued_at: "2026-01-02T09:00:00.000Z",
      started_at: "2026-01-02T09:01:00.000Z",
      completed_at: "2026-01-02T09:05:00.000Z",
      generated_at: null,
      created_at: "2026-01-02T09:00:00.000Z",
      updated_at: "2026-01-02T09:05:00.000Z",
      metadata: { previous: true },
    },
    requestedByUserId: "user-2",
    queuedAt: "2026-01-03T10:00:00.000Z",
  });
  assert.equal(retryPatch?.report_status, "queued");
  assert.equal(retryPatch?.queued_at, "2026-01-03T10:00:00.000Z");
  assert.equal(retryPatch?.failure_code, null);
  assert.equal(retryPatch?.failure_reason, null);
  assert.equal(retryPatch?.started_at, null);
  assert.equal(retryPatch?.completed_at, null);
  assert.equal(retryPatch?.generated_at, null);
  assert.equal(retryPatch?.report_snapshot, null);
  assert.equal(retryPatch?.input_snapshot, null);
  assert.equal(retryPatch?.metadata.previous, true);
  assert.equal(retryPatch?.metadata.last_queued_by_user_id, "user-2");

  const nonFailedRetryPatch = buildRetryFailedCompositeAssessmentReportPatch({
    existingReport: {
      id: "assessment-report-ready",
      assessment_assignment_id: "assignment-ready",
      organization_id: "org-1",
      participant_id: "participant-1",
      report_type: "composite",
      audience: "hr",
      source_type: "assessment",
      report_status: "ready",
      generator_type: null,
      contract_version: null,
      prompt_version_id: null,
      model_name: null,
      generator_version: null,
      input_snapshot: null,
      report_snapshot: {},
      failure_code: null,
      failure_reason: null,
      queued_at: null,
      started_at: null,
      completed_at: "2026-01-03T09:05:00.000Z",
      generated_at: "2026-01-03T09:05:00.000Z",
      created_at: "2026-01-03T09:00:00.000Z",
      updated_at: "2026-01-03T09:05:00.000Z",
      metadata: {},
    },
    requestedByUserId: "user-3",
    queuedAt: "2026-01-03T11:00:00.000Z",
  });
  assert.equal(nonFailedRetryPatch, null);

  const retryDecision = resolveCompositeReportQueueDecision({
    action: "retry",
    readiness: ready,
    existingReport: {
      id: "assessment-report-failed",
      assessment_assignment_id: "assignment-ready",
      organization_id: "org-1",
      participant_id: "participant-1",
      report_type: "composite",
      audience: "hr",
      source_type: "assessment",
      report_status: "failed",
      generator_type: null,
      contract_version: null,
      prompt_version_id: null,
      model_name: null,
      generator_version: null,
      input_snapshot: null,
      report_snapshot: null,
      failure_code: "generation_failed",
      failure_reason: "Failed",
      queued_at: null,
      started_at: null,
      completed_at: "2026-01-03T09:05:00.000Z",
      generated_at: null,
      created_at: "2026-01-03T09:00:00.000Z",
      updated_at: "2026-01-03T09:05:00.000Z",
      metadata: {},
    },
  });
  assert.equal(retryDecision.allowed, true);
  assert.equal(retryDecision.operation, "retry_failed");

  const nonFailedRetryDecision = resolveCompositeReportQueueDecision({
    action: "retry",
    readiness: ready,
    existingReport: {
      id: "assessment-report-processing",
      assessment_assignment_id: "assignment-ready",
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
      queued_at: "2026-01-03T09:00:00.000Z",
      started_at: "2026-01-03T09:01:00.000Z",
      completed_at: null,
      generated_at: null,
      created_at: "2026-01-03T09:00:00.000Z",
      updated_at: "2026-01-03T09:01:00.000Z",
      metadata: {},
    },
  });
  assert.equal(nonFailedRetryDecision.allowed, false);
  assert.equal(nonFailedRetryDecision.operation, "retry_requires_failed");

  const notReadyDecision = resolveCompositeReportQueueDecision({
    action: "generate",
    readiness: incomplete,
    existingReport: null,
  });
  assert.equal(notReadyDecision.allowed, false);
  assert.equal(notReadyDecision.operation, "not_ready");

  console.log("Assessment reports readiness helper tests passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
