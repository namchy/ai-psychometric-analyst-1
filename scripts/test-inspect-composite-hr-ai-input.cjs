const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "inspect-composite-hr-ai-input.cjs");
const providerPath = path.join(projectRoot, "lib", "assessment", "composite-hr-report-provider-openai.ts");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const providerSource = fs.readFileSync(providerPath, "utf8");

assert.match(scriptSource, /CONFIRM_COMPOSITE_HR_AI_INPUT_CAPTURE/);
assert.match(scriptSource, /COMPOSITE_HR_ASSESSMENT_ASSIGNMENT_ID/);
assert.match(scriptSource, /COMPOSITE_HR_REPORT_ID/);
assert.match(scriptSource, /COMPOSITE_HR_AI_REQUEST_DUMP_PATH/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /openAiCalled:\s*false/);
assert.match(scriptSource, /reportRegenerated:\s*false/);
assert.match(scriptSource, /productionFlowChanged:\s*false/);
assert.match(scriptSource, /productionBehaviorChanged:\s*false/);
assert.match(scriptSource, /reconstructedInputUsed:\s*false/);
assert.match(scriptSource, /mode:\s*0o600/);
assert.doesNotMatch(scriptSource, /fetch\(/);
assert.doesNotMatch(scriptSource, /\.(?:insert|update|upsert|delete)\(/);
assert.match(providerSource, /export function buildOpenAiCompositeHrReportRequestPayload/);
assert.match(providerSource, /export function buildCompositeHrOpenAiChatCompletionsRequestBody/);
assert.match(providerSource, /export function buildCompositeHrBoundaryDiagnostic/);

const {
  ASSIGNMENT_ID_ENV,
  CONFIRM_ENV,
  DUMP_PATH_ENV,
  REPORT_ID_ENV,
  assertSafeDumpPath,
  installTypeScriptRuntime,
  resolveIdentity,
  runCompositeHrAiInputCapture,
  sanitizeForDump,
} = require(scriptPath);

function buildCompositeInputSnapshotFixture(overrides = {}) {
  return {
    contractVersion: "composite_hr_input_v1",
    targetReportContractVersion: "composite_hr_v1",
    sourceType: "assessment",
    reportType: "composite",
    audience: "hr",
    locale: "bs",
    addressingForm: "feminine",
    generatedFor: {
      organizationId: "org-1",
      participantId: "participant-1",
      assessmentAssignmentId: "assignment-1",
    },
    assessmentAssignment: {
      id: "assignment-1",
      assignmentType: "standard_battery",
      status: "active",
      locale: "bs",
      createdAt: "2026-06-15T08:00:00.000Z",
    },
    sourceAttempts: [
      {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-06-15T08:20:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 0,
      },
      {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        status: "completed",
        completedAt: "2026-06-15T08:40:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 1,
      },
      {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        status: "completed",
        completedAt: "2026-06-15T09:00:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 2,
      },
    ],
    coverage: {
      requiredCount: 3,
      completedCount: 3,
      requiredTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      completedTestSlugs: ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
      missingTestSlugs: [],
    },
    deterministicInputs: {
      ipip: {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        scale: { min: 1, max: 5 },
        domains: [
          {
            domainCode: "AGREEABLENESS",
            label: "Spremnost na saradnju",
            rawScore: 36,
            scoredQuestionCount: 12,
            averageScore: 3,
            band: "balanced",
            bandLabel: "Uravnotezeno",
            displayScore: 3,
            displayBand: "balanced",
            displayBandLabel: "Uravnotezeno",
            facets: [],
          },
        ],
        summarySignals: {
          rankedDomains: ["AGREEABLENESS"],
          highestDomains: ["AGREEABLENESS"],
          lowestDomains: ["AGREEABLENESS"],
          balancedDomains: ["AGREEABLENESS"],
          topFacets: [],
          lowestFacets: [],
        },
      },
      safran: {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        overall: { rawScore: 36, maxScore: 54, band: "moderate_raw", interpretation: "moderate" },
        verbal: { rawScore: 14, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        figural: { rawScore: 10, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        numeric: { rawScore: 12, maxScore: 18, band: "moderate_raw", interpretation: "moderate" },
        summarySignals: {
          strongestDomain: "verbal",
          lowestDomain: "figural",
        },
      },
      mwms: {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        scale: { min: 1, max: 7 },
        dimensions: [
          {
            code: "intrinsic",
            label: "Intrinzicna motivacija",
            rawScore: 6,
            band: "higher",
            bandLabel: "Visoko",
          },
        ],
        motivationStructure: {
          autonomousMotivationScore: 6,
          controlledMotivationScore: 3.5,
          amotivationScore: 1.8,
        },
        summarySignals: {
          dominantDrivers: ["intrinsic"],
          lowerDrivers: ["amotivation"],
          cautionFlags: {
            elevatedAmotivation: false,
            highControlledRelativeToAutonomous: false,
            mixedProfile: false,
          },
        },
      },
    },
    summarySignals: {
      personalityHighestDomains: ["AGREEABLENESS"],
      personalityLowestDomains: ["AGREEABLENESS"],
      cognitiveStrongestDomain: "verbal",
      cognitiveLowestDomain: "figural",
      motivationHighestDrivers: ["intrinsic"],
      motivationLowestDrivers: ["amotivation"],
      crossInstrumentFlags: [],
    },
    guardrails: {
      usesOnlyLinkedAssignmentAttempts: true,
      usesHistoricalAttemptFallback: false,
      usesSingleTestAiReportsAsPrimaryInput: false,
      aiMayNotChangeScores: true,
    },
    metadata: {
      builtAt: "2026-06-15T09:05:00.000Z",
      builderVersion: "v1",
    },
    ...overrides,
  };
}

async function main() {
  let buildCalls = 0;
  let writes = 0;
  let chmods = 0;
  const noCall = await runCompositeHrAiInputCapture({
    env: {},
    buildInputSnapshot: async () => {
      buildCalls += 1;
      return buildCompositeInputSnapshotFixture();
    },
    writeFile: () => {
      writes += 1;
    },
    chmodFile: () => {
      chmods += 1;
    },
  });

  assert.equal(noCall.confirmed, false);
  assert.equal(noCall.databaseAccessed, false);
  assert.equal(noCall.databaseWrites, false);
  assert.equal(noCall.openAiCalled, false);
  assert.equal(noCall.reportRegenerated, false);
  assert.equal(noCall.productionFlowChanged, false);
  assert.equal(noCall.productionBehaviorChanged, false);
  assert.equal(noCall.reconstructedInputUsed, false);
  assert.equal(buildCalls, 0);
  assert.equal(writes, 0);
  assert.equal(chmods, 0);

  assert.throws(() => resolveIdentity({ env: {}, argv: [] }), /requires/);
  assert.deepEqual(resolveIdentity({ env: { [ASSIGNMENT_ID_ENV]: "assignment-1" }, argv: [] }), {
    kind: "assessment_assignment_id",
    assessmentAssignmentId: "assignment-1",
    reportId: null,
  });
  assert.deepEqual(resolveIdentity({ env: { [REPORT_ID_ENV]: "report-1" }, argv: [] }), {
    kind: "report_id",
    assessmentAssignmentId: null,
    reportId: "report-1",
  });

  for (const invalidPath of [
    "relative.json",
    "/etc/composite.json",
    "/tmpx/composite.json",
    "/tmp/composite.txt",
  ]) {
    assert.throws(() => assertSafeDumpPath(invalidPath), /absolute path under \/tmp|under \/tmp|\.json/);
  }

  assert.doesNotThrow(() => assertSafeDumpPath("/tmp/composite-hr-ai-request.json"));

  const sanitized = sanitizeForDump({
    authorization: "Bearer test-secret",
    cookie: "session=abc",
    nested: {
      apiKey: "sk-test",
      content: "Use sk-real-secret and Bearer abc.def in prompt text.",
    },
  });

  assert.equal(sanitized.authorization, "[REDACTED]");
  assert.equal(sanitized.cookie, "[REDACTED]");
  assert.equal(sanitized.nested.apiKey, "[REDACTED]");
  assert.equal(sanitized.nested.content.includes("sk-real-secret"), false);
  assert.equal(sanitized.nested.content.includes("Bearer abc.def"), false);

  installTypeScriptRuntime();
  const providerModule = require("../lib/assessment/composite-hr-report-provider-openai.ts");
  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const mismatchedEvidenceSnapshot = {
    contractVersion: "composite_hr_v1",
    reportType: "composite",
    audience: "hr",
    sourceType: "assessment",
    locale: "bs",
    generatedFor: inputSnapshot.generatedFor,
    source: {
      inputContractVersion: inputSnapshot.contractVersion,
      sourceAttemptIds: inputSnapshot.sourceAttempts.map((attempt) => attempt.attemptId),
      testSlugs: inputSnapshot.coverage.completedTestSlugs,
    },
    summary: {
      headline: "Pouzdan radni profil",
      profileOverview: "Sazet pregled.",
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
            value: "9.99 (Pogresno)",
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
  const mismatchedEvidenceBefore = JSON.stringify(mismatchedEvidenceSnapshot);
  const mismatchedEvidenceDiagnostic = providerModule.buildCompositeHrBoundaryDiagnostic(
    inputSnapshot,
    mismatchedEvidenceSnapshot,
  );

  assert.equal(mismatchedEvidenceDiagnostic.reportSnapshotStatus, "evaluated");
  assert.equal(
    mismatchedEvidenceDiagnostic.persistedSnapshotEvaluation.evidenceIntegrity.status,
    "fail",
  );
  assert.equal(JSON.stringify(mismatchedEvidenceSnapshot), mismatchedEvidenceBefore);
  const requestPayload = providerModule.buildOpenAiCompositeHrReportRequestPayload(inputSnapshot);
  const directRequestBody = providerModule.buildCompositeHrOpenAiChatCompletionsRequestBody(
    requestPayload,
    { model: "gpt-5.5" },
  );
  const capturedCalls = [];
  await providerModule.requestOpenAiCompositeHrReportRaw(inputSnapshot, {
    apiKey: "sk-test",
    model: "gpt-5.5",
    fetchImpl: async (_url, init) => {
      capturedCalls.push(JSON.parse(init.body));
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: "{}" } }] };
        },
        async text() {
          return "{}";
        },
      };
    },
  });
  assert.deepEqual(capturedCalls[0], directRequestBody);

  const writesList = [];
  const chmodCalls = [];
  const artifact = await runCompositeHrAiInputCapture({
    env: {
      [CONFIRM_ENV]: "true",
      [ASSIGNMENT_ID_ENV]: "assignment-1",
      [DUMP_PATH_ENV]: "/tmp/composite-hr-ai-request-test.json",
      AI_REPORT_MODEL: "gpt-5.5",
      AI_REPORT_PROVIDER: "openai",
    },
    now: () => "2026-06-15T10:00:00.000Z",
    buildInputSnapshot: async (input) => {
      buildCalls += 1;
      assert.deepEqual(input, {
        assessmentAssignmentId: "assignment-1",
        organizationId: undefined,
        participantId: undefined,
      });
      return inputSnapshot;
    },
    getConfig: () => ({
      provider: "openai",
      model: "gpt-5.5",
      openAiApiKey: "sk-should-not-appear",
      openAiTimeoutMs: 120000,
    }),
    writeFile: (filePath, data, options) => {
      writesList.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      chmodCalls.push({ filePath, mode });
    },
  });

  assert.equal(artifact.metadata.timestamp, "2026-06-15T10:00:00.000Z");
  assert.equal(artifact.metadata.reportFamily, "composite_hr");
  assert.equal(artifact.metadata.reportType, "composite");
  assert.equal(artifact.metadata.audience, "hr");
  assert.equal(artifact.metadata.sourceType, "assessment");
  assert.equal(artifact.metadata.provider, "openai");
  assert.equal(artifact.metadata.model, "gpt-5.5");
  assert.equal(artifact.metadata.contractVersion, "composite_hr_v1");
  assert.equal(artifact.metadata.schemaName, "composite_hr_v1");
  assert.equal(artifact.metadata.promptSource, "code_prompt");
  assert.equal(artifact.metadata.databaseWrites, false);
  assert.equal(artifact.metadata.openAiCalled, false);
  assert.equal(artifact.metadata.reportRegenerated, false);
  assert.equal(artifact.metadata.productionFlowChanged, false);
  assert.equal(artifact.metadata.productionBehaviorChanged, false);
  assert.equal(artifact.metadata.reconstructedInputUsed, false);
  assert.equal(artifact.inputSummary.identity.assessmentAssignmentId, "assignment-1");
  assert.equal(artifact.inputSummary.sourceAttemptCount, 3);
  assert.deepEqual(
    artifact.inputSummary.sourceAttempts.map((attempt) => attempt.testSlug),
    ["ipip-neo-120-v1", "safran_v1", "mwms_v1"],
  );
  assert.equal(artifact.reportContract.contractVersion, "composite_hr_v1");
  assert.equal(artifact.reportContract.reportType, "composite");
  assert.equal(artifact.reportContract.audience, "hr");
  assert.equal(artifact.reportContract.sourceType, "assessment");
  assert.equal(artifact.reportContract.schemaName, "composite_hr_v1");
  assert.equal(artifact.requestAuthority.promptSource, "code_prompt");
  assert.equal(artifact.requestAuthority.promptVersionId, null);
  assert.equal(artifact.requestAuthority.reportContractKey, "composite_hr_v1");
  assert.equal(artifact.productionBehaviorChanged, false);
  assert.equal(artifact.databaseWrites, false);
  assert.equal(artifact.openAiCalled, false);
  assert.equal(artifact.reportRegenerated, false);
  assert.equal(artifact.boundaryDiagnostic.mode, "read_only_dev_diagnostic");
  assert.equal(
    artifact.boundaryDiagnostic.reportSnapshotStatus,
    "not_evaluated_no_report_snapshot",
  );
  assert.equal(artifact.dataOnlyReadiness.status, "not_ready");
  assert.deepEqual(artifact.diagnosticOnlyCategories, [
    "prose_style_diagnostic_only",
    "bhs_language_diagnostic_only",
    "reviewer_quality_diagnostic_only",
  ]);
  for (const category of artifact.diagnosticOnlyCategories) {
    assert.equal(
      artifact.validationInventory
        .filter((item) => item.category === category)
        .some((item) => item.recommendedBlocking),
      false,
    );
  }
  for (const category of [
    "data_contract_blocking",
    "deterministic_reference_blocking",
    "evidence_integrity_blocking",
  ]) {
    assert.equal(
      artifact.validationInventory
        .filter((item) => item.category === category)
        .some((item) => item.recommendedBlocking),
      true,
    );
  }
  assert.equal(artifact.mutationRiskInventory.length >= 1, true);
  assert.equal(
    artifact.mutationRiskInventory.some(
      (item) =>
        item.id === "locked_evidence_value_rewrite" &&
        item.futureStrictReferenceRequirement.includes("reject raw mismatches"),
    ),
    true,
  );
  assert.equal(artifact.preparedOpenAiRequest.schemaName, "composite_hr_v1");
  assert.equal(artifact.preparedOpenAiRequest.requestBody.model, "gpt-5.5");
  assert.equal(
    artifact.preparedOpenAiRequest.requestBody.response_format.json_schema.name,
    "composite_hr_v1",
  );
  assert.equal(artifact.preparedOpenAiRequest.requestBody.response_format.json_schema.strict, true);
  assert.equal(artifact.preparedOpenAiRequest.requestBody.messages.length, 2);
  assert.equal(artifact.requestDumpPath, "/tmp/composite-hr-ai-request-test.json");
  assert.equal(writesList.length, 1);
  assert.equal(writesList[0].filePath, "/tmp/composite-hr-ai-request-test.json");
  assert.equal(writesList[0].options.mode, 0o600);
  assert.equal(writesList[0].data.includes("sk-should-not-appear"), false);
  assert.equal(writesList[0].data.includes("sk-test"), false);
  assert.deepEqual(chmodCalls, [{ filePath: "/tmp/composite-hr-ai-request-test.json", mode: 0o600 }]);

  let loadedReportId = null;
  const reportArtifact = await runCompositeHrAiInputCapture({
    env: {
      [CONFIRM_ENV]: "true",
      [REPORT_ID_ENV]: "report-1",
      AI_REPORT_MODEL: "gpt-5.5",
    },
    now: () => "2026-06-15T10:01:00.000Z",
    loadReportIdentity: async (reportId) => {
      loadedReportId = reportId;
      return {
        reportId,
        assessmentAssignmentId: "assignment-1",
        organizationId: "org-1",
        participantId: "participant-1",
        reportSnapshot: null,
      };
    },
    buildInputSnapshot: async (input) => {
      assert.deepEqual(input, {
        assessmentAssignmentId: "assignment-1",
        organizationId: "org-1",
        participantId: "participant-1",
      });
      return inputSnapshot;
    },
    getConfig: () => ({
      provider: "openai",
      model: "gpt-5.5",
      openAiApiKey: null,
      openAiTimeoutMs: 120000,
    }),
    writeFile: () => {},
    chmodFile: () => {},
  });

  assert.equal(loadedReportId, "report-1");
  assert.equal(reportArtifact.inputSummary.identity.inputKind, "report_id");
  assert.equal(reportArtifact.inputSummary.identity.reportId, "report-1");
  assert.equal(
    reportArtifact.boundaryDiagnostic.reportSnapshotStatus,
    "not_evaluated_no_report_snapshot",
  );

  const persistedSnapshot = {
    contractVersion: "composite_hr_v1",
    reportType: "composite",
    audience: "hr",
    sourceType: "assessment",
    locale: "bs",
    generatedFor: inputSnapshot.generatedFor,
    source: {
      inputContractVersion: inputSnapshot.contractVersion,
      sourceAttemptIds: inputSnapshot.sourceAttempts.map((attempt) => attempt.attemptId),
      testSlugs: inputSnapshot.coverage.completedTestSlugs,
    },
    summary: {
      headline: "Pouzdan radni profil",
      profileOverview: "Sažet pregled.",
      keyStrengths: ["Snaga"],
      watchouts: ["Provjera"],
    },
    integratedSignals: [],
    interviewGuidance: {
      focusAreas: [],
    },
    onboardingGuidance: {
      managementTips: [],
      supportNeeds: [],
    },
    limitations: [],
    metadata: {
      provider: "openai",
      providerVersion: "v1",
      generatedAt: "2026-06-15T09:10:00.000Z",
    },
  };
  const persistedArtifact = await runCompositeHrAiInputCapture({
    env: {
      [CONFIRM_ENV]: "true",
      [REPORT_ID_ENV]: "report-2",
      AI_REPORT_MODEL: "gpt-5.5",
    },
    loadReportIdentity: async () => ({
      reportId: "report-2",
      assessmentAssignmentId: "assignment-1",
      organizationId: "org-1",
      participantId: "participant-1",
      reportSnapshot: persistedSnapshot,
    }),
    buildInputSnapshot: async () => inputSnapshot,
    getConfig: () => ({
      provider: "openai",
      model: "gpt-5.5",
      openAiApiKey: null,
      openAiTimeoutMs: 120000,
    }),
    writeFile: () => {},
    chmodFile: () => {},
  });

  assert.equal(persistedArtifact.boundaryDiagnostic.reportSnapshotStatus, "evaluated");
  assert.equal(
    persistedArtifact.boundaryDiagnostic.persistedSnapshotEvaluation.contract.status,
    "pass",
  );
  assert.equal(
    persistedArtifact.boundaryDiagnostic.persistedSnapshotEvaluation.deterministicReference.status,
    "pass",
  );
  assert.equal(
    persistedArtifact.boundaryDiagnostic.persistedSnapshotEvaluation.evidenceIntegrity.status,
    "pass",
  );

  console.log("test-inspect-composite-hr-ai-input: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
