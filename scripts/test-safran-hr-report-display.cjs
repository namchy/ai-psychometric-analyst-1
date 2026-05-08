const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const nextLinkStubPath = path.join(__dirname, "test-stub-next-link.cjs");
const nextFontGoogleStubPath = path.join(__dirname, "test-stub-next-font-google.cjs");
const nextFontLocalStubPath = path.join(__dirname, "test-stub-next-font-local.cjs");
const rechartsStubPath = path.join(__dirname, "test-stub-recharts.cjs");
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

  if (request === "next/link") {
    return nextLinkStubPath;
  }

  if (request === "next/font/google") {
    return nextFontGoogleStubPath;
  }

  if (request === "next/font/local") {
    return nextFontLocalStubPath;
  }

  if (request === "recharts") {
    return rechartsStubPath;
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

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
}

require.extensions[".ts"] = compileTypeScript;
require.extensions[".tsx"] = compileTypeScript;

const {
  buildSafranHrReportInput,
  buildMockSafranHrReportV1,
} = require("../lib/assessment/safran-hr-report-v1.ts");
const {
  resolveSafranHrReportDisplay,
} = require("../lib/assessment/safran-hr-report-display.ts");
const {
  CompletedAssessmentSummary,
} = require("../components/assessment/completed-assessment-summary.tsx");

const input = buildSafranHrReportInput({
  testSlug: "safran_v1",
  locale: "bs",
  results: {
    attemptId: "attempt-safran-hr-display",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 12, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 8, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 5, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 25, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 12,
        figuralScore: 8,
        numericalRawScore: 2.5,
        numericalAdjustedScore: 5,
        numericalScore: 5,
        numericalSeriesScore: 5,
        cognitiveCompositeScore: 25,
        cognitiveCompositeV1: 25,
      },
    },
  },
});

const report = buildMockSafranHrReportV1(input);
const display = resolveSafranHrReportDisplay(report);

assert.ok(display);
assert.equal(display.header.title, "SAFRAN HR izvještaj");
assert.equal(display.executiveSummary.title, report.executiveSummary.title);
assert.deepEqual(
  display.cognitiveSignals.map((item) => item.key),
  ["overall", "verbal", "figural", "numeric"],
);
assert.equal(display.pointsOfCaution.length > 0, true);
assert.equal(display.interviewQuestions.length > 0, true);
assert.deepEqual(
  display.onboardingGuidance.map((group) => group.key),
  ["first30Days", "days60", "days90"],
);
assert.equal(display.interpretationLimits.length > 0, true);

const flattenedText = [
  display.header.eyebrow,
  display.header.title,
  display.header.subtitle,
  display.executiveSummary.title,
  display.executiveSummary.summary,
  ...display.cognitiveSignals.map((item) => item.label),
  ...display.cognitiveSignals.map((item) => item.body),
  ...display.pointsOfCaution.flatMap((item) => [
    item.signal,
    item.whyItMatters,
    item.howToCheck,
  ]),
  ...display.interviewQuestions.flatMap((item) => [
    item.category,
    item.question,
    item.whatToListenFor,
  ]),
  ...display.onboardingGuidance.flatMap((group) => [group.label, ...group.items]),
  ...display.interpretationLimits,
].join(" ");

assert.equal(/iq|percentil|percentile|norma|normativno|hire|no-hire|red flag/i.test(flattenedText), false);
assert.equal(report.audience, "hr");
assert.equal(report.sourceType, "single_test");
assert.equal(resolveSafranHrReportDisplay({
  reportType: "safran_participant_ai_report_v1",
  audience: "participant",
  testSlug: "safran_v1",
}), null);

const hrHtml = renderToStaticMarkup(
  React.createElement(CompletedAssessmentSummary, {
    completedAt: "2026-05-08T09:42:07.674Z",
    locale: "bs",
    organizationName: "Test organizacija",
    participantName: "Test kandidat",
    testSlug: "safran_v1",
    testName: "SAFRAN",
    results: {
      attemptId: "attempt-safran-hr-render",
      scoringMethod: "correct_answers",
      dimensions: [
        { dimension: "verbal_score", rawScore: 12, scoredQuestionCount: 18 },
        { dimension: "figural_score", rawScore: 8, scoredQuestionCount: 18 },
        { dimension: "numerical_series_score", rawScore: 5, scoredQuestionCount: 18 },
        { dimension: "cognitive_composite_v1", rawScore: 25, scoredQuestionCount: 54 },
      ],
      scoredResponseCount: 45,
      unscoredResponses: [],
      derived: {
        safranV1: {
          verbalScore: 12,
          figuralScore: 8,
          numericalRawScore: 2.5,
          numericalAdjustedScore: 5,
          numericalScore: 5,
          numericalSeriesScore: 5,
          cognitiveCompositeScore: 25,
          cognitiveCompositeV1: 25,
        },
      },
    },
    reportState: {
      status: "ready",
      reportFamily: "safran",
      reportAudience: "hr",
      reportVersion: "v1",
      reportRenderFormat: "safran_hr_report_v1",
      report,
    },
  }),
);

assert.equal(hrHtml.includes("SAFRAN HR izvještaj"), true);
assert.equal(hrHtml.includes("Namijenjeno HR-u"), true);
assert.equal(hrHtml.includes("Kognitivni signali"), true);
assert.equal(hrHtml.includes("Tačke opreza"), true);
assert.equal(hrHtml.includes("Preporučena intervju pitanja"), true);
assert.equal(hrHtml.includes("Onboarding smjernice"), true);
assert.equal(hrHtml.includes("Interpretacijska ograničenja"), true);

const participantHtml = renderToStaticMarkup(
  React.createElement(CompletedAssessmentSummary, {
    completedAt: "2026-05-08T09:42:07.674Z",
    locale: "bs",
    organizationName: "Test organizacija",
    participantName: "Test kandidat",
    testSlug: "safran_v1",
    testName: "SAFRAN",
    results: {
      attemptId: "attempt-safran-participant-render",
      scoringMethod: "correct_answers",
      dimensions: [
        { dimension: "verbal_score", rawScore: 18, scoredQuestionCount: 18 },
        { dimension: "figural_score", rawScore: 18, scoredQuestionCount: 18 },
        { dimension: "numerical_series_score", rawScore: 0, scoredQuestionCount: 18 },
        { dimension: "cognitive_composite_v1", rawScore: 36, scoredQuestionCount: 54 },
      ],
      scoredResponseCount: 45,
      unscoredResponses: [],
      derived: {
        safranV1: {
          verbalScore: 18,
          figuralScore: 18,
          numericalRawScore: 0,
          numericalAdjustedScore: 0,
          numericalScore: 0,
          numericalSeriesScore: 0,
          cognitiveCompositeScore: 36,
          cognitiveCompositeV1: 36,
        },
      },
    },
    reportState: {
      status: "ready",
      reportFamily: "safran",
      reportAudience: "participant",
      reportVersion: "v1",
      reportRenderFormat: "safran_participant_ai_report_v1",
      report: {
        reportType: "safran_participant_ai_report_v1",
        testSlug: "safran_v1",
        audience: "participant",
        locale: "bs",
        generatedLanguage: "bs",
        header: {
          title: "SAFRAN",
          subtitle: "Kognitivna procjena kroz verbalne, figuralne i numeričke zadatke.",
          statusLabel: "Završeno",
        },
        summary: {
          title: "Sažetak rezultata",
          scoreLabel: "36/54",
          bandLabel: "umjeren ukupni broj tačnih odgovora",
          interpretation:
            "Ukupni obrazac pokazuje vrlo stabilan verbalno-figuralni učinak uz izražen kontrast u odnosu na numerički dio.",
        },
        domains: [
          {
            code: "verbal",
            title: "Verbalni rezultat",
            scoreLabel: "18/18",
            bandLabel: "veći broj tačnih odgovora",
            interpretation: "Verbalni dio pokazuje stabilan obrazac.",
          },
          {
            code: "figural",
            title: "Figuralni rezultat",
            scoreLabel: "18/18",
            bandLabel: "veći broj tačnih odgovora",
            interpretation: "Figuralni dio pokazuje stabilan obrazac.",
          },
          {
            code: "numeric",
            title: "Numerički rezultat",
            scoreLabel: "0/18",
            bandLabel: "manji broj tačnih odgovora",
            interpretation: "Numerički dio traži oprezniju interpretaciju.",
          },
        ],
        cognitiveSignals: {
          title: "Profil kognitivnih signala",
          primarySignal: "Primarni signal je odnos verbalnog i figuralnog dijela.",
          cautionSignal: "Glavni oprez je da se kontrast ne pretvori u zaključak o osobi.",
          balanceNote: "Najviše smisla ima uporediti oblasti kao povezan obrazac.",
        },
        readingGuide: {
          title: "Kako čitati ove rezultate",
          bullets: [
            "Ovi rezultati ne predstavljaju mjeru opšte inteligencije.",
            "Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom referentnom grupom.",
            "Practice pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u scoring.",
            "SAFRAN rezultat ne treba koristiti kao samostalnu odluku o kandidatu.",
            "Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
          ],
        },
        nextStep: {
          title: "Sljedeći korak",
          body: "Korisno je provjeriti gdje je format bio jasniji, a gdje je tražio više provjere.",
          ctaLabel: "Nazad na pregled",
        },
        safetyChecks: {
          containsIqClaim: false,
          containsPercentileClaim: false,
          containsNormClaim: false,
          containsHireNoHireClaim: false,
          containsDiagnosisClaim: false,
          containsClinicalClaim: false,
          containsFixedAbilityClaim: false,
        },
      },
    },
  }),
);

assert.equal(participantHtml.includes("SAFRAN HR izvještaj"), false);
assert.equal(participantHtml.includes("Sažetak rezultata"), true);

console.log("SAFRAN HR report display tests passed.");
