const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return emptyModulePath;
  if (request.startsWith("@/")) {
    const candidate = path.join(projectRoot, request.slice(2));
    for (const extension of [".ts", ".tsx", ".js", ".cjs", ".json"]) {
      if (fs.existsSync(`${candidate}${extension}`)) {
        return originalResolveFilename.call(this, `${candidate}${extension}`, parent, isMain, options);
      }
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const cli = require("./process-golden-demo-individual-report-package.cjs");
const {
  GOLDEN_DEMO_REPORT_PACKAGE_ARTIFACT_ORDER: ARTIFACTS,
  buildGoldenDemoReportPackagePlan,
  executeGoldenDemoReportPackageApply,
} = require("../lib/golden-demo/individual-report-package-operator.ts");

const slugs = ["ipip-neo-120-v1", "safran_v1", "mwms_v1"];
const participantId = "participant-gd003";
const assignmentId = "assignment-gd003";
const organizationId = "organization-partner-plus";
const attemptIds = Object.fromEntries(slugs.map((slug) => [slug, `attempt-${slug}`]));

function counts(ipip, safran, mwms) {
  return { "ipip-neo-120-v1": ipip, safran_v1: safran, mwms_v1: mwms };
}

function exactSource(overrides = {}) {
  return {
    fixtureCompatibilityExact: true,
    participantId,
    assignmentId,
    attemptIds: { ...attemptIds },
    attempts: slugs.map((testSlug) => ({
      testSlug,
      status: "completed",
      completedAt: "2026-08-02T10:00:00.000Z",
      scoredStartedAt: null,
    })),
    responseCounts: counts(120, 45, 19),
    rawValueCounts: counts(120, 45, 19),
    scoredValueCounts: counts(120, 45, 19),
    dimensionScoreCount: 40,
    expectedScoreVerification: { ok: true, matched: 47, expected: 47, errors: [] },
    ...overrides,
  };
}

function emptyInspection(statuses = {}, sourceOverrides = {}) {
  const attemptReports = [];
  const assessmentReports = [];
  const dbStatus = (status) => ["READY_VALID", "READY_INVALID"].includes(status) ? "ready" : status.toLowerCase();
  for (const key of ARTIFACTS) {
    const status = statuses[key] ?? "MISSING";
    if (status === "MISSING" || status === "CONFLICT") continue;
    if (key === "composite_hr" || key === "individual_development_profile") {
      assessmentReports.push({
        id: `report-${key}`,
        assessmentAssignmentId: assignmentId,
        organizationId,
        participantId,
        reportType: key === "composite_hr" ? "composite" : "individual_development_profile",
        audience: "hr",
        sourceType: "assessment",
        reportStatus: dbStatus(status),
        snapshotValidation: status === "READY_VALID" ? { ok: true, errors: [] } : status === "READY_INVALID" ? { ok: false, errors: ["invalid"] } : null,
      });
    } else {
      const testSlug = slugs[ARTIFACTS.indexOf(key)];
      attemptReports.push({
        id: `report-${key}`,
        attemptId: attemptIds[testSlug],
        testSlug,
        reportType: "individual",
        audience: "hr",
        sourceType: "single_test",
        reportStatus: dbStatus(status),
        snapshotValidation: status === "READY_VALID" ? { ok: true, errors: [] } : status === "READY_INVALID" ? { ok: false, errors: ["invalid"] } : null,
      });
    }
  }
  return {
    candidateId: "GD-003",
    organizationId,
    participantId,
    assignmentId,
    attemptIds: { ...attemptIds },
    source: exactSource(sourceOverrides),
    attemptReports,
    assessmentReports,
    participantReportCount: 0,
  };
}

function artifactRow(inspection, key) {
  if (key === "composite_hr" || key === "individual_development_profile") {
    return inspection.assessmentReports.find((row) => row.reportType === (key === "composite_hr" ? "composite" : "individual_development_profile"));
  }
  const slug = slugs[ARTIFACTS.indexOf(key)];
  return inspection.attemptReports.find((row) => row.testSlug === slug);
}

function setArtifactStatus(inspection, key, status) {
  const row = artifactRow(inspection, key);
  assert.ok(row, `test fixture must contain ${key}`);
  row.reportStatus = ["READY_VALID", "READY_INVALID"].includes(status) ? "ready" : status.toLowerCase();
  row.snapshotValidation = status === "READY_VALID" ? { ok: true, errors: [] } : status === "READY_INVALID" ? { ok: false, errors: ["invalid"] } : null;
}

function addArtifactRow(inspection, key, status) {
  const source = emptyInspection({ [key]: status });
  const row = artifactRow(source, key);
  if (key === "composite_hr" || key === "individual_development_profile") inspection.assessmentReports.push(row);
  else inspection.attemptReports.push(row);
}

async function testDefaultInspectionOrganizationMapping() {
  const scoringInspection = {
    resolved: { snapshot: { organizationId: "org-123" } },
    snapshot: {
      structuralFixtureExact: true,
      participantId,
      assignmentId,
      attemptIds: { ...attemptIds },
      attempts: slugs.map((testSlug) => ({
        testSlug,
        status: "completed",
        completedAt: "2026-08-02T10:00:00.000Z",
        scoredStartedAt: null,
      })),
      responseCounts: counts(120, 45, 19),
      rawValueCounts: counts(120, 45, 19),
      scoredValueCounts: counts(120, 45, 19),
      dimensionScores: Array.from({ length: 40 }, () => ({})),
      assignmentId,
    },
    verification: { ok: true, matched: 47, expected: 47, errors: [] },
  };
  const query = {
    select() { return this; },
    in() { return this; },
    eq() { return this; },
    then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
  };
  const inspection = await cli.buildDefaultInspection(
    {
      candidate: { candidateId: "GD-003" },
      foundation: {},
      repository: {},
      supabase: { from: () => query },
    },
    { loadScoringInspection: async () => scoringInspection },
  );
  assert.equal(inspection.organizationId, "org-123");
}

function makeApplyDependencies(initialInspection, config = {}) {
  const current = structuredClone(initialInspection);
  const calls = { inspect: 0, queue: [], claim: [], process: [], forbidden: [] };
  const inspect = async () => {
    calls.inspect += 1;
    return current;
  };
  const reportForAttempt = (attemptId) => {
    const slug = slugs.find((candidate) => attemptIds[candidate] === attemptId);
    return ARTIFACTS[slugs.indexOf(slug)];
  };
  const singleJob = (key) => {
    const row = artifactRow(current, key);
    return {
      id: row?.id,
      attempt_id: row?.attemptId,
      audience: "hr",
      report_type: "individual",
      source_type: "single_test",
    };
  };
  const compositeJob = () => {
    const row = artifactRow(current, "composite_hr");
    return {
      id: row?.id,
      assessment_assignment_id: assignmentId,
      organization_id: organizationId,
      participant_id: participantId,
      report_type: "composite",
      audience: "hr",
      source_type: "assessment",
    };
  };
  return {
    current,
    calls,
    inspect,
    recoverHrAttemptReport: async (attemptId) => {
      calls.queue.push({ kind: "single", attemptId });
      const key = reportForAttempt(attemptId);
      if (config.queueAction && config.queueAction !== "generate") return { action: config.queueAction };
      addArtifactRow(current, key, "QUEUED");
      return { action: "generate", reportId: artifactRow(current, key).id };
    },
    claimNextReportJob: async ({ attemptId, audience }) => {
      calls.claim.push({ kind: "single", attemptId, audience });
      if (config.claim === "null") return null;
      const key = reportForAttempt(attemptId);
      const job = singleJob(key);
      if (config.claim === "wrong_attempt") job.attempt_id = "other-attempt";
      if (config.claim === "wrong_report") job.id = "other-report";
      if (config.claim === "participant") job.audience = "participant";
      return job;
    },
    processClaimedReportJob: async (job) => {
      calls.process.push({ kind: "single", id: job.id });
      const key = reportForAttempt(job.attempt_id);
      if (config.processorStatus) {
        setArtifactStatus(current, key, config.processorStatus);
        return config.processorStatus === "READY_VALID" ? { status: "ready", reportId: job.id } : { status: "failed", reportId: job.id };
      }
      setArtifactStatus(current, key, "READY_VALID");
      return { status: "ready", reportId: job.id };
    },
    createQueuedCompositeAssessmentReport: async () => {
      calls.queue.push({ kind: "composite", assignmentId });
      if (config.queueAction && config.queueAction !== "queued") return { action: config.queueAction };
      addArtifactRow(current, "composite_hr", "QUEUED");
      return { action: "queued", report: { id: artifactRow(current, "composite_hr").id } };
    },
    claimNextAssessmentReportJob: async ({ assessmentAssignmentId }) => {
      calls.claim.push({ kind: "composite", assessmentAssignmentId });
      if (config.claim === "null") return null;
      return compositeJob();
    },
    processClaimedAssessmentReportJob: async (job) => {
      calls.process.push({ kind: "composite", id: job.id });
      setArtifactStatus(current, "composite_hr", config.processorStatus ?? "READY_VALID");
      return config.processorStatus && config.processorStatus !== "READY_VALID" ? { status: "failed", reportId: job.id } : { status: "ready", reportId: job.id };
    },
    queueIndividualDevelopmentProfileAssessmentReport: async () => {
      calls.queue.push({ kind: "idp", assignmentId });
      if (config.queueAction && config.queueAction !== "queued") return { ok: true, action: config.queueAction };
      addArtifactRow(current, "individual_development_profile", "QUEUED");
      return { ok: true, action: "queued", report: { id: artifactRow(current, "individual_development_profile").id } };
    },
    processIndividualDevelopmentProfileAssessmentReport: async ({ assessmentReportId }) => {
      calls.process.push({ kind: "idp", id: assessmentReportId });
      setArtifactStatus(current, "individual_development_profile", config.processorStatus ?? "READY_VALID");
      return config.processorStatus && config.processorStatus !== "READY_VALID" ? { ok: false, reportId: assessmentReportId, message: "failed" } : { ok: true, status: "ready", reportId: assessmentReportId };
    },
  };
}

assert.throws(() => cli.parseCli([]), /explicit --candidate/);
assert.deepEqual(cli.parseCli(["--candidate", "GD-003"]), { mode: "dry-run", candidateId: "GD-003", verbose: false });
assert.deepEqual(cli.parseCli(["--candidate=GD-002", "--apply", "--verbose"]), { mode: "apply", candidateId: "GD-002", verbose: true });
assert.throws(() => cli.parseCli(["--candidate", "GD-003", "--dry-run", "--apply"]), /cannot be combined/);
assert.throws(() => cli.parseCli(["--candidate", "GD-003", "--unknown"]), /Unknown argument/);
assert.throws(() => cli.parseCli(["--candidate", "GD-004"]), /Only GD-001, GD-002, GD-003/);
for (const flag of ["--delete", "--cleanup", "--reset", "--retry", "--force", "--overwrite", "--regenerate", "--parallel"]) {
  assert.throws(() => cli.parseCli(["--candidate", "GD-003", flag]), /separate operator task/);
}

let plan = buildGoldenDemoReportPackagePlan(emptyInspection());
assert.equal(plan.packageState, "READY_TO_APPLY");
assert.equal(plan.plannedOpenAiCalls, 5);
assert.deepEqual(plan.orderedActions.map((action) => action.action), ["queue_and_process", "queue_and_process", "queue_and_process", "queue_and_process", "queue_and_process"]);

const missingOrganization = emptyInspection();
missingOrganization.organizationId = null;
const missingOrganizationPlan = buildGoldenDemoReportPackagePlan(missingOrganization);
assert.equal(missingOrganizationPlan.packageState, "BLOCKED");
assert.equal(missingOrganizationPlan.plannedOpenAiCalls, 0);
assert.match(missingOrganizationPlan.blockers.join(" "), /Organization identity is missing/);

plan = buildGoldenDemoReportPackagePlan(emptyInspection({ ipip_hr: "READY_VALID", safran_hr: "READY_VALID", mwms_hr: "READY_VALID" }));
assert.equal(plan.packageState, "READY_TO_APPLY");
assert.equal(plan.plannedOpenAiCalls, 2);
assert.deepEqual(plan.skippedReadyArtifacts, ["ipip_hr", "safran_hr", "mwms_hr"]);

plan = buildGoldenDemoReportPackagePlan(emptyInspection({ ipip_hr: "MISSING", safran_hr: "QUEUED", mwms_hr: "READY_VALID", composite_hr: "READY_VALID", individual_development_profile: "READY_VALID" }));
assert.deepEqual(plan.orderedActions.map((action) => action.action), ["queue_and_process", "process", "skip_ready", "skip_ready", "skip_ready"]);
assert.equal(plan.plannedOpenAiCalls, 2);

plan = buildGoldenDemoReportPackagePlan(emptyInspection({ ipip_hr: "READY_VALID", safran_hr: "READY_VALID", mwms_hr: "READY_VALID", composite_hr: "READY_VALID", individual_development_profile: "READY_VALID" }));
assert.equal(plan.packageState, "COMPLETE");
assert.equal(plan.plannedOpenAiCalls, 0);

for (const blockingStatus of ["PROCESSING", "FAILED", "READY_INVALID"]) {
  assert.equal(buildGoldenDemoReportPackagePlan(emptyInspection({ ipip_hr: blockingStatus })).packageState, "BLOCKED");
}
const conflictInspection = emptyInspection({ ipip_hr: "READY_VALID" });
conflictInspection.attemptReports.push({ ...conflictInspection.attemptReports[0], id: "duplicate-ipip" });
assert.equal(buildGoldenDemoReportPackagePlan(conflictInspection).packageState, "BLOCKED");
assert.equal(buildGoldenDemoReportPackagePlan(emptyInspection({}, { fixtureCompatibilityExact: false })).packageState, "BLOCKED");

const participantInspection = emptyInspection();
participantInspection.attemptReports.push({
  id: "participant-report",
  attemptId: attemptIds[slugs[0]],
  testSlug: slugs[0],
  reportType: "individual",
  audience: "participant",
  sourceType: "single_test",
  reportStatus: "ready",
  snapshotValidation: { ok: true, errors: [] },
});
assert.equal(buildGoldenDemoReportPackagePlan(participantInspection).artifactStates[0].status, "MISSING");

async function assertSuccessfulApply(initial, config = {}) {
  const deps = makeApplyDependencies(initial, config);
  const result = await executeGoldenDemoReportPackageApply(initial, deps);
  return { deps, result };
}

(async () => {
  let execution = await assertSuccessfulApply(emptyInspection());
  assert.equal(execution.result.stateBefore, "READY_TO_APPLY");
  assert.equal(execution.result.stateAfter, "COMPLETE");
  assert.deepEqual(execution.result.steps.filter((step) => step.phase === "process").map((step) => step.key), ARTIFACTS);
  assert.deepEqual(execution.deps.calls.queue.map((call) => call.kind), ["single", "single", "single", "composite", "idp"]);
  assert.deepEqual(execution.deps.calls.process.map((call) => call.kind), ["single", "single", "single", "composite", "idp"]);
  assert.equal(execution.result.queueCalls.total, 5);
  assert.equal(execution.result.providerProcessingStagesInvoked, 5);
  assert.equal(execution.result.writesPerformed, true);
  assert.equal(execution.deps.calls.inspect, 10);

  execution = await assertSuccessfulApply(emptyInspection({ ipip_hr: "READY_VALID", safran_hr: "READY_VALID", mwms_hr: "READY_VALID", individual_development_profile: "QUEUED" }));
  assert.equal(execution.result.stateAfter, "COMPLETE");
  assert.deepEqual(execution.deps.calls.queue.map((call) => call.kind), ["composite"]);
  assert.deepEqual(execution.deps.calls.process.map((call) => call.kind), ["composite", "idp"]);
  assert.equal(execution.deps.calls.claim.some((call) => call.kind === "single"), false);
  assert.equal(execution.result.queueCalls.idp, 0);

  const blockedDeps = makeApplyDependencies(missingOrganization);
  const blockedApply = await executeGoldenDemoReportPackageApply(missingOrganization, blockedDeps);
  assert.equal(blockedApply.writesPerformed, false);
  assert.equal(blockedApply.queueCalls.total, 0);
  assert.equal(blockedApply.singleTestProcessorCalls, 0);
  assert.equal(blockedApply.compositeProcessorCalls, 0);
  assert.equal(blockedApply.idpProcessorCalls, 0);

  execution = await assertSuccessfulApply(emptyInspection({ ipip_hr: "READY_VALID", safran_hr: "READY_VALID", mwms_hr: "READY_VALID", composite_hr: "READY_VALID", individual_development_profile: "READY_VALID" }));
  assert.equal(execution.result.stateAfter, "COMPLETE");
  assert.equal(execution.result.writesPerformed, false);
  assert.equal(execution.deps.calls.inspect, 0);

  for (const config of [
    { queueAction: "noop_active_job" },
    { claim: "null" },
    { claim: "wrong_attempt" },
    { claim: "wrong_report" },
    { processorStatus: "FAILED" },
  ]) {
    execution = await assertSuccessfulApply(emptyInspection(), config);
    assert.equal(execution.result.stateAfter, "BLOCKED");
    assert.equal(execution.result.steps.some((step) => step.key === "safran_hr"), false);
    assert.equal(execution.result.steps.some((step) => step.key === "mwms_hr"), false);
  }

  for (const postStatus of ["PROCESSING", "FAILED", "READY_INVALID", "CONFLICT"]) {
    const initial = emptyInspection();
    const deps = makeApplyDependencies(initial);
    const originalInspect = deps.inspect;
    let inspections = 0;
    deps.inspect = async () => {
      const result = await originalInspect();
      inspections += 1;
      if (inspections === 2) {
        if (postStatus === "CONFLICT") {
          result.attemptReports.push({ ...result.attemptReports[0], id: "post-process-duplicate" });
        } else {
          setArtifactStatus(result, "ipip_hr", postStatus);
        }
      }
      return result;
    };
    const result = await executeGoldenDemoReportPackageApply(initial, deps);
    assert.equal(result.stateAfter, "BLOCKED");
    assert.equal(result.steps.some((step) => step.key === "safran_hr"), false);
  }

  await testDefaultInspectionOrganizationMapping();
  console.log("Golden Demo individual report package operator tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
