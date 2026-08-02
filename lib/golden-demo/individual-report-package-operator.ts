import { GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS, GOLDEN_DEMO_TEST_SLUGS } from "./db-fixture-writer";

export const GOLDEN_DEMO_REPORT_PACKAGE_ARTIFACT_ORDER = [
  "ipip_hr",
  "safran_hr",
  "mwms_hr",
  "composite_hr",
  "individual_development_profile",
] as const;

export type GoldenDemoReportPackageArtifactKey =
  (typeof GOLDEN_DEMO_REPORT_PACKAGE_ARTIFACT_ORDER)[number];

export type GoldenDemoReportPackageArtifactStatus =
  | "MISSING"
  | "QUEUED"
  | "PROCESSING"
  | "READY_VALID"
  | "READY_INVALID"
  | "FAILED"
  | "CONFLICT";

export type GoldenDemoReportPackageState = "READY_TO_APPLY" | "COMPLETE" | "BLOCKED";

export type GoldenDemoReportPackageAttemptReportRow = {
  id: string;
  attemptId: string;
  testSlug: string;
  reportType: string;
  audience: string;
  sourceType: string;
  reportStatus: string;
  reportSnapshot?: unknown;
  inputSnapshot?: unknown;
  snapshotValidation?: {
    ok: boolean;
    errors?: string[];
  } | null;
};

export type GoldenDemoReportPackageAssessmentReportRow = {
  id: string;
  assessmentAssignmentId: string;
  organizationId: string;
  participantId: string;
  reportType: string;
  audience: string;
  sourceType: string;
  reportStatus: string;
  reportSnapshot?: unknown;
  inputSnapshot?: unknown;
  snapshotValidation?: {
    ok: boolean;
    errors?: string[];
  } | null;
};

export type GoldenDemoReportPackageSourceEvidence = {
  fixtureCompatibilityExact: boolean;
  participantId: string | null;
  assignmentId: string | null;
  attemptIds: Record<string, string | null>;
  attempts: Array<{
    testSlug: string;
    status: string;
    completedAt: string | null;
    scoredStartedAt: string | null;
  }>;
  responseCounts: Record<string, number>;
  rawValueCounts: Record<string, number>;
  scoredValueCounts: Record<string, number>;
  dimensionScoreCount: number;
  expectedScoreVerification: {
    ok: boolean;
    matched: number;
    expected: number;
    errors: string[];
  };
  /** Existing report rows are intentionally excluded from this source gate. */
  reportCounts?: {
    attemptReports: number;
    assessmentReports: number;
  };
};

export type GoldenDemoReportPackageInspection = {
  candidateId: string;
  organizationId: string | null;
  participantId: string | null;
  assignmentId: string | null;
  attemptIds: Record<string, string | null>;
  source: GoldenDemoReportPackageSourceEvidence;
  attemptReports: GoldenDemoReportPackageAttemptReportRow[];
  assessmentReports: GoldenDemoReportPackageAssessmentReportRow[];
  participantReportCount: number;
};

export type GoldenDemoReportPackageArtifactState = {
  key: GoldenDemoReportPackageArtifactKey;
  status: GoldenDemoReportPackageArtifactStatus;
  reportId: string | null;
  attemptId: string | null;
  reason: string | null;
};

export type GoldenDemoReportPackagePlan = {
  candidateId: string;
  participantId: string | null;
  assignmentId: string | null;
  attemptIds: Record<string, string | null>;
  sourceState: "SCORED_EXACT" | "NOT_SCORED_EXACT";
  sourceBlockers: string[];
  packageState: GoldenDemoReportPackageState;
  artifactStates: GoldenDemoReportPackageArtifactState[];
  orderedActions: Array<{
    key: GoldenDemoReportPackageArtifactKey;
    action: "skip_ready" | "queue_and_process" | "process" | "blocked";
    reportId: string | null;
    attemptId: string | null;
    plannedProviderCalls: number;
  }>;
  plannedOpenAiCalls: number;
  remainingArtifacts: GoldenDemoReportPackageArtifactKey[];
  skippedReadyArtifacts: GoldenDemoReportPackageArtifactKey[];
  blockers: string[];
  writesPerformed: false;
};

export type GoldenDemoReportPackageApplyDependencies = {
  inspect: () => Promise<GoldenDemoReportPackageInspection>;
  recoverHrAttemptReport: (attemptId: string) => Promise<unknown>;
  claimNextReportJob: (selector: { attemptId: string; audience: "hr" }) => Promise<unknown>;
  processClaimedReportJob: (job: unknown) => Promise<unknown>;
  createQueuedCompositeAssessmentReport: (input: {
    organizationId: string;
    participantId: string;
    assessmentAssignmentId: string;
  }) => Promise<unknown>;
  claimNextAssessmentReportJob: (options: { assessmentAssignmentId: string }) => Promise<unknown>;
  processClaimedAssessmentReportJob: (job: unknown) => Promise<unknown>;
  queueIndividualDevelopmentProfileAssessmentReport: (input: {
    assessmentAssignmentId: string;
    organizationId: string;
    participantId: string;
  }) => Promise<unknown>;
  processIndividualDevelopmentProfileAssessmentReport: (input: {
    assessmentReportId: string;
    organizationId: string;
    participantId: string;
  }) => Promise<unknown>;
};

export type GoldenDemoReportPackageApplyResult = {
  mode: "apply";
  candidateId: string;
  stateBefore: GoldenDemoReportPackageState;
  stateAfter: GoldenDemoReportPackageState;
  steps: Array<Record<string, unknown>>;
  artifactStatesBefore: GoldenDemoReportPackageArtifactState[];
  artifactStatesAfter: GoldenDemoReportPackageArtifactState[];
  queueCalls: {
    singleTest: number;
    composite: number;
    idp: number;
    total: number;
  };
  singleTestProcessorCalls: number;
  compositeProcessorCalls: number;
  idpProcessorCalls: number;
  plannedOpenAiCallsBefore: number;
  providerProcessingStagesInvoked: number;
  expectedOpenAiCalls: number;
  writesPerformed: boolean;
  stoppedAt: string | null;
  errors: string[];
};

type ArtifactDefinition = {
  key: GoldenDemoReportPackageArtifactKey;
  testSlug?: string;
  reportType: string;
  audience: "hr";
  sourceType: string;
};

const ARTIFACT_DEFINITIONS: readonly ArtifactDefinition[] = [
  {
    key: "ipip_hr",
    testSlug: GOLDEN_DEMO_TEST_SLUGS[0],
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
  },
  {
    key: "safran_hr",
    testSlug: GOLDEN_DEMO_TEST_SLUGS[1],
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
  },
  {
    key: "mwms_hr",
    testSlug: GOLDEN_DEMO_TEST_SLUGS[2],
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
  },
  {
    key: "composite_hr",
    reportType: "composite",
    audience: "hr",
    sourceType: "assessment",
  },
  {
    key: "individual_development_profile",
    reportType: "individual_development_profile",
    audience: "hr",
    sourceType: "assessment",
  },
] as const;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hasExactCounts(
  counts: Record<string, number>,
  expected: Record<string, number>,
): boolean {
  return GOLDEN_DEMO_TEST_SLUGS.every((testSlug) => counts[testSlug] === expected[testSlug]);
}

function hasExactAttemptSet(
  source: GoldenDemoReportPackageSourceEvidence,
): boolean {
  if (source.attempts.length !== GOLDEN_DEMO_TEST_SLUGS.length) {
    return false;
  }

  const attemptIds = GOLDEN_DEMO_TEST_SLUGS.map((testSlug) => source.attemptIds[testSlug]);
  if (attemptIds.some((attemptId) => typeof attemptId !== "string") || new Set(attemptIds).size !== GOLDEN_DEMO_TEST_SLUGS.length) {
    return false;
  }

  return GOLDEN_DEMO_TEST_SLUGS.every((testSlug) => {
    const matches = source.attempts.filter((attempt) => attempt.testSlug === testSlug);
    return (
      matches.length === 1 &&
      matches[0]?.status === "completed" &&
      typeof matches[0]?.completedAt === "string" &&
      matches[0]?.scoredStartedAt === null &&
      typeof source.attemptIds[testSlug] === "string"
    );
  });
}

export function classifyScoredGoldenDemoSource(
  source: GoldenDemoReportPackageSourceEvidence,
): {
  state: "SCORED_EXACT" | "NOT_SCORED_EXACT";
  blockers: string[];
} {
  const blockers: string[] = [];

  if (!source.fixtureCompatibilityExact) {
    blockers.push("Structural fixture compatibility is not exact.");
  }

  if (!source.participantId || !source.assignmentId) {
    blockers.push("Participant or assignment identity is missing.");
  }

  if (!hasExactAttemptSet(source)) {
    blockers.push("The three canonical attempts are not all completed with valid lifecycle evidence.");
  }

  if (!hasExactCounts(source.responseCounts, GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS)) {
    blockers.push("Response counts do not match the canonical standard battery.");
  }

  if (!hasExactCounts(source.rawValueCounts, GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS)) {
    blockers.push("Raw scored-value counts do not match the canonical standard battery.");
  }

  if (!hasExactCounts(source.scoredValueCounts, GOLDEN_DEMO_EXPECTED_RESPONSE_COUNTS)) {
    blockers.push("Persisted scored-value counts do not match the canonical standard battery.");
  }

  if (source.dimensionScoreCount !== 40) {
    blockers.push(`Expected 40 persisted dimension scores, received ${source.dimensionScoreCount}.`);
  }

  if (
    !source.expectedScoreVerification.ok ||
    source.expectedScoreVerification.matched !== 47 ||
    source.expectedScoreVerification.expected !== 47 ||
    source.expectedScoreVerification.errors.length > 0
  ) {
    blockers.push(
      `Expected-score verification is not exact: ${source.expectedScoreVerification.matched}/${source.expectedScoreVerification.expected}.`,
    );
    blockers.push(...source.expectedScoreVerification.errors);
  }

  const uniqueBlockers = unique(blockers);
  return {
    state: uniqueBlockers.length === 0 ? "SCORED_EXACT" : "NOT_SCORED_EXACT",
    blockers: uniqueBlockers,
  };
}

function getSingleTestRows(
  inspection: GoldenDemoReportPackageInspection,
  definition: ArtifactDefinition,
): GoldenDemoReportPackageAttemptReportRow[] {
  const attemptId = definition.testSlug ? inspection.attemptIds[definition.testSlug] : null;

  return inspection.attemptReports.filter(
    (row) =>
      row.attemptId === attemptId &&
      row.testSlug === definition.testSlug &&
      row.reportType === definition.reportType &&
      row.audience === definition.audience &&
      row.sourceType === definition.sourceType,
  );
}

function getAssessmentRows(
  inspection: GoldenDemoReportPackageInspection,
  definition: ArtifactDefinition,
): GoldenDemoReportPackageAssessmentReportRow[] {
  return inspection.assessmentReports.filter(
    (row) =>
      row.assessmentAssignmentId === inspection.assignmentId &&
      row.organizationId === inspection.organizationId &&
      row.participantId === inspection.participantId &&
      row.reportType === definition.reportType &&
      row.audience === definition.audience &&
      row.sourceType === definition.sourceType,
  );
}

function classifyRowStatus(
  row: GoldenDemoReportPackageAttemptReportRow | GoldenDemoReportPackageAssessmentReportRow,
): GoldenDemoReportPackageArtifactStatus {
  if (row.reportStatus === "queued") return "QUEUED";
  if (row.reportStatus === "processing") return "PROCESSING";
  if (row.reportStatus === "failed" || row.reportStatus === "unavailable") return "FAILED";
  if (row.reportStatus === "ready") {
    return row.snapshotValidation?.ok === true ? "READY_VALID" : "READY_INVALID";
  }
  return "CONFLICT";
}

function classifyArtifact(
  inspection: GoldenDemoReportPackageInspection,
  definition: ArtifactDefinition,
): GoldenDemoReportPackageArtifactState {
  const rows = definition.testSlug
    ? getSingleTestRows(inspection, definition)
    : getAssessmentRows(inspection, definition);
  const attemptId = definition.testSlug ? inspection.attemptIds[definition.testSlug] ?? null : null;

  if (rows.length === 0) {
    return {
      key: definition.key,
      status: "MISSING",
      reportId: null,
      attemptId,
      reason: null,
    };
  }

  if (rows.length > 1) {
    return {
      key: definition.key,
      status: "CONFLICT",
      reportId: null,
      attemptId,
      reason: `Multiple rows exist for canonical ${definition.key} identity.`,
    };
  }

  const row = rows[0];
  const status = classifyRowStatus(row);
  const validationErrors = row.snapshotValidation?.errors ?? [];

  return {
    key: definition.key,
    status,
    reportId: row.id,
    attemptId,
    reason:
      status === "READY_INVALID"
        ? validationErrors.join(" | ") || "Ready report snapshot failed production validation."
        : status === "FAILED"
          ? "Report lifecycle is failed or unavailable; retry is not automatic."
          : null,
  };
}

export function classifyGoldenDemoReportPackage(
  inspection: GoldenDemoReportPackageInspection,
): GoldenDemoReportPackageArtifactState[] {
  return ARTIFACT_DEFINITIONS.map((definition) => classifyArtifact(inspection, definition));
}

function artifactStateByKey(
  states: GoldenDemoReportPackageArtifactState[],
  key: GoldenDemoReportPackageArtifactKey,
): GoldenDemoReportPackageArtifactState {
  const state = states.find((candidate) => candidate.key === key);
  if (!state) throw new Error(`Missing report package artifact state for ${key}.`);
  return state;
}

export function buildGoldenDemoReportPackagePlan(
  inspection: GoldenDemoReportPackageInspection,
): GoldenDemoReportPackagePlan {
  const source = classifyScoredGoldenDemoSource(inspection.source);
  const artifactStates = classifyGoldenDemoReportPackage(inspection);
  const blockers = [...source.blockers];
  const blockingArtifactStates = artifactStates.filter((artifact) =>
    ["PROCESSING", "FAILED", "READY_INVALID", "CONFLICT"].includes(artifact.status),
  );

  for (const artifact of blockingArtifactStates) {
    blockers.push(`${artifact.key}: ${artifact.status}${artifact.reason ? ` — ${artifact.reason}` : ""}`);
  }

  const uniqueBlockers = unique(blockers);
  const hasBlockingSource = source.state !== "SCORED_EXACT";
  const allReady = artifactStates.every((artifact) => artifact.status === "READY_VALID");
  const packageState: GoldenDemoReportPackageState = hasBlockingSource || blockingArtifactStates.length > 0
    ? "BLOCKED"
    : allReady
      ? "COMPLETE"
      : "READY_TO_APPLY";

  const orderedActions = artifactStates.map((artifact) => ({
    key: artifact.key,
    action:
      artifact.status === "READY_VALID"
        ? ("skip_ready" as const)
        : ["MISSING", "QUEUED"].includes(artifact.status) && packageState === "READY_TO_APPLY"
          ? (artifact.status === "MISSING" ? ("queue_and_process" as const) : ("process" as const))
          : ("blocked" as const),
    reportId: artifact.reportId,
    attemptId: artifact.attemptId,
    plannedProviderCalls: ["MISSING", "QUEUED"].includes(artifact.status) && packageState === "READY_TO_APPLY" ? 1 : 0,
  }));

  const remainingArtifacts = artifactStates
    .filter((artifact) => artifact.status !== "READY_VALID")
    .map((artifact) => artifact.key);
  const skippedReadyArtifacts = artifactStates
    .filter((artifact) => artifact.status === "READY_VALID")
    .map((artifact) => artifact.key);

  return {
    candidateId: inspection.candidateId,
    participantId: inspection.participantId,
    assignmentId: inspection.assignmentId,
    attemptIds: inspection.attemptIds,
    sourceState: source.state,
    sourceBlockers: source.blockers,
    packageState,
    artifactStates,
    orderedActions,
    plannedOpenAiCalls: orderedActions.reduce((sum, action) => sum + action.plannedProviderCalls, 0),
    remainingArtifacts,
    skippedReadyArtifacts,
    blockers: uniqueBlockers,
    writesPerformed: false,
  };
}

function getReportIdFromResult(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const value = result as Record<string, unknown>;
  if (typeof value.reportId === "string") return value.reportId;
  if (value.report && typeof value.report === "object" && value.report !== null) {
    const report = value.report as Record<string, unknown>;
    return typeof report.id === "string" ? report.id : null;
  }
  return null;
}

function getResultAction(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const action = (result as Record<string, unknown>).action;
  return typeof action === "string" ? action : null;
}

function getResultStatus(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const value = result as Record<string, unknown>;
  if (typeof value.status === "string") return value.status;
  if (typeof value.ok === "boolean") return value.ok ? "ok" : "failed";
  return null;
}

function assertStableIdentity(
  before: GoldenDemoReportPackageInspection,
  after: GoldenDemoReportPackageInspection,
): void {
  if (
    before.candidateId !== after.candidateId ||
    before.organizationId !== after.organizationId ||
    before.participantId !== after.participantId ||
    before.assignmentId !== after.assignmentId ||
    GOLDEN_DEMO_TEST_SLUGS.some((slug) => before.attemptIds[slug] !== after.attemptIds[slug])
  ) {
    throw new Error("Candidate-scoped report package identity changed during execution.");
  }
}

function getJobField(job: unknown, field: string): unknown {
  return job && typeof job === "object" ? (job as Record<string, unknown>)[field] : undefined;
}

function assertSingleTestJob(job: unknown, artifact: GoldenDemoReportPackageArtifactState): void {
  if (!job) throw new Error(`${artifact.key}: single-test worker returned no claim.`);
  if (
    getJobField(job, "id") !== artifact.reportId ||
    getJobField(job, "attempt_id") !== artifact.attemptId ||
    getJobField(job, "audience") !== "hr" ||
    getJobField(job, "report_type") !== "individual" ||
    getJobField(job, "source_type") !== "single_test"
  ) {
    throw new Error(`${artifact.key}: worker claimed a non-canonical or wrong single-test report job.`);
  }
}

function assertCompositeJob(
  job: unknown,
  inspection: GoldenDemoReportPackageInspection,
  artifact: GoldenDemoReportPackageArtifactState,
): void {
  if (!job) throw new Error(`${artifact.key}: composite worker returned no claim.`);
  if (
    getJobField(job, "id") !== artifact.reportId ||
    getJobField(job, "assessment_assignment_id") !== inspection.assignmentId ||
    getJobField(job, "organization_id") !== inspection.organizationId ||
    getJobField(job, "participant_id") !== inspection.participantId ||
    getJobField(job, "report_type") !== "composite" ||
    getJobField(job, "audience") !== "hr" ||
    getJobField(job, "source_type") !== "assessment"
  ) {
    throw new Error(`${artifact.key}: worker claimed a non-canonical or wrong composite report job.`);
  }
}

function assertReadyProcessorResult(result: unknown, expectedReportId: string | null, label: string): void {
  if (getResultStatus(result) !== "ready") {
    throw new Error(`${label}: processor did not return ready.`);
  }
  const reportId = getReportIdFromResult(result);
  if (expectedReportId && reportId && reportId !== expectedReportId) {
    throw new Error(`${label}: processor returned an unexpected report ID.`);
  }
}

function cloneStates(states: GoldenDemoReportPackageArtifactState[]): GoldenDemoReportPackageArtifactState[] {
  return states.map((state) => ({ ...state }));
}

export async function executeGoldenDemoReportPackageApply(
  inspection: GoldenDemoReportPackageInspection,
  deps: GoldenDemoReportPackageApplyDependencies,
): Promise<GoldenDemoReportPackageApplyResult> {
  const initialPlan = buildGoldenDemoReportPackagePlan(inspection);
  const result: GoldenDemoReportPackageApplyResult = {
    mode: "apply",
    candidateId: inspection.candidateId,
    stateBefore: initialPlan.packageState,
    stateAfter: initialPlan.packageState,
    steps: [],
    artifactStatesBefore: cloneStates(initialPlan.artifactStates),
    artifactStatesAfter: cloneStates(initialPlan.artifactStates),
    queueCalls: { singleTest: 0, composite: 0, idp: 0, total: 0 },
    singleTestProcessorCalls: 0,
    compositeProcessorCalls: 0,
    idpProcessorCalls: 0,
    plannedOpenAiCallsBefore: initialPlan.plannedOpenAiCalls,
    providerProcessingStagesInvoked: 0,
    expectedOpenAiCalls: initialPlan.plannedOpenAiCalls,
    writesPerformed: false,
    stoppedAt: null,
    errors: [...initialPlan.blockers],
  };

  if (initialPlan.packageState !== "READY_TO_APPLY") {
    if (initialPlan.packageState === "COMPLETE") {
      result.stateAfter = "COMPLETE";
      result.errors = [];
    }
    return result;
  }

  let currentInspection = inspection;
  let currentPlan = initialPlan;

  const stop = (key: GoldenDemoReportPackageArtifactKey, phase: string, error: unknown) => {
    result.stoppedAt = `${key}:${phase}`;
    result.errors.push(error instanceof Error ? error.message : String(error));
    result.stateAfter = "BLOCKED";
    result.artifactStatesAfter = cloneStates(currentPlan.artifactStates);
  };

  for (const definition of ARTIFACT_DEFINITIONS) {
    const artifact = artifactStateByKey(currentPlan.artifactStates, definition.key);
    if (artifact.status === "READY_VALID") continue;

    if (!["MISSING", "QUEUED"].includes(artifact.status)) {
      stop(definition.key, "precondition", `Unexpected initial artifact status ${artifact.status}.`);
      return result;
    }

    try {
      let processorResult: unknown;
      if (definition.testSlug) {
        if (artifact.status === "MISSING") {
          const queueResult = await deps.recoverHrAttemptReport(artifact.attemptId ?? "");
          result.queueCalls.singleTest += 1;
          result.queueCalls.total += 1;
          result.writesPerformed = true;
          result.steps.push({ key: definition.key, phase: "queue", result: { action: getResultAction(queueResult), reportId: getReportIdFromResult(queueResult) } });
          if (getResultAction(queueResult) !== "generate") {
            stop(definition.key, "queue", `${definition.key}: unexpected single-test queue action.`);
            return result;
          }
          const afterQueue = await deps.inspect();
          assertStableIdentity(currentInspection, afterQueue);
          currentInspection = afterQueue;
          currentPlan = buildGoldenDemoReportPackagePlan(currentInspection);
          const queuedArtifact = artifactStateByKey(currentPlan.artifactStates, definition.key);
          if (queuedArtifact.status !== "QUEUED" || !queuedArtifact.reportId) {
            stop(definition.key, "queue_verify", `${definition.key}: queue did not produce the canonical queued identity.`);
            return result;
          }
          result.steps.push({ key: definition.key, phase: "queue_verify", status: queuedArtifact.status, reportId: queuedArtifact.reportId });
        }

        const queuedArtifact = artifactStateByKey(currentPlan.artifactStates, definition.key);
        const job = await deps.claimNextReportJob({ attemptId: queuedArtifact.attemptId ?? "", audience: "hr" });
        result.writesPerformed = true;
        assertSingleTestJob(job, queuedArtifact);
        result.singleTestProcessorCalls += 1;
        result.providerProcessingStagesInvoked += 1;
        processorResult = await deps.processClaimedReportJob(job);
        result.steps.push({ key: definition.key, phase: "process", reportId: queuedArtifact.reportId, status: getResultStatus(processorResult) });
      } else if (definition.key === "composite_hr") {
        if (!currentInspection.organizationId || !currentInspection.participantId || !currentInspection.assignmentId) {
          throw new Error("Composite HR requires organization, participant and assignment identity.");
        }
        if (artifact.status === "MISSING") {
          const queueResult = await deps.createQueuedCompositeAssessmentReport({
            organizationId: currentInspection.organizationId,
            participantId: currentInspection.participantId,
            assessmentAssignmentId: currentInspection.assignmentId,
          });
          result.queueCalls.composite += 1;
          result.queueCalls.total += 1;
          result.writesPerformed = true;
          result.steps.push({ key: definition.key, phase: "queue", result: { action: getResultAction(queueResult), reportId: getReportIdFromResult(queueResult) } });
          if (getResultAction(queueResult) !== "queued") {
            stop(definition.key, "queue", `${definition.key}: unexpected composite queue action.`);
            return result;
          }
          const afterQueue = await deps.inspect();
          assertStableIdentity(currentInspection, afterQueue);
          currentInspection = afterQueue;
          currentPlan = buildGoldenDemoReportPackagePlan(currentInspection);
          const queuedArtifact = artifactStateByKey(currentPlan.artifactStates, definition.key);
          if (queuedArtifact.status !== "QUEUED" || !queuedArtifact.reportId) {
            stop(definition.key, "queue_verify", `${definition.key}: queue did not produce the canonical queued identity.`);
            return result;
          }
          result.steps.push({ key: definition.key, phase: "queue_verify", status: queuedArtifact.status, reportId: queuedArtifact.reportId });
        }

        const queuedArtifact = artifactStateByKey(currentPlan.artifactStates, definition.key);
        const job = await deps.claimNextAssessmentReportJob({ assessmentAssignmentId: currentInspection.assignmentId ?? "" });
        result.writesPerformed = true;
        assertCompositeJob(job, currentInspection, queuedArtifact);
        result.compositeProcessorCalls += 1;
        result.providerProcessingStagesInvoked += 1;
        processorResult = await deps.processClaimedAssessmentReportJob(job);
        result.steps.push({ key: definition.key, phase: "process", reportId: queuedArtifact.reportId, status: getResultStatus(processorResult) });
      } else {
        if (!currentInspection.organizationId || !currentInspection.participantId || !currentInspection.assignmentId) {
          throw new Error("IDP requires organization, participant and assignment identity.");
        }
        const organizationId = currentInspection.organizationId;
        const participantId = currentInspection.participantId;
        if (artifact.status === "MISSING") {
          const queueResult = await deps.queueIndividualDevelopmentProfileAssessmentReport({
            assessmentAssignmentId: currentInspection.assignmentId,
            organizationId: currentInspection.organizationId,
            participantId: currentInspection.participantId,
          });
          result.queueCalls.idp += 1;
          result.queueCalls.total += 1;
          result.writesPerformed = true;
          result.steps.push({ key: definition.key, phase: "queue", result: { action: getResultAction(queueResult), reportId: getReportIdFromResult(queueResult) } });
          if (getResultAction(queueResult) !== "queued") {
            stop(definition.key, "queue", `${definition.key}: unexpected IDP queue action.`);
            return result;
          }
          const afterQueue = await deps.inspect();
          assertStableIdentity(currentInspection, afterQueue);
          currentInspection = afterQueue;
          currentPlan = buildGoldenDemoReportPackagePlan(currentInspection);
          const queuedArtifact = artifactStateByKey(currentPlan.artifactStates, definition.key);
          if (queuedArtifact.status !== "QUEUED" || !queuedArtifact.reportId) {
            stop(definition.key, "queue_verify", `${definition.key}: queue did not produce the canonical queued identity.`);
            return result;
          }
          result.steps.push({ key: definition.key, phase: "queue_verify", status: queuedArtifact.status, reportId: queuedArtifact.reportId });
        }

        const queuedArtifact = artifactStateByKey(currentPlan.artifactStates, definition.key);
        processorResult = await deps.processIndividualDevelopmentProfileAssessmentReport({
          assessmentReportId: queuedArtifact.reportId ?? "",
          organizationId,
          participantId,
        });
        result.idpProcessorCalls += 1;
        result.providerProcessingStagesInvoked += 1;
        result.writesPerformed = true;
        result.steps.push({ key: definition.key, phase: "process", reportId: queuedArtifact.reportId, status: getResultStatus(processorResult) });
      }

      const afterProcess = await deps.inspect();
      assertStableIdentity(currentInspection, afterProcess);
      currentInspection = afterProcess;
      currentPlan = buildGoldenDemoReportPackagePlan(currentInspection);
      const processedArtifact = artifactStateByKey(currentPlan.artifactStates, definition.key);
      try {
        assertReadyProcessorResult(processorResult, processedArtifact.reportId, definition.key);
      } catch (error) {
        stop(definition.key, "post_process_verify", error);
        return result;
      }
      if (processedArtifact.status !== "READY_VALID") {
        stop(definition.key, "post_process_verify", `${definition.key}: post-process state is ${processedArtifact.status}.`);
        return result;
      }
      result.steps.push({ key: definition.key, phase: "post_process_verify", status: processedArtifact.status, reportId: processedArtifact.reportId });

      if (currentPlan.packageState === "BLOCKED") {
        stop(definition.key, "package_verify", currentPlan.blockers.join("; "));
        return result;
      }
    } catch (error) {
      stop(definition.key, "execution", error);
      return result;
    }
  }

  result.stateAfter = currentPlan.packageState;
  result.artifactStatesAfter = cloneStates(currentPlan.artifactStates);
  if (result.stateAfter !== "COMPLETE") {
    result.stoppedAt = result.stoppedAt ?? "package:post_process_verify";
    result.errors.push(...currentPlan.blockers);
  }
  return result;
}
