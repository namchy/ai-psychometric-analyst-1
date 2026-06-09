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
  buildPreparedReportGenerationInput,
  buildSingleTestHrPromptAuthorityMetadata,
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  buildUserPrompt,
  validateStructuredReport,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  resolveAiReportLanguagePolicy,
} = require("../lib/assessment/ai-report-language-policy.ts");
const {
  IPIP_NEO_120_DOMAIN_ORDER,
  IPIP_NEO_120_FACETS_BY_DOMAIN,
} = require("../lib/assessment/ipip-neo-120-labels.ts");
const { mockReportProvider } = require("../lib/assessment/report-provider-mock.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildPromptTemplate(id, promptKey) {
  return {
    id,
    testId: `${id}-test`,
    reportType: "individual",
    audience: "hr",
    sourceType: "single_test",
    generatorType: "openai",
    promptKey,
    version: "db-v1",
    systemPrompt: "DB system prompt",
    userPromptTemplate: "DB user prompt {{prompt_version_id}} {{prompt_version}}",
    outputSchemaJson: null,
    notes: null,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
    updatedBy: null,
  };
}

function buildIpipResults() {
  const dimensions = [];

  for (const [domainIndex, domainCode] of IPIP_NEO_120_DOMAIN_ORDER.entries()) {
    for (const [facetIndex, facetCode] of IPIP_NEO_120_FACETS_BY_DOMAIN[domainCode].entries()) {
      dimensions.push({
        dimension: facetCode,
        rawScore: 4.5 - domainIndex * 0.2 - facetIndex * 0.05,
        scoredQuestionCount: 4,
      });
    }
  }

  return {
    attemptId: "attempt-ipip-family-bhs-smoke",
    scoringMethod: "likert_mean",
    dimensions,
    scoredResponseCount: 120,
    unscoredResponses: [],
  };
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-family-bhs-smoke",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 11, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 10, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 7, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 28, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 11,
        figuralScore: 10,
        numericalRawScore: 3.5,
        numericalAdjustedScore: 7,
        numericalScore: 7,
        numericalSeriesScore: 7,
        cognitiveCompositeScore: 28,
        cognitiveCompositeV1: 28,
      },
    },
  };
}

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms-family-bhs-smoke",
    scoringMethod: "likert_sum",
    dimensions: [
      { dimension: "amotivation", rawScore: 4, scoredQuestionCount: 3 },
      { dimension: "external_social", rawScore: 4.25, scoredQuestionCount: 3 },
      { dimension: "external_material", rawScore: 4.5, scoredQuestionCount: 3 },
      { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
      { dimension: "identified", rawScore: 4.75, scoredQuestionCount: 3 },
      { dimension: "intrinsic", rawScore: 5, scoredQuestionCount: 3 },
    ],
    scoredResponseCount: 19,
    unscoredResponses: [],
  };
}

function buildPreparedInput(definition, locale = "bs") {
  return buildPreparedReportGenerationInput(
    {
      attemptId: definition.attemptId,
      testId: definition.testId,
      testSlug: definition.testSlug,
      audience: "hr",
      locale,
      scoringMethod: definition.scoringMethod,
      promptVersion: definition.promptVersion,
      testName: definition.testName,
      results: definition.results,
    },
    {
      promptVersionId: definition.promptVersionId,
      promptTemplate: buildPromptTemplate(definition.promptVersionId, definition.promptKey),
    },
  );
}

function assertAuthorityMetadata(metadata, expected) {
  assert.ok(metadata);
  assert.equal(metadata.reportFamily, "single_test_hr");
  assert.equal(metadata.reportKind, expected.reportKind);
  assert.equal(metadata.reportLaneId, `${expected.reportKind}:${expected.testSlug}:hr`);
  assert.equal(metadata.promptSource, "db_prompt_version");
  assert.equal(metadata.promptVersionId, expected.promptVersionId);
  assert.equal(metadata.promptVersion, "db-v1");
  assert.equal(metadata.promptKey, expected.promptKey);
  assert.deepEqual(metadata.authorityLayers, [
    "global_bhs_language_policy",
    "global_hr_report_policy",
    "single_test_hr_family_policy",
    "test_specific_terminology_policy",
    "runtime_input_facts",
  ]);
}

async function main() {
  const definitions = {
    ipip: {
      attemptId: "attempt-ipip-family-bhs-smoke",
      testId: "test-ipip",
      testSlug: "ipip-neo-120-v1",
      scoringMethod: "likert_mean",
      promptVersion: "ipip_neo_120_hr_v2",
      promptVersionId: "prompt-version-ipip-family",
      promptKey: "completed_assessment_report",
      testName: "IPIP-NEO-120",
      reportKind: "ipip_hr",
      results: buildIpipResults(),
    },
    safran: {
      attemptId: "attempt-safran-family-bhs-smoke",
      testId: "test-safran",
      testSlug: "safran_v1",
      scoringMethod: "correct_answers",
      promptVersion: "safran_hr_report_v1",
      promptVersionId: "prompt-version-safran-family",
      promptKey: "safran_hr_report_v1",
      testName: "SAFRAN",
      reportKind: "safran_hr",
      results: buildSafranResults(),
    },
    mwms: {
      attemptId: "attempt-mwms-family-bhs-smoke",
      testId: "test-mwms",
      testSlug: "mwms_v1",
      scoringMethod: "likert_sum",
      promptVersion: "mwms_hr_report_v1",
      promptVersionId: "prompt-version-mwms-family",
      promptKey: "mwms_hr_report_v1",
      testName: "Procjena radne motivacije",
      reportKind: "mwms_hr",
      results: buildMwmsResults(),
    },
  };

  assert.equal(resolveAiReportLanguagePolicy("bs")?.key, "bhs_bs_user_facing");

  for (const locale of ["hr", "sr", "en", "unknown", "fr", "de", "bs-Latn", null]) {
    assert.equal(resolveAiReportLanguagePolicy(locale), null);
  }

  const ipipBsInput = buildPreparedInput(definitions.ipip, "bs");
  const safranBsInput = buildPreparedInput(definitions.safran, "bs");
  const mwmsBsInput = buildPreparedInput(definitions.mwms, "bs");

  const ipipBsPrompt = buildUserPrompt(ipipBsInput);
  const safranBsPrompt = buildUserPrompt(safranBsInput);
  const mwmsBsPrompt = buildUserPrompt(mwmsBsInput);

  assert.match(ipipBsPrompt, /Global BHS user-facing language policy/i);
  assert.doesNotMatch(safranBsPrompt, /Global BHS user-facing language policy/i);
  assert.doesNotMatch(mwmsBsPrompt, /Global BHS user-facing language policy/i);

  const ipipHrPrompt = buildUserPrompt(buildPreparedInput(definitions.ipip, "hr"));
  assert.doesNotMatch(ipipHrPrompt, /Global BHS user-facing language policy/i);
  assert.match(ipipHrPrompt, /IPIP-NEO-120 HR terminology authority rules/i);

  assertAuthorityMetadata(
    buildSingleTestHrPromptAuthorityMetadata(ipipBsInput),
    definitions.ipip,
  );
  assertAuthorityMetadata(
    buildSingleTestHrPromptAuthorityMetadata(safranBsInput),
    definitions.safran,
  );
  assertAuthorityMetadata(
    buildSingleTestHrPromptAuthorityMetadata(mwmsBsInput),
    definitions.mwms,
  );

  const ipipBaseResult = await mockReportProvider.generateReport(ipipBsInput);
  const safranBaseResult = await mockReportProvider.generateReport(safranBsInput);
  const mwmsBaseResult = await mockReportProvider.generateReport(mwmsBsInput);

  assert.equal(ipipBaseResult.ok, true, ipipBaseResult.ok ? undefined : ipipBaseResult.reason);
  assert.equal(safranBaseResult.ok, true, safranBaseResult.ok ? undefined : safranBaseResult.reason);
  assert.equal(mwmsBaseResult.ok, true, mwmsBaseResult.ok ? undefined : mwmsBaseResult.reason);

  if (!ipipBaseResult.ok || !safranBaseResult.ok || !mwmsBaseResult.ok) {
    throw new Error("Expected offline mock reports for IPIP/SAFRAN/MWMS HR family audit.");
  }

  const ipipBsReport = clone(ipipBaseResult.report);
  ipipBsReport.headline = "Saradljivost i Kooperativnost traže provjeru kroz intervju.";
  ipipBsReport.executive_summary =
    "Ovaj snapshot pokazuje high signal. U ovom izvještaju visoka Savjesnost traži dodatnu provjeru.";
  ipipBsReport.domain_overview[1].domain_name = "Saradljivost";
  ipipBsReport.domain_overview[1].concise_meaning =
    "Kooperativnost opisuje odnos prema drugima u radu.";
  const originalIpipContractVersion = ipipBsReport.contract_version;
  const originalIpipLanguage = ipipBsReport.meta.language;
  const originalIpipBand = ipipBsReport.domain_overview[0].score_label_or_band;

  const validatedIpipBs = validateStructuredReport(ipipBsReport, ipipBsInput);
  assert.equal(validatedIpipBs.contract_version, originalIpipContractVersion);
  assert.equal(validatedIpipBs.meta.language, originalIpipLanguage);
  assert.equal(validatedIpipBs.domain_overview[0].score_label_or_band, originalIpipBand);
  assert.match(validatedIpipBs.headline, /Spremnost na saradnju/i);
  assert.doesNotMatch(validatedIpipBs.headline, /\bSaradljivost\b/i);
  assert.doesNotMatch(validatedIpipBs.executive_summary, /\bsnapshot\b/i);
  assert.doesNotMatch(validatedIpipBs.executive_summary, /\bhigh\b/i);
  assert.match(validatedIpipBs.executive_summary, /izvještaj/i);
  assert.match(validatedIpipBs.executive_summary, /visoka savjesnost/i);

  const ipipGlobalGateReport = clone(ipipBaseResult.report);
  ipipGlobalGateReport.executive_summary = "Ti treba da citas ovaj prompt kao finalnu odluku.";
  assert.throws(
    () => validateStructuredReport(ipipGlobalGateReport, ipipBsInput),
    /global BHS HR output validation.*second-person singular/i,
  );

  const safranBsReport = clone(safranBaseResult.report);
  safranBsReport.executiveSummary.summary =
    "Ovaj snapshot pokazuje high signal u ovom setu zadataka i trazi dodatnu HR provjeru.";
  safranBsReport.cognitiveSignals.overall =
    "High signal treba provjeriti kroz intervju i radni zadatak.";
  safranBsReport.pointsOfCaution[0].signal =
    "Ovaj snapshot moze sakriti razlike izmedju tipova zadataka.";
  const originalSafranReportType = safranBsReport.reportType;
  const originalSafranTestSlug = safranBsReport.testSlug;
  const originalSafranSourceType = safranBsReport.sourceType;
  const originalSafranGeneratedLanguage = safranBsReport.generatedLanguage;
  const originalSafranLocale = safranBsReport.locale;
  const validatedSafranBs = validateStructuredReport(safranBsReport, safranBsInput);
  assert.equal(validatedSafranBs.reportType, originalSafranReportType);
  assert.equal(validatedSafranBs.testSlug, originalSafranTestSlug);
  assert.equal(validatedSafranBs.sourceType, originalSafranSourceType);
  assert.equal(validatedSafranBs.generatedLanguage, originalSafranGeneratedLanguage);
  assert.equal(validatedSafranBs.locale, originalSafranLocale);
  assert.doesNotMatch(validatedSafranBs.executiveSummary.summary, /\bsnapshot\b/i);
  assert.doesNotMatch(validatedSafranBs.executiveSummary.summary, /\bhigh\b/i);
  assert.match(validatedSafranBs.executiveSummary.summary, /izvještaj/i);
  assert.match(validatedSafranBs.executiveSummary.summary, /visoko izraženo/i);
  assert.match(validatedSafranBs.cognitiveSignals.overall, /visoko izraženo/i);
  assert.match(validatedSafranBs.pointsOfCaution[0].signal, /izvještaj/i);

  const safranGlobalGateReport = clone(safranBaseResult.report);
  safranGlobalGateReport.executiveSummary.summary =
    "Ti treba da citas ovaj prompt kao finalnu odluku o kandidatu.";
  safranGlobalGateReport.safetyChecks.noHireNoHireDecision = false;
  assert.throws(
    () => validateStructuredReport(safranGlobalGateReport, safranBsInput),
    /global BHS SAFRAN HR output validation.*second-person singular/i,
  );

  const mwmsBsReport = clone(mwmsBaseResult.report);
  mwmsBsReport.key_motivational_drivers[0].evidence =
    "Ovaj snapshot pokazuje moderate signal koji treba citati oprezno.";
  mwmsBsReport.manager_support_guidance[0].recommendation =
    "Koristi ovaj high signal kao prakticnu temu za razgovor.";
  mwmsBsReport.work_context_hypotheses[0].verification =
    "U ovom snapshot okviru provjeriti koje zadatke kandidat dozivljava kao vrijedne.";
  const originalMwmsReportType = mwmsBsReport.reportType;
  const originalMwmsTestSlug = mwmsBsReport.testSlug;
  const originalMwmsSourceType = mwmsBsReport.sourceType;
  const originalMwmsGeneratedAt = mwmsBsReport.meta.generatedAt;
  const originalMwmsLocale = mwmsBsReport.locale;
  const originalMwmsLanguage = mwmsBsReport.meta.language;
  const originalMwmsRawScore = mwmsBsReport.motivation_profile_snapshot.dimensions[0].rawScore;
  const originalMwmsBand = mwmsBsReport.motivation_profile_snapshot.dimensions[0].band;

  const validatedMwmsBs = validateStructuredReport(mwmsBsReport, mwmsBsInput);
  assert.equal(validatedMwmsBs.reportType, originalMwmsReportType);
  assert.equal(validatedMwmsBs.testSlug, originalMwmsTestSlug);
  assert.equal(validatedMwmsBs.sourceType, originalMwmsSourceType);
  assert.equal(validatedMwmsBs.meta.generatedAt, originalMwmsGeneratedAt);
  assert.equal(validatedMwmsBs.locale, originalMwmsLocale);
  assert.equal(validatedMwmsBs.meta.language, originalMwmsLanguage);
  assert.equal(validatedMwmsBs.motivation_profile_snapshot.dimensions[0].rawScore, originalMwmsRawScore);
  assert.equal(validatedMwmsBs.motivation_profile_snapshot.dimensions[0].band, originalMwmsBand);
  assert.doesNotMatch(validatedMwmsBs.key_motivational_drivers[0].evidence, /\bsnapshot\b/i);
  assert.doesNotMatch(validatedMwmsBs.key_motivational_drivers[0].evidence, /\bmoderate\b/i);
  assert.match(validatedMwmsBs.key_motivational_drivers[0].evidence, /izvještaj/i);
  assert.match(validatedMwmsBs.key_motivational_drivers[0].evidence, /umjereno izrazeno|umjereno izraženo/i);
  assert.match(validatedMwmsBs.manager_support_guidance[0].recommendation, /visoko izrazeno|visoko izraženo/i);
  assert.match(validatedMwmsBs.work_context_hypotheses[0].verification, /izvještaj/i);

  const mwmsGlobalGateReport = clone(mwmsBaseResult.report);
  mwmsGlobalGateReport.interpretation_note =
    "Ti treba da citas ovaj prompt kao finalnu odluku o kandidatu.";
  mwmsGlobalGateReport.safety_checks.noScoreMutation = false;
  assert.throws(
    () => validateStructuredReport(mwmsGlobalGateReport, mwmsBsInput),
    /global BHS MWMS HR output validation.*second-person singular/i,
  );

  console.log("test-single-test-hr-bhs-policy-family: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
