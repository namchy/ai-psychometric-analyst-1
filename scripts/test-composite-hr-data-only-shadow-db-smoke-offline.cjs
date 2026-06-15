const assert = require("node:assert/strict");

const {
  assertSmokeSummary,
  buildSkipSummary,
  runCompositeHrDataOnlyShadowDbSmoke,
  summarizeSmokeArtifact,
} = require("./test-composite-hr-data-only-shadow-db-smoke.cjs");

function buildValidCompositeSnapshotFixture() {
  return {
    contractVersion: "composite_hr_v1",
    reportType: "composite",
    audience: "hr",
    sourceType: "assessment",
    locale: "bs",
    generatedFor: {
      organizationId: "org-1",
      participantId: "participant-1",
      assessmentAssignmentId: "assignment-1",
    },
    source: {
      inputContractVersion: "composite_hr_input_v1",
      sourceAttemptIds: ["attempt-ipip", "attempt-safran", "attempt-mwms"],
      testSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
    },
    summary: {
      headline: "Pouzdan radni profil",
      profileOverview: "Sažet pregled.",
      keyStrengths: ["Snaga"],
      watchouts: ["Provjera"],
    },
    integratedSignals: [
      {
        id: "signal-1",
        title: "Signal",
        body: "Opis",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Spremnost na saradnju",
            value: "3.00 (Uravnotezeno)",
          },
        ],
      },
    ],
    interviewGuidance: { focusAreas: [] },
    onboardingGuidance: { managementTips: [], supportNeeds: [] },
    limitations: [],
    metadata: {
      provider: "openai",
      providerVersion: "v1",
      generatedAt: "2026-06-15T09:10:00.000Z",
    },
  };
}

function buildArtifactFixture(reportId, assignmentId) {
  return {
    metadata: {
      reportKind: "composite_hr",
      reportType: "composite",
      contractVersion: "composite_hr_v1",
      openAiCalled: false,
      databaseWrites: false,
      reportRegenerated: false,
      productionBehaviorChanged: false,
    },
    inputSummary: {
      identity: {
        reportId,
        assessmentAssignmentId: assignmentId,
      },
    },
    boundaryDiagnostic: {
      reportSnapshotStatus: "evaluated",
    },
    dataOnlyShadowComparator: {
      shadowMode: true,
      productionBehaviorChanged: false,
    },
    dataOnlyShadowResult: {
      wouldPassDataOnlyBlockingValidation: false,
      blockingFindings: [
        {
          code: "DETERMINISTIC_EVIDENCE_VALUE_MISMATCH",
          category: "evidence_integrity_blocking",
          message: "Mismatch",
        },
      ],
      diagnosticOnlyFindings: [
        {
          code: "GLOSSARY_VIOLATION",
          category: "bhs_language_diagnostic_only",
          message: "Ugodnost",
        },
      ],
      mutationRiskFindings: [
        {
          code: "LOCKED_EVIDENCE_VALUE_REWRITE",
          category: "mutation_or_rewrite_risk",
          message: "Risk only",
        },
      ],
      diagnosticOnlyCategories: [
        "prose_style_diagnostic_only",
        "bhs_language_diagnostic_only",
        "reviewer_quality_diagnostic_only",
      ],
      notEvaluatedReasons: [],
    },
    preparedOpenAiRequest: {
      schemaName: "composite_hr_v1",
      requestBody: {
        model: "gpt-5.5",
        response_format: {
          json_schema: {
            name: "composite_hr_v1",
          },
        },
      },
    },
  };
}

async function main() {
  const skipped = await runCompositeHrDataOnlyShadowDbSmoke({
    env: {},
    loadEnv: () => {},
    createSupabaseClient: () => ({}),
    findLatestUsableReadyReportCandidate: async () => null,
    findLatestAssignmentCandidate: async () => null,
  });

  assert.equal(skipped.ok, true);
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.autoDiscoveryUsed, true);
  assert.equal(skipped.inputResolutionMode, "skip_no_candidate");
  assert.equal(skipped.databaseWrites, false);
  assert.equal(skipped.openAiCalled, false);
  assert.equal(skipped.reportRegenerated, false);
  assert.equal(skipped.productionBehaviorChanged, false);
  assert.doesNotThrow(() => assertSmokeSummary(skipped));

  let discoveryCalls = 0;
  let envCapture = null;
  const envPriority = await runCompositeHrDataOnlyShadowDbSmoke({
    env: {
      COMPOSITE_HR_REPORT_ID: "report-123",
    },
    loadEnv: () => {},
    createSupabaseClient: () => ({}),
    loadReportIdentityById: async (_supabase, reportId) => ({
      id: reportId,
      assessment_assignment_id: "assignment-123",
      report_snapshot: buildValidCompositeSnapshotFixture(),
    }),
    findLatestUsableReadyReportCandidate: async () => {
      discoveryCalls += 1;
      throw new Error("ready discovery should not be called when env report id is present");
    },
    findLatestAssignmentCandidate: async () => {
      discoveryCalls += 1;
      throw new Error("assignment discovery should not be called when env report id is present");
    },
    runCapture: async ({ env }) => {
      envCapture = env;
      return buildArtifactFixture("report-123", "assignment-123");
    },
  });

  assert.equal(discoveryCalls, 0);
  assert.equal(envCapture.COMPOSITE_HR_REPORT_ID, "report-123");
  assert.equal(envPriority.inputResolutionMode, "env_report_id");
  assert.equal(envPriority.autoDiscoveryUsed, false);
  assert.equal(envPriority.wouldPassDataOnlyBlockingValidation, false);
  assert.equal(envPriority.blockingFindingCount, 1);
  assert.doesNotThrow(() => assertSmokeSummary(envPriority));

  let assignmentDiscoveryCalls = 0;
  const autoReady = await runCompositeHrDataOnlyShadowDbSmoke({
    env: {},
    loadEnv: () => {},
    createSupabaseClient: () => ({}),
    findLatestUsableReadyReportCandidate: async () => ({
      id: "report-456",
      assessment_assignment_id: "assignment-456",
      report_snapshot: buildValidCompositeSnapshotFixture(),
    }),
    findLatestAssignmentCandidate: async () => {
      assignmentDiscoveryCalls += 1;
      throw new Error("assignment discovery should not be called when a ready candidate exists");
    },
    runCapture: async ({ env }) => {
      assert.equal(env.COMPOSITE_HR_REPORT_ID, "report-456");
      return buildArtifactFixture("report-456", "assignment-456");
    },
  });

  assert.equal(assignmentDiscoveryCalls, 0);
  assert.equal(autoReady.inputResolutionMode, "auto_latest_ready_report");
  assert.equal(autoReady.autoDiscoveryUsed, true);
  assert.equal(autoReady.wouldPassDataOnlyBlockingValidation, false);
  assert.equal(autoReady.blockingCategories[0], "evidence_integrity_blocking");
  assert.equal(autoReady.mutationRiskCategories[0], "mutation_or_rewrite_risk");
  assert.doesNotThrow(() => assertSmokeSummary(autoReady));

  const autoAssignmentSkip = await runCompositeHrDataOnlyShadowDbSmoke({
    env: {},
    loadEnv: () => {},
    createSupabaseClient: () => ({}),
    findLatestUsableReadyReportCandidate: async () => null,
    findLatestAssignmentCandidate: async () => ({
      id: "report-789",
      assessment_assignment_id: "assignment-789",
      report_snapshot: null,
    }),
    runCapture: async () => {
      throw new Error("runCapture should not be called when no persisted snapshot exists");
    },
  });

  assert.equal(autoAssignmentSkip.ok, true);
  assert.equal(autoAssignmentSkip.skipped, true);
  assert.equal(autoAssignmentSkip.inputResolutionMode, "auto_latest_assignment");
  assert.equal(autoAssignmentSkip.autoDiscoveryUsed, true);
  assert.match(
    autoAssignmentSkip.notEvaluatedReasons[0],
    /does not contain a usable persisted report snapshot/,
  );
  assert.doesNotThrow(() => assertSmokeSummary(autoAssignmentSkip));

  const summary = summarizeSmokeArtifact(buildArtifactFixture("report-1", "assignment-1"), {
    inputResolutionMode: "auto_latest_ready_report",
    resolvedCompositeHrReportId: "report-1",
    resolvedAssessmentAssignmentId: "assignment-1",
    autoDiscoveryUsed: true,
  });

  assert.equal(summary.persistedReportSnapshotEvaluated, true);
  assert.equal(summary.boundaryDiagnosticPresent, true);
  assert.equal(summary.dataOnlyShadowComparatorPresent, true);
  assert.equal(summary.wouldPassDataOnlyBlockingValidation, false);
  assert.equal(summary.blockingFindingCount, 1);
  assert.equal(summary.diagnosticOnlyFindingCount, 1);
  assert.equal(summary.mutationRiskFindingCount, 1);
  assert.equal(summary.autoDiscoveryUsed, true);
  assert.equal(summary.inputResolutionMode, "auto_latest_ready_report");
  assert.deepEqual(summary.blockingCategories, ["evidence_integrity_blocking"]);
  assert.deepEqual(summary.diagnosticOnlyCategories, [
    "prose_style_diagnostic_only",
    "bhs_language_diagnostic_only",
    "reviewer_quality_diagnostic_only",
  ]);
  assert.deepEqual(summary.mutationRiskCategories, ["mutation_or_rewrite_risk"]);
  assert.doesNotThrow(() => assertSmokeSummary(summary));

  const missingShadow = buildSkipSummary("skip");
  assert.doesNotThrow(() => assertSmokeSummary(missingShadow));

  console.log("test-composite-hr-data-only-shadow-db-smoke-offline: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
