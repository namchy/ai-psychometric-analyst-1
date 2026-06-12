const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "inspect-composite-hr-openai-dry-run.cjs");
const providerPath = path.join(projectRoot, "lib", "assessment", "composite-hr-report-provider-openai.ts");
const scriptSource = fs.readFileSync(scriptPath, "utf8");
const providerSource = fs.readFileSync(providerPath, "utf8");

assert.match(scriptSource, /CONFIRM_COMPOSITE_HR_OPENAI_DRY_RUN/);
assert.match(scriptSource, /COMPOSITE_HR_INPUT_SNAPSHOT_PATH/);
assert.match(scriptSource, /databaseWrites:\s*false/);
assert.match(scriptSource, /reportRegenerated:\s*false/);
assert.match(scriptSource, /productionFlowChanged:\s*false/);
assert.match(scriptSource, /mode:\s*0o600/);
assert.doesNotMatch(scriptSource, /createSupabaseAdminClient/);
assert.doesNotMatch(scriptSource, /\.(?:insert|update|upsert|delete)\(/);
assert.doesNotMatch(scriptSource, /processCompositeHrReport/);
assert.doesNotMatch(scriptSource, /processAssessmentReport/);
assert.doesNotMatch(scriptSource, /regenerateCompositeHrReport/);
assert.match(providerSource, /export async function generateOpenAiCompositeHrReport/);

const {
  CONFIRM_ENV,
  INPUT_PATH_ENV,
  installTypeScriptRuntime,
  runCompositeHrOpenAiDryRun,
} = require(scriptPath);

function buildCompositeInputSnapshotFixture() {
  return {
    contractVersion: "composite_hr_input_v1",
    targetReportContractVersion: "composite_hr_v1",
    sourceType: "assessment",
    reportType: "composite",
    audience: "hr",
    locale: "bs",
    addressingForm: "masculine",
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
      createdAt: "2026-05-12T06:00:00.000Z",
    },
    sourceAttempts: [
      {
        attemptId: "attempt-ipip",
        testId: "test-ipip",
        testSlug: "ipip-neo-120-v1",
        status: "completed",
        completedAt: "2026-05-12T06:30:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 0,
      },
      {
        attemptId: "attempt-safran",
        testId: "test-safran",
        testSlug: "safran_v1",
        status: "completed",
        completedAt: "2026-05-12T06:45:00.000Z",
        requiredForComposite: true,
        requiredForTeamFit: false,
        position: 1,
      },
      {
        attemptId: "attempt-mwms",
        testId: "test-mwms",
        testSlug: "mwms_v1",
        status: "completed",
        completedAt: "2026-05-12T07:00:00.000Z",
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
            domainCode: "CONSCIENTIOUSNESS",
            label: "Savjesnost",
            rawScore: 24,
            scoredQuestionCount: 12,
            averageScore: 4,
            band: "higher",
            bandLabel: "Vise izrazhzeno",
            displayScore: 4,
            displayBand: "higher",
            displayBandLabel: "Vise izrazhzeno",
            facets: [],
          },
          {
            domainCode: "AGREEABLENESS",
            label: "Spremnost na saradnju",
            rawScore: 18,
            scoredQuestionCount: 12,
            averageScore: 3,
            band: "balanced",
            bandLabel: "Uravnotezeno",
            displayScore: 3,
            displayBand: "balanced",
            displayBandLabel: "Uravnotezeno",
            facets: [],
          },
          {
            domainCode: "EXTRAVERSION",
            label: "Ekstraverzija",
            rawScore: 21,
            scoredQuestionCount: 12,
            averageScore: 3.5,
            band: "balanced",
            bandLabel: "Uravnotezeno",
            displayScore: 3.5,
            displayBand: "balanced",
            displayBandLabel: "Uravnotezeno",
            facets: [],
          },
          {
            domainCode: "NEUROTICISM",
            label: "Neuroticizam",
            rawScore: 26,
            scoredQuestionCount: 12,
            averageScore: 2.17,
            band: "lower",
            bandLabel: "Nize izrazhzeno",
            displayScore: 3.83,
            displayBand: "higher",
            displayBandLabel: "Vise izrazhzeno",
            facets: [],
          },
          {
            domainCode: "OPENNESS",
            label: "Otvorenost",
            rawScore: 20,
            scoredQuestionCount: 12,
            averageScore: 3.33,
            band: "balanced",
            bandLabel: "Uravnotezeno",
            displayScore: 3.33,
            displayBand: "balanced",
            displayBandLabel: "Uravnotezeno",
            facets: [],
          },
        ],
        summarySignals: {
          rankedDomains: ["CONSCIENTIOUSNESS", "AGREEABLENESS", "EXTRAVERSION"],
          highestDomains: ["CONSCIENTIOUSNESS"],
          lowestDomains: ["NEUROTICISM"],
          balancedDomains: [],
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
        dimensions: [],
        motivationStructure: {
          autonomousMotivationScore: 6,
          controlledMotivationScore: 3.5,
          amotivationScore: 1.8,
        },
        summarySignals: {
          dominantDrivers: ["intrinsic", "identified"],
          lowerDrivers: ["amotivation", "external_social"],
          cautionFlags: {
            elevatedAmotivation: false,
            highControlledRelativeToAutonomous: false,
            mixedProfile: false,
          },
        },
      },
    },
    summarySignals: {
      personalityHighestDomains: ["CONSCIENTIOUSNESS"],
      personalityLowestDomains: ["NEUROTICISM"],
      cognitiveStrongestDomain: "verbal",
      cognitiveLowestDomain: "figural",
      motivationHighestDrivers: ["intrinsic", "identified"],
      motivationLowestDrivers: ["amotivation", "external_social"],
      crossInstrumentFlags: [],
    },
    guardrails: {
      usesOnlyLinkedAssignmentAttempts: true,
      usesHistoricalAttemptFallback: false,
      usesSingleTestAiReportsAsPrimaryInput: false,
      aiMayNotChangeScores: true,
    },
    metadata: {
      builtAt: "2026-05-12T09:00:00.000Z",
      builderVersion: "v1",
    },
  };
}

function buildOpenAiSnapshotFixture(inputSnapshot) {
  return {
    contractVersion: "composite_hr_v1",
    reportType: "composite",
    audience: "hr",
    sourceType: "assessment",
    locale: inputSnapshot.locale,
    generatedFor: {
      organizationId: inputSnapshot.generatedFor.organizationId,
      participantId: inputSnapshot.generatedFor.participantId,
      assessmentAssignmentId: inputSnapshot.generatedFor.assessmentAssignmentId,
    },
    source: {
      inputContractVersion: inputSnapshot.contractVersion,
      sourceAttemptIds: inputSnapshot.sourceAttempts.map((attempt) => attempt.attemptId),
      testSlugs: [...inputSnapshot.coverage.completedTestSlugs],
    },
    summary: {
      headline: "Pouzdan stil rada uz dobar analiticki kapacitet",
      profileOverview:
        "Najvazniji radni signal je pouzdan stil rada uz dobar analiticki kapacitet. U intervjuu provjerite kako osoba postavlja prioritete kada se zahtjevi promijene.",
      keyStrengths: [
        "Jasna struktura rada moze pomoci u stabilnoj isporuci.",
        "Analiticki signal vrijedi povezati sa konkretnim zadacima uloge.",
      ],
      watchouts: [
        "U intervjuu provjerite konkretan primjer rada pod promjenom prioriteta.",
        "Trazite primjer situacije u kojoj je osoba uskladila kvalitet rada sa zahtjevima pozicije.",
      ],
    },
    integratedSignals: [
      {
        id: "signal-personality",
        title: "Ponasajni fokus za razgovor",
        body: "U radu ovo upucuje na potrebu za jasnim prioritetima. Provjerite kako osoba strukturise rad kada se prioriteti promijene.",
        evidence: [
          {
            testSlug: "ipip-neo-120-v1",
            label: "Spremnost na saradnju",
            value: "3.00 (Uravnotezeno)",
          },
        ],
      },
      {
        id: "signal-cognitive",
        title: "Kognitivni fokus za zadatke",
        body: "Signal je najkorisniji za zadatke koji traze provjeru tacnosti. Trazite konkretan primjer nacina razmisljanja pod vremenskim ogranicenjem.",
        evidence: [
          {
            testSlug: "safran_v1",
            label: "Ukupni kognitivni rezultat",
            value: "36/54",
          },
        ],
      },
    ],
    interviewGuidance: {
      focusAreas: [
        {
          title: "Organizacija rada pod promjenama",
          rationale: "Ovo pomaze HR-u da provjeri kako osoba reaguje kada se ritam rada promijeni.",
          questions: [
            "Kako organizujete rad kada se prioriteti promijene u kratkom roku?",
            "Kako provjeravate da je rjesenje i dalje kvalitetno kada imate vise paralelnih zahtjeva?",
          ],
        },
      ],
    },
    onboardingGuidance: {
      managementTips: [
        "Rano uskladiti kriterije kvaliteta i ritam kratkih provjera napretka.",
        "Koristiti konkretne radne primjere za prva uskladjivanja nacina rada.",
      ],
      supportNeeds: [
        "Provjerite koja kolicina strukture i povratne informacije najvise pomaze u prvim sedmicama.",
        "Za analiticke zadatke rano pokazite kako se provjerava tacnost.",
      ],
    },
    limitations: [
      "Ovaj izvjestaj je HR pomoc za interpretaciju deterministic inputa, ne automatska odluka.",
      "Nalaze treba citati zajedno sa iskustvom, intervjuom i zahtjevima konkretne uloge.",
    ],
    metadata: {
      provider: "openai",
      providerVersion: "v1",
      generatedAt: "2026-05-12T10:15:00.000Z",
    },
  };
}

async function main() {
  let writes = 0;
  let openAiCalls = 0;
  const noCallResult = await runCompositeHrOpenAiDryRun({
    env: {},
    requestRawReport: async () => {
      openAiCalls += 1;
      return {};
    },
    requestReviewerResult: async () => ({ approved: true, issues: [], summary: "ok" }),
    evaluateValidatorBoundary: () => {
      throw new Error("validator should not run in default mode");
    },
    writeFile: () => {
      writes += 1;
    },
  });

  assert.equal(noCallResult.confirmed, false);
  assert.equal(noCallResult.openAiCalled, false);
  assert.equal(noCallResult.databaseWrites, false);
  assert.equal(openAiCalls, 0);
  assert.equal(writes, 0);

  await assert.rejects(
    () =>
      runCompositeHrOpenAiDryRun({
        env: {
          NODE_ENV: "development",
          [CONFIRM_ENV]: "true",
          AI_REPORT_MODEL: "gpt-5.5",
          OPENAI_API_KEY: "test-key",
        },
        argv: [],
        requestRawReport: async () => {
          throw new Error("should not call without input path");
        },
        requestReviewerResult: async () => ({ approved: true, issues: [], summary: "ok" }),
        evaluateValidatorBoundary: () => {
          throw new Error("validator should not run without input path");
        },
      }),
    new RegExp(INPUT_PATH_ENV),
  );

  installTypeScriptRuntime();
  const {
    evaluateCompositeHrReportValidatorBoundary,
    classifyCompositeHrReviewerBoundary,
  } = require("../lib/assessment/composite-hr-report-provider-openai.ts");

  const inputSnapshot = buildCompositeInputSnapshotFixture();
  const reportSnapshot = buildOpenAiSnapshotFixture(inputSnapshot);
  const writesList = [];
  const chmodCalls = [];
  let reviewerCalls = 0;

  const artifact = await runCompositeHrOpenAiDryRun({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
      [INPUT_PATH_ENV]: "/tmp/composite-input-test.json",
      AI_REPORT_MODEL: "gpt-5.5",
      AI_REPORT_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
    },
    now: () => "2026-06-12T10:00:00.000Z",
    readFile: (filePath) => {
      assert.equal(filePath, "/tmp/composite-input-test.json");
      return JSON.stringify(inputSnapshot);
    },
    writeFile: (filePath, data, options) => {
      writesList.push({ filePath, data, options });
    },
    chmodFile: (filePath, mode) => {
      chmodCalls.push({ filePath, mode });
    },
    requestRawReport: async (input, options) => {
      openAiCalls += 1;
      assert.deepEqual(input, inputSnapshot);
      assert.equal(options.model, "gpt-5.5");
      return reportSnapshot;
    },
    requestReviewerResult: async (input, snapshot, options) => {
      reviewerCalls += 1;
      assert.deepEqual(input, inputSnapshot);
      assert.equal(snapshot.metadata.provider, "openai");
      assert.equal(options.model, "gpt-5.5");
      return {
        approved: true,
        issues: [],
        summary: "Diagnostic reviewer approved fixture.",
      };
    },
    evaluateValidatorBoundary: evaluateCompositeHrReportValidatorBoundary,
    classifyReviewerBoundary: classifyCompositeHrReviewerBoundary,
  });

  assert.equal(openAiCalls, 1);
  assert.equal(reviewerCalls, 1);
  assert.equal(artifact.metadata.confirmed, true);
  assert.equal(artifact.metadata.databaseWrites, false);
  assert.equal(artifact.metadata.reportRegenerated, false);
  assert.equal(artifact.metadata.productionFlowChanged, false);
  assert.equal(artifact.inputSummary.assignmentId, "assignment-1");
  assert.deepEqual(artifact.inputSummary.sourceAttemptIds, [
    "attempt-ipip",
    "attempt-safran",
    "attempt-mwms",
  ]);
  assert.deepEqual(artifact.parseResult, { ok: true, error: null });
  assert.equal(artifact.contractValidationResult.ok, true);
  assert.equal(artifact.languageQualityResult.ok, true);
  assert.deepEqual(artifact.languageQualityHardIssues, []);
  assert.deepEqual(artifact.languageQualityWarnings, []);
  assert.equal(artifact.reviewerResult.approved, true);
  assert.deepEqual(artifact.styleReviewerWarnings, []);
  assert.equal(artifact.validatorOffWouldHaveRawOutput, true);
  assert.equal(artifact.hardGateWouldPersist, true);
  assert.equal(artifact.validatorOnWouldPersist, true);
  assert.equal(artifact.productionWouldPersist, true);
  assert.deepEqual(artifact.failureReasons, []);
  assert.deepEqual(artifact.humanReviewHints, [
    "summary",
    "integratedSignals",
    "interviewGuidance",
    "onboardingGuidance",
    "limitations",
  ]);
  assert.match(artifact.dumpPath, /^\/tmp\/composite-hr-openai-dry-run-/);
  assert.equal(writesList.length, 1);
  assert.equal(writesList[0].filePath, artifact.dumpPath);
  assert.equal(writesList[0].options.mode, 0o600);
  assert.match(writesList[0].data, /"rawParsedOutput"/);
  assert.match(writesList[0].data, /"canonicalizedOutput"/);
  assert.match(writesList[0].data, /"hardGateWouldPersist": true/);
  assert.match(writesList[0].data, /"productionWouldPersist": true/);
  assert.match(writesList[0].data, /"validatorOnWouldPersist": true/);
  assert.doesNotMatch(writesList[0].data, /test-key/);
  assert.deepEqual(chmodCalls, [
    {
      filePath: artifact.dumpPath,
      mode: 0o600,
    },
  ]);

  const warningSnapshot = buildOpenAiSnapshotFixture(inputSnapshot);
  warningSnapshot.summary.profileOverview = "Glavni rizik zvuci kao rokovi visoki u svim situacijama.";

  const warningArtifact = await runCompositeHrOpenAiDryRun({
    env: {
      NODE_ENV: "development",
      [CONFIRM_ENV]: "true",
      [INPUT_PATH_ENV]: "/tmp/composite-input-test.json",
      AI_REPORT_MODEL: "gpt-5.5",
      AI_REPORT_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
    },
    now: () => "2026-06-12T10:05:00.000Z",
    readFile: () => JSON.stringify(inputSnapshot),
    writeFile: () => {},
    chmodFile: () => {},
    requestRawReport: async () => warningSnapshot,
    requestReviewerResult: async () => ({
      approved: false,
      issues: [
        {
          code: "UNNATURAL_BHS_LANGUAGE",
          severity: "blocking",
          message: "Style reviewer dislikes wording rhythm.",
        },
      ],
      summary: "Style-only rejection.",
    }),
    evaluateValidatorBoundary: evaluateCompositeHrReportValidatorBoundary,
    classifyReviewerBoundary: classifyCompositeHrReviewerBoundary,
  });

  assert.equal(warningArtifact.languageQualityResult.ok, false);
  assert.equal(warningArtifact.languageQualityHardIssues.length, 0);
  assert.equal(
    warningArtifact.languageQualityWarnings.some((issue) => issue.phrase === "rokovi visoki"),
    true,
  );
  assert.equal(warningArtifact.reviewerResult.approved, false);
  assert.equal(warningArtifact.reviewerResult.hardIssues.length, 0);
  assert.equal(warningArtifact.styleReviewerWarnings.length, 1);
  assert.equal(warningArtifact.hardGateWouldPersist, true);
  assert.equal(warningArtifact.validatorOnWouldPersist, true);
  assert.equal(warningArtifact.productionWouldPersist, true);
  assert.deepEqual(warningArtifact.failureReasons, []);

  console.log("test-inspect-composite-hr-openai-dry-run: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
