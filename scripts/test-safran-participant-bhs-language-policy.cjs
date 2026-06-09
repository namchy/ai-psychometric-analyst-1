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
} = require("../lib/assessment/report-provider-helpers.ts");
const {
  validateStructuredReport,
} = require("../lib/assessment/report-provider-openai.ts");
const {
  resolveAiReportLanguagePolicy,
} = require("../lib/assessment/ai-report-language-policy.ts");
const {
  buildMockSafranParticipantAiReport,
  validateSafranParticipantAiReport,
} = require("../lib/assessment/safran-participant-ai-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-participant-bhs-language-policy",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 10, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 10, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 10, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 30, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 10,
        figuralScore: 10,
        numericalRawScore: 5,
        numericalAdjustedScore: 10,
        numericalScore: 10,
        numericalSeriesScore: 10,
        cognitiveCompositeScore: 30,
        cognitiveCompositeV1: 30,
      },
    },
  };
}

function buildPreparedInput(locale) {
  return buildPreparedReportGenerationInput(
    {
      attemptId: `attempt-safran-participant-bhs-language-policy-${locale ?? "null"}`,
      testId: "test-safran",
      testSlug: "safran_v1",
      audience: "participant",
      locale,
      scoringMethod: "correct_answers",
      promptVersion: "v1",
      testName: "SAFRAN",
      results: buildSafranResults(),
    },
    {
      promptVersionId: null,
      promptTemplate: null,
    },
  );
}

function buildValidReport(input) {
  const report = buildMockSafranParticipantAiReport(input.promptInput);

  report.summary.interpretation =
    "Ti ovaj snapshot možeš čitati kao high obrazac razlike između verbalnog, figuralnog i numeričkog dijela, a ne kao jedinstven zaključak o sebi.";
  report.domains[0].interpretation =
    "Verbalni dio pokazuje obrazac u kojem je format sa riječima i pojmovima djelovao jasnije, bez potrebe da se mijenja deterministička oznaka rezultata.";
  report.cognitiveSignals.primarySignal =
    "Primarni signal je snapshot odnos u kojem sva tri dijela traže pažnju na obrazac, a ne samo na ukupan rezultat.";
  report.readingGuide.bullets[0] =
    "Ti ovaj high snapshot čitaš kao učinak u SAFRAN zadacima koji ne predstavlja mjeru opšte inteligencije.";
  report.nextStep.body =
    "Ti možeš ovaj snapshot povezati sa situacijama u kojima je numerički ili verbalni obrazac tražio više provjere prije odgovora.";

  return report;
}

function expectThrows(fn, expectedPattern) {
  assert.throws(fn, expectedPattern);
}

function main() {
  assert.ok(resolveAiReportLanguagePolicy("bs"));
  assert.equal(resolveAiReportLanguagePolicy("hr"), null);
  assert.equal(resolveAiReportLanguagePolicy("sr"), null);
  assert.equal(resolveAiReportLanguagePolicy("en"), null);
  assert.equal(resolveAiReportLanguagePolicy("unknown"), null);
  assert.equal(resolveAiReportLanguagePolicy(null), null);
  assert.equal(resolveAiReportLanguagePolicy("de"), null);

  const bsInput = buildPreparedInput("bs");
  const validatedBsReport = validateStructuredReport(buildValidReport(bsInput), bsInput);
  assert.equal(validatedBsReport.reportType, "safran_participant_ai_report_v1");
  assert.equal(validatedBsReport.testSlug, "safran_v1");
  assert.equal(validatedBsReport.audience, "participant");
  assert.equal(validatedBsReport.locale, "bs");
  assert.equal(validatedBsReport.generatedLanguage, "bs");
  assert.equal(validatedBsReport.summary.scoreLabel, "30/54");
  assert.equal(validatedBsReport.summary.bandLabel, "umjeren ukupni broj tačnih odgovora");
  assert.equal(validatedBsReport.domains[0].code, "verbal");
  assert.equal(validatedBsReport.domains[0].scoreLabel, "10/18");
  assert.equal(validatedBsReport.domains[0].bandLabel, "umjeren broj tačnih odgovora");
  assert.equal(validatedBsReport.safetyChecks.containsIqClaim, false);
  assert.doesNotMatch(validatedBsReport.summary.interpretation, /\bsnapshot\b/i);
  assert.doesNotMatch(validatedBsReport.summary.interpretation, /\bhigh\b/i);
  assert.match(validatedBsReport.summary.interpretation, /izvještaj/i);
  assert.match(validatedBsReport.summary.interpretation, /visoko izraženo/i);
  assert.doesNotMatch(validatedBsReport.cognitiveSignals.primarySignal, /\bsnapshot\b/i);
  assert.match(validatedBsReport.cognitiveSignals.primarySignal, /izvještaj/i);
  assert.doesNotMatch(validatedBsReport.readingGuide.bullets[0], /\bhigh\b/i);
  assert.match(validatedBsReport.readingGuide.bullets[0], /visoko izraženo/i);
  assert.match(validatedBsReport.nextStep.body, /\bTi\b/i);

  const directValidation = validateSafranParticipantAiReport(validatedBsReport, {
    expectedInput: bsInput.promptInput,
  });
  assert.equal(
    directValidation.ok,
    true,
    directValidation.ok ? undefined : directValidation.errors.join(" | "),
  );

  for (const locale of ["hr", "sr", "en", "unknown", null, "de"]) {
    const input = buildPreparedInput(locale);
    const report = buildValidReport(input);
    const validated = validateStructuredReport(report, input);
    assert.match(validated.summary.interpretation, /\bsnapshot\b/i);
    assert.match(validated.summary.interpretation, /\bhigh\b/i);
    assert.match(validated.readingGuide.bullets[0], /\bhigh\b/i);
    assert.equal(validated.reportType, "safran_participant_ai_report_v1");
    assert.equal(validated.testSlug, "safran_v1");
    assert.equal(validated.audience, "participant");
    assert.equal(validated.locale, input.promptInput.test.locale);
    assert.equal(validated.generatedLanguage, input.promptInput.test.locale);
    assert.equal(validated.summary.scoreLabel, input.promptInput.scores.overall.scoreLabel);
    assert.equal(validated.summary.bandLabel, input.promptInput.scores.overall.bandLabel);
    assert.equal(validated.domains[0].code, "verbal");
    assert.equal(validated.domains[1].code, "figural");
    assert.equal(validated.domains[2].code, "numeric");
    assert.equal(validated.safetyChecks.containsIqClaim, false);
  }

  const blockedBsReport = buildValidReport(bsInput);
  blockedBsReport.nextStep.body =
    "Ti ovaj prompt čitaš kroz schema JSON validator jezik dok gledaš rezultat.";
  expectThrows(
    () => validateStructuredReport(blockedBsReport, bsInput),
    /global BHS SAFRAN participant output validation/i,
  );

  const invalidForSafranValidator = buildValidReport(bsInput);
  invalidForSafranValidator.safetyChecks.containsIqClaim = true;
  expectThrows(
    () => validateStructuredReport(invalidForSafranValidator, bsInput),
    /SAFRAN participant report validation.*safetyChecks\.containsIqClaim/i,
  );

  const fieldProtectionReport = buildValidReport(bsInput);
  const fieldProtectionValidated = validateStructuredReport(clone(fieldProtectionReport), bsInput);
  assert.equal(fieldProtectionValidated.reportType, fieldProtectionReport.reportType);
  assert.equal(fieldProtectionValidated.testSlug, fieldProtectionReport.testSlug);
  assert.equal(fieldProtectionValidated.audience, fieldProtectionReport.audience);
  assert.equal(fieldProtectionValidated.locale, fieldProtectionReport.locale);
  assert.equal(fieldProtectionValidated.generatedLanguage, fieldProtectionReport.generatedLanguage);
  assert.equal(fieldProtectionValidated.summary.scoreLabel, fieldProtectionReport.summary.scoreLabel);
  assert.equal(fieldProtectionValidated.summary.bandLabel, fieldProtectionReport.summary.bandLabel);
  assert.equal(fieldProtectionValidated.domains[0].code, fieldProtectionReport.domains[0].code);
  assert.equal(fieldProtectionValidated.domains[0].scoreLabel, fieldProtectionReport.domains[0].scoreLabel);
  assert.equal(fieldProtectionValidated.domains[0].bandLabel, fieldProtectionReport.domains[0].bandLabel);
  assert.equal(
    fieldProtectionValidated.safetyChecks.containsFixedAbilityClaim,
    fieldProtectionReport.safetyChecks.containsFixedAbilityClaim,
  );

  console.log("test-safran-participant-bhs-language-policy: ok");
}

main();
