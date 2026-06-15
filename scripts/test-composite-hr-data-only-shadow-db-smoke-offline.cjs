const assert = require("node:assert/strict");

const {
  assertSmokeSummary,
  buildSkipSummary,
  runCompositeHrDataOnlyShadowDbSmoke,
  summarizeSmokeArtifact,
} = require("./test-composite-hr-data-only-shadow-db-smoke.cjs");

async function main() {
  const skipped = await runCompositeHrDataOnlyShadowDbSmoke({
    env: {},
    loadEnv: () => {},
  });

  assert.equal(skipped.ok, true);
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.databaseWrites, false);
  assert.equal(skipped.openAiCalled, false);
  assert.equal(skipped.reportRegenerated, false);
  assert.equal(skipped.productionBehaviorChanged, false);

  const artifact = {
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
        reportId: "report-1",
        assessmentAssignmentId: "assignment-1",
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

  const summary = summarizeSmokeArtifact(artifact);
  assert.equal(summary.persistedReportSnapshotEvaluated, true);
  assert.equal(summary.boundaryDiagnosticPresent, true);
  assert.equal(summary.dataOnlyShadowComparatorPresent, true);
  assert.equal(summary.wouldPassDataOnlyBlockingValidation, false);
  assert.equal(summary.blockingFindingCount, 1);
  assert.equal(summary.diagnosticOnlyFindingCount, 1);
  assert.equal(summary.mutationRiskFindingCount, 1);
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
