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
  buildMockSafranHrReportV1,
  validateSafranHrReport,
} = require("../lib/assessment/safran-hr-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-hr-bhs-language-policy",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 12, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 9, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 5, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 26, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 12,
        figuralScore: 9,
        numericalRawScore: 2.5,
        numericalAdjustedScore: 5,
        numericalScore: 5,
        numericalSeriesScore: 5,
        cognitiveCompositeScore: 26,
        cognitiveCompositeV1: 26,
      },
    },
  };
}

function buildPreparedInput(locale) {
  return buildPreparedReportGenerationInput(
    {
      attemptId: `attempt-safran-hr-bhs-language-policy-${locale}`,
      testId: "test-safran",
      testSlug: "safran_v1",
      audience: "hr",
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
  const report = buildMockSafranHrReportV1(input.promptInput);

  report.interpretationLimits = [
    "SAFRAN rezultat treba čitati samo u okviru ovog seta zadataka i čitati zajedno sa iskustvom, intervjuom i kontekstom uloge.",
    "Izvještaj nije odluka o zapošljavanju i ne treba ga koristiti za rangiranje osobe u odnosu na druge.",
    "Nalaze ne treba koristiti za rangiranje osobe u odnosu na druge.",
    "Nalaz ne treba čitati kao poređenje sa širom populacijom; čitajte kao signal iz ove procjene.",
    "Kognitivni signal je hipoteza za provjeru, ne konačan zaključak.",
  ];

  return report;
}

function main() {
  assert.ok(resolveAiReportLanguagePolicy("bs"));
  assert.equal(resolveAiReportLanguagePolicy("hr"), null);
  assert.equal(resolveAiReportLanguagePolicy("sr"), null);
  assert.equal(resolveAiReportLanguagePolicy("en"), null);
  assert.equal(resolveAiReportLanguagePolicy(null), null);

  const bsInput = buildPreparedInput("bs");
  const bsReport = buildValidReport(bsInput);
  bsReport.executiveSummary.summary =
    "Ovaj rezultat treba čitati kao opreznu HR hipotezu, ne kao konačan sud o osobi. Ovaj snapshot pokazuje high signal u ovom setu zadataka. HR treba provjeriti ovaj signal kroz intervju, iskustvo i kontekst uloge.";
  bsReport.cognitiveSignals.overall =
    "Ukupni rezultat je 26/54. High signal treba provjeriti kroz radni zadatak.";
  bsReport.pointsOfCaution[0].signal =
    "Ovaj snapshot može sakriti razlike između tipova zadataka.";

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  let validatedBsReport;

  try {
    validatedBsReport = validateStructuredReport(bsReport, bsInput);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(validatedBsReport.reportType, "safran_hr_report_v1");
  assert.equal(validatedBsReport.testSlug, "safran_v1");
  assert.equal(validatedBsReport.audience, "hr");
  assert.equal(validatedBsReport.sourceType, "single_test");
  assert.equal(validatedBsReport.locale, "bs");
  assert.equal(validatedBsReport.generatedLanguage, "bs");
  assert.strictEqual(validatedBsReport, bsReport);
  assert.match(validatedBsReport.executiveSummary.summary, /\bsnapshot\b/i);
  assert.match(validatedBsReport.executiveSummary.summary, /\bhigh\b/i);
  assert.match(validatedBsReport.cognitiveSignals.overall, /\bhigh\b/i);
  assert.match(validatedBsReport.pointsOfCaution[0].signal, /\bsnapshot\b/i);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /non-blocking findings/i);

  const invalidBsReport = buildValidReport(bsInput);
  invalidBsReport.executiveSummary.summary =
    "Ovaj rezultat treba čitati kao opreznu HR hipotezu, ne kao konačan sud o osobi. Ti treba da čitaš ovaj nalaz kroz intervju, iskustvo i kontekst uloge.";
  console.warn = (...args) => warnings.push(args);
  let invalidBsValidated;

  try {
    invalidBsValidated = validateStructuredReport(invalidBsReport, bsInput);
  } finally {
    console.warn = originalWarn;
  }

  assert.strictEqual(invalidBsValidated, invalidBsReport);
  assert.equal(warnings.length, 2);

  const invalidForSafranValidator = buildValidReport(bsInput);
  invalidForSafranValidator.safetyChecks.noHireNoHireDecision = false;
  assert.throws(
    () => validateStructuredReport(invalidForSafranValidator, bsInput),
    /SAFRAN HR report validation.*safetyChecks\.noHireNoHireDecision/i,
  );

  for (const locale of ["hr", "sr", "en"]) {
    const input = buildPreparedInput(locale);
    const report = buildValidReport(input);
    const reportBefore = clone(report);

    report.executiveSummary.summary =
      "Ovaj rezultat treba čitati kao opreznu HR hipotezu, ne kao konačan sud o osobi. Ovaj snapshot pokazuje high signal u ovom setu zadataka. HR treba provjeriti ovaj signal kroz intervju, iskustvo i kontekst uloge.";

    const validation = validateSafranHrReport(report, { expectedInput: input.promptInput });
    assert.equal(validation.ok, true);

    const validated = validateStructuredReport(report, input);
    assert.equal(validated.locale, locale);
    assert.equal(validated.generatedLanguage, locale);
    assert.match(validated.executiveSummary.summary, /\bsnapshot\b/i);
    assert.match(validated.executiveSummary.summary, /\bhigh\b/i);
    assert.equal(validated.reportType, reportBefore.reportType);
    assert.equal(validated.testSlug, reportBefore.testSlug);
    assert.equal(validated.audience, reportBefore.audience);
    assert.equal(validated.sourceType, reportBefore.sourceType);
  }

  console.log("test-safran-hr-bhs-language-policy: ok");
}

main();
