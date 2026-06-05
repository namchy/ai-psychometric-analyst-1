const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const displaySource = fs.readFileSync(
  path.join(projectRoot, "lib/assessment/safran-participant-report-display.ts"),
  "utf8",
);
const rendererSource = fs.readFileSync(
  path.join(projectRoot, "components/assessment/completed-assessment-summary.tsx"),
  "utf8",
);
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
  buildMockSafranParticipantAiReport,
  buildSafranParticipantAiReportInput,
} = require("../lib/assessment/safran-participant-ai-report-v1.ts");
const {
  CompletedAssessmentSummary,
} = require("../components/assessment/completed-assessment-summary.tsx");
const {
  buildSafranParticipantReportDisplay,
  resolveSafranParticipantReportDisplay,
} = require("../lib/assessment/safran-participant-report-display.ts");

function flattenDisplayTexts(display) {
  return [
    display.header.eyebrow,
    display.header.title,
    display.header.subtitle,
    ...display.sections.flatMap((section) => {
      switch (section.id) {
        case "summary":
          return [
            section.title,
            section.body,
            section.overall.label,
            section.overall.helper,
            section.overall.summary,
          ];
        case "domains":
          return [
            section.title,
            ...section.rows.flatMap((row) => [row.label, row.helper, row.summary]),
          ];
        case "signals":
          return [
            section.title,
            section.body,
            ...section.items,
            ...(section.segments ?? []).flatMap((segment) => [segment.label, segment.body]),
          ];
        case "reading_guide":
          return [section.title, ...section.items];
        case "next_step":
          return [section.title, ...(section.items ?? []), section.body, section.ctaLabel];
        default:
          return [];
      }
    }),
  ].filter(Boolean);
}

function countOccurrences(value, expected) {
  return value.split(expected).length - 1;
}

function assertOccursOnce(output, expected, label) {
  assert.equal(
    countOccurrences(output, expected),
    1,
    `Expected ${label} to render exactly once: ${expected}`,
  );
}

function getHtmlSliceBetween(output, startText, endText, label) {
  const start = output.indexOf(startText);
  assert.notEqual(start, -1, `Expected ${label} start marker: ${startText}`);

  const end = output.indexOf(endText, start);
  assert.notEqual(end, -1, `Expected ${label} end marker: ${endText}`);

  return output.slice(start, end);
}

const readyAiMarkerText = {
  summaryInterpretation:
    "SAFRAN READY SUMMARY MARKER: Ukupni obrazac pokazuje marker odnos između verbalnog, figuralnog i numeričkog dijela bez renderer dopune.",
  verbalInterpretation:
    "SAFRAN READY DOMAIN VERBAL MARKER: Verbalni report field ostaje direktan opis zadataka s pojmovima.",
  figuralInterpretation:
    "SAFRAN READY DOMAIN FIGURAL MARKER: Figuralni report field ostaje direktan opis odnosa među oblicima.",
  numericInterpretation:
    "SAFRAN READY DOMAIN NUMERIC MARKER: Numerički report field ostaje direktan opis numeričkog kontrasta.",
  primarySignal:
    "SAFRAN READY PRIMARY SIGNAL MARKER: Primarni signal opisuje odnos verbalnog, figuralnog i numeričkog dijela.",
  balanceNote:
    "SAFRAN READY BALANCE NOTE MARKER: Balance note ostaje odvojeno poređenje tri SAFRAN oblasti.",
  cautionSignal:
    "SAFRAN READY CAUTION SIGNAL MARKER: Caution signal ostaje zaseban oprez o numeričkom kontrastu.",
  readingGuideTitle:
    "SAFRAN READY READING GUIDE TITLE MARKER",
  readingGuideIq:
    "SAFRAN READY READING BULLET INTELLIGENCE MARKER: Ovi rezultati ne predstavljaju mjeru opšte inteligencije.",
  readingGuidePercentile:
    "SAFRAN READY READING BULLET LOCAL MARKER: Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom referentnom grupom.",
  readingGuidePractice:
    "SAFRAN READY READING BULLET PRACTICE MARKER: Practice pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u scoring.",
  readingGuideDecision:
    "SAFRAN READY READING BULLET DECISION MARKER: SAFRAN rezultat ne treba koristiti kao samostalnu odluku o kandidatu.",
  readingGuideContext:
    "SAFRAN READY READING BULLET CONTEXT MARKER: Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
  nextStepTitle:
    "SAFRAN READY NEXT STEP TITLE MARKER",
  nextStepBody:
    "SAFRAN READY NEXT STEP BODY MARKER: Sljedeći korak ostaje praktična refleksija o tome gdje je format bio jasan, a gdje je tražio više provjere.",
};

const display = buildSafranParticipantReportDisplay({
  testName: "SAFRAN",
  scores: {
    verbal_score: 15,
    figural_score: 8,
    numerical_series_score: 6,
    cognitive_composite_v1: 29,
  },
});

assert.deepEqual(
  display.sections.map((section) => section.id),
  ["summary", "domains", "signals", "reading_guide", "next_step"],
);
assert.equal(display.narrativeAvailable, false);
assert.equal(
  display.sections[0].body,
  "Rezultati testa su dostupni, ali detaljan narativni izvještaj još nije spreman za prikaz.",
);
assert.equal(display.sections[0].overall.score, 29);
assert.deepEqual(
  display.sections[1].rows.map((row) => row.score),
  [15, 8, 6],
);
assert.deepEqual(
  display.sections[1].rows.map((row) => row.summary),
  ["", "", ""],
);
assert.equal(display.sections[2].body, "");
assert.deepEqual(display.sections[3].items, []);
assert.equal(display.sections[4].body, undefined);

const forbiddenPhrases = [
  "V1",
  "Ukupni kognitivni kompozit",
  "Rezultat ne znači",
  "IQ",
  "percentil",
  "iznadprosječan",
  "ispodprosječan",
  "hire",
  "no-hire",
];

for (const text of flattenDisplayTexts(display)) {
  for (const forbiddenPhrase of forbiddenPhrases) {
    assert.equal(
      text.toLowerCase().includes(forbiddenPhrase.toLowerCase()),
      false,
      `Display text unexpectedly contains "${forbiddenPhrase}": ${text}`,
    );
  }
}

for (const personalizedFallbackText of [
  "Rezultat ispod sažima učinak u ovom pokušaju",
  "Verbalni dio govori o tome kako si",
  "Figuralni rezultat ukazuje na prepoznavanje obrazaca",
  "Numerički rezultat se izdvaja kao najizraženiji dio ovog profila",
  "Pregled po oblastima ovdje daje najkorisniju sliku",
  "Pogledaj u kojim oblastima si imao ili imala stabilniji ritam",
]) {
  assert.equal(flattenDisplayTexts(display).join(" ").includes(personalizedFallbackText), false);
}

const aiInput = buildSafranParticipantAiReportInput({
  testSlug: "safran_v1",
  locale: "bs",
  results: {
    attemptId: "attempt-safran-display",
    scoringMethod: "correct_answers",
    dimensions: [
      { dimension: "verbal_score", rawScore: 15, scoredQuestionCount: 18 },
      { dimension: "figural_score", rawScore: 8, scoredQuestionCount: 18 },
      { dimension: "numerical_series_score", rawScore: 6, scoredQuestionCount: 18 },
      { dimension: "cognitive_composite_v1", rawScore: 29, scoredQuestionCount: 54 },
    ],
    scoredResponseCount: 45,
    unscoredResponses: [],
    derived: {
      safranV1: {
        verbalScore: 15,
        figuralScore: 8,
        numericalRawScore: 3,
        numericalAdjustedScore: 6,
        numericalScore: 6,
        numericalSeriesScore: 6,
        cognitiveCompositeScore: 29,
        cognitiveCompositeV1: 29,
      },
    },
  },
});
const aiReport = buildMockSafranParticipantAiReport(aiInput);
const aiDisplay = resolveSafranParticipantReportDisplay({
  scores: {
    verbal_score: 15,
    figural_score: 8,
    numerical_series_score: 6,
    cognitive_composite_v1: 29,
  },
  testName: "SAFRAN",
  aiReport,
});
assert.equal(aiDisplay.header.title, "SAFRAN");
assert.equal(aiDisplay.narrativeAvailable, true);
assert.equal(aiDisplay.header.statusLabel, "Završeno");
assert.equal(aiDisplay.sections[0].overall.helper, aiReport.summary.bandLabel);
assert.equal(aiDisplay.sections[2].title, aiReport.cognitiveSignals.title);
assert.equal(aiDisplay.sections[3].title, aiReport.readingGuide.title);
assert.equal(aiDisplay.sections[4].title, aiReport.nextStep.title);
assert.equal(
  aiDisplay.sections[0].body,
  aiReport.summary.interpretation,
);
assert.equal(aiDisplay.sections[0].overall.summary, "");
assert.deepEqual(
  aiDisplay.sections[1].rows.map((row) => row.summary),
  aiReport.domains.map((domain) => domain.interpretation),
);
assert.deepEqual(
  aiDisplay.sections[2].segments.map((segment) => segment.body),
  [
    aiReport.cognitiveSignals.primarySignal,
    aiReport.cognitiveSignals.balanceNote,
    aiReport.cognitiveSignals.cautionSignal,
  ],
);
assert.deepEqual(aiDisplay.sections[3].items, aiReport.readingGuide.bullets);
assert.equal(aiDisplay.sections[4].body, aiReport.nextStep.body);
assert.equal(aiDisplay.sections[4].ctaLabel, aiReport.nextStep.ctaLabel);

const fallbackDisplay = resolveSafranParticipantReportDisplay({
  scores: {
    verbal_score: 15,
    figural_score: 8,
    numerical_series_score: 6,
    cognitive_composite_v1: 29,
  },
  testName: "SAFRAN",
});
assert.equal(fallbackDisplay.header.statusLabel, undefined);
assert.equal(fallbackDisplay.narrativeAvailable, false);
assert.equal(fallbackDisplay.sections[0].title, "Rezultati testa");
assert.equal(
  fallbackDisplay.sections[0].body,
  "Rezultati testa su dostupni, ali detaljan narativni izvještaj još nije spreman za prikaz.",
);
const failedFallbackDisplay = resolveSafranParticipantReportDisplay({
  scores: {
    verbal_score: 15,
    figural_score: 8,
    numerical_series_score: 6,
    cognitive_composite_v1: 29,
  },
  testName: "SAFRAN",
  narrativeState: "failed",
});
assert.equal(
  failedFallbackDisplay.sections[0].body,
  "Rezultati testa su dostupni, ali detaljan narativni izvještaj trenutno nije moguće prikazati. Ako se problem ponovi, kontaktiraj support.",
);

const fallbackResults = {
  attemptId: "attempt-safran-fallback-render",
  scoringMethod: "correct_answers",
  dimensions: [
    { dimension: "verbal_score", rawScore: 15, scoredQuestionCount: 18 },
    { dimension: "figural_score", rawScore: 8, scoredQuestionCount: 18 },
    { dimension: "numerical_series_score", rawScore: 6, scoredQuestionCount: 18 },
    { dimension: "cognitive_composite_v1", rawScore: 29, scoredQuestionCount: 54 },
  ],
  scoredResponseCount: 45,
  unscoredResponses: [],
  derived: {
    safranV1: {
      verbalScore: 15,
      figuralScore: 8,
      numericalRawScore: 3,
      numericalAdjustedScore: 6,
      numericalScore: 6,
      numericalSeriesScore: 6,
      cognitiveCompositeScore: 29,
      cognitiveCompositeV1: 29,
    },
  },
};

function renderFallback(reportState) {
  return renderToStaticMarkup(
    React.createElement(CompletedAssessmentSummary, {
      completedAt: "2026-05-05T09:42:07.674Z",
      locale: "bs",
      organizationName: "Test organizacija",
      participantName: "Test kandidat",
      testSlug: "safran_v1",
      testName: "SAFRAN",
      results: fallbackResults,
      reportState,
    }),
  );
}

const pendingFallbackOutputs = [
  renderFallback(null),
  renderFallback({
    status: "queued",
    generatorType: null,
    generatedAt: "2026-05-05T09:42:07.674Z",
    completedAt: null,
  }),
];
const failedFallbackOutputs = [
  renderFallback({
    status: "failed",
    generatorType: "openai",
    generatedAt: "2026-05-05T09:42:07.674Z",
    completedAt: "2026-05-05T09:43:07.674Z",
    failureCode: "provider_error",
    failureReason: "Fixture failure",
  }),
  renderFallback({
    status: "ready",
    reportFamily: "safran",
    reportAudience: "participant",
    reportVersion: "v1",
    reportRenderFormat: "safran_participant_ai_report_v1",
    report: { reportType: "safran_participant_ai_report_v1" },
  }),
];

for (const fallbackRenderOutput of pendingFallbackOutputs) {
  assert.equal(
    fallbackRenderOutput.includes(
      "Dostupni su bodovani rezultati ove procjene.",
    ),
    true,
  );
  assert.equal(
    countOccurrences(
      fallbackRenderOutput,
      "Rezultati testa su dostupni, ali detaljan narativni izvještaj još nije spreman za prikaz.",
    ),
    1,
  );
}

for (const fallbackRenderOutput of failedFallbackOutputs) {
  assert.equal(
    countOccurrences(
      fallbackRenderOutput,
      "Rezultati testa su dostupni, ali detaljan narativni izvještaj trenutno nije moguće prikazati. Ako se problem ponovi, kontaktiraj support.",
    ),
    1,
  );
}

for (const fallbackRenderOutput of [...pendingFallbackOutputs, ...failedFallbackOutputs]) {
  const visibleFallbackText = fallbackRenderOutput.replace(/<[^>]*>/g, " ");
  assert.doesNotMatch(visibleFallbackText, /\bAI\b/i);
  assert.doesNotMatch(visibleFallbackText, /AI generated|vještačka inteligencija|vještačke inteligencije/i);
  for (const score of ["29 / 54", "15 / 18", "8 / 18", "6 / 18"]) {
    assert.equal(fallbackRenderOutput.includes(score), true, `Expected fallback score ${score}.`);
  }
  for (const readyAiOnlyText of [
    readyAiMarkerText.summaryInterpretation,
    readyAiMarkerText.verbalInterpretation,
    readyAiMarkerText.figuralInterpretation,
    readyAiMarkerText.numericInterpretation,
    readyAiMarkerText.primarySignal,
    readyAiMarkerText.balanceNote,
    readyAiMarkerText.cautionSignal,
    readyAiMarkerText.readingGuideTitle,
    readyAiMarkerText.readingGuideIq,
    readyAiMarkerText.readingGuidePercentile,
    readyAiMarkerText.readingGuidePractice,
    readyAiMarkerText.readingGuideDecision,
    readyAiMarkerText.readingGuideContext,
    readyAiMarkerText.nextStepTitle,
    readyAiMarkerText.nextStepBody,
  ]) {
    assert.equal(
      fallbackRenderOutput.includes(readyAiOnlyText),
      false,
      `Non-ready fallback unexpectedly contains ready-AI report text: ${readyAiOnlyText}`,
    );
  }
  for (const forbiddenFallbackNarrative of [
    "Rezultat ispod sažima učinak u ovom pokušaju",
    "Verbalni dio govori o tome kako si",
    "Figuralni rezultat ukazuje na prepoznavanje obrazaca",
    "Numerički rezultat se izdvaja kao najizraženiji dio ovog profila",
    "Pregled po oblastima ovdje daje najkorisniju sliku",
    "Kognitivni signal",
    "Kako čitati ovaj rezultat",
    "Korak za razmišljanje",
    "Pogledaj u kojim oblastima si imao ili imala stabilniji ritam",
  ]) {
    assert.equal(
      fallbackRenderOutput.includes(forbiddenFallbackNarrative),
      false,
      `Non-ready fallback unexpectedly contains narrative: ${forbiddenFallbackNarrative}`,
    );
  }
}

const aiRenderOutput = renderToStaticMarkup(
  React.createElement(CompletedAssessmentSummary, {
    completedAt: "2026-05-05T09:42:07.674Z",
    locale: "bs",
    organizationName: "Test organizacija",
    participantName: "Test kandidat",
    testSlug: "safran_v1",
    testName: "SAFRAN",
    results: {
      attemptId: "attempt-safran-render",
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
          interpretation: readyAiMarkerText.summaryInterpretation,
        },
        domains: [
          {
            code: "verbal",
            title: "Verbalni rezultat",
            scoreLabel: "18/18",
            bandLabel: "veći broj tačnih odgovora",
            interpretation: readyAiMarkerText.verbalInterpretation,
          },
          {
            code: "figural",
            title: "Figuralni rezultat",
            scoreLabel: "18/18",
            bandLabel: "veći broj tačnih odgovora",
            interpretation: readyAiMarkerText.figuralInterpretation,
          },
          {
            code: "numeric",
            title: "Numerički rezultat",
            scoreLabel: "0/18",
            bandLabel: "manji broj tačnih odgovora",
            interpretation: readyAiMarkerText.numericInterpretation,
          },
        ],
        cognitiveSignals: {
          title: "Profil kognitivnih signala",
          primarySignal: readyAiMarkerText.primarySignal,
          cautionSignal: readyAiMarkerText.cautionSignal,
          balanceNote: readyAiMarkerText.balanceNote,
        },
        readingGuide: {
          title: readyAiMarkerText.readingGuideTitle,
          bullets: [
            readyAiMarkerText.readingGuideIq,
            readyAiMarkerText.readingGuidePercentile,
            readyAiMarkerText.readingGuidePractice,
            readyAiMarkerText.readingGuideDecision,
            readyAiMarkerText.readingGuideContext,
          ],
        },
        nextStep: {
          title: readyAiMarkerText.nextStepTitle,
          body: readyAiMarkerText.nextStepBody,
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

assert.equal(
  aiRenderOutput.includes(readyAiMarkerText.summaryInterpretation),
  true,
);
assertOccursOnce(aiRenderOutput, readyAiMarkerText.summaryInterpretation, "ready-AI summary.interpretation");
assert.equal(
  aiRenderOutput.includes("36 / 54"),
  true,
);
assert.equal(
  aiRenderOutput.includes("18 / 18"),
  true,
);
assert.equal(
  aiRenderOutput.includes("0 / 18"),
  true,
);
assert.equal(
  aiRenderOutput.includes("umjeren ukupni broj tačnih odgovora"),
  true,
);
assert.equal(
  aiRenderOutput.includes('style="width:100%"'),
  true,
  "Expected SAFRAN score bar for 18 / 18 to remain present.",
);
assert.equal(
  aiRenderOutput.includes('style="width:0%"'),
  true,
  "Expected SAFRAN score bar for 0 / 18 to remain present.",
);
for (const domainInterpretation of [
  readyAiMarkerText.verbalInterpretation,
  readyAiMarkerText.figuralInterpretation,
  readyAiMarkerText.numericInterpretation,
]) {
  assertOccursOnce(aiRenderOutput, domainInterpretation, "ready-AI domain interpretation");
}
assert.equal(
  aiRenderOutput.includes(
    "Primarni signal je jasan odnos u kojem verbalni i figuralni dio drže stabilniji obrazac tačnosti nego numerički dio. Najviše smisla ima uporediti verbalni, figuralni i numerički dio kao povezan obrazac iz istog pokušaja.",
  ),
  false,
);
for (const scoreDerivedDomainText of [
  "Verbalni dio govori o tome kako si u ovom setu zadataka pratio ili pratila značenja pojmova i odnose među njima.",
  "Figuralni rezultat ukazuje na prepoznavanje obrazaca, odnosa i promjena među oblicima u ovom setu zadataka.",
  "Numerički dio opisuje kako si u ovom setu zadataka pratio ili pratila pravila u nizovima i odnose među elementima.",
]) {
  assert.equal(aiRenderOutput.includes(scoreDerivedDomainText), false);
}
for (const cognitiveSignal of [
  readyAiMarkerText.primarySignal,
  readyAiMarkerText.balanceNote,
  readyAiMarkerText.cautionSignal,
]) {
  assertOccursOnce(aiRenderOutput, cognitiveSignal, "ready-AI cognitive signal");
}
assert.equal(
  aiRenderOutput.includes(
    "Rezultat ispod sažima učinak u ovom pokušaju, a puni smisao dobija tek zajedno s pregledom po oblastima.",
  ),
  false,
);
for (const title of [
  "Sažetak rezultata",
  "Pregled po oblastima",
  "Profil kognitivnih signala",
  readyAiMarkerText.readingGuideTitle,
  readyAiMarkerText.nextStepTitle,
]) {
  assert.equal(
    aiRenderOutput.includes(title),
    true,
    `Expected SAFRAN AI renderer output to include section title ${title}.`,
  );
}
assert.equal(aiRenderOutput.includes("Glavni signal"), true);
assert.equal(aiRenderOutput.includes("Balans rezultata"), true);
assert.equal(aiRenderOutput.includes("Oprez pri čitanju"), true);
assert.equal(aiRenderOutput.includes("Obrati pažnju"), false);
assert.equal(
  aiRenderOutput.includes(
    "Numerički dio treba čitati oprezno jer jedan izdvojen rezultat ne opisuje tvoj ukupni način rješavanja različitih zadataka.",
  ),
  false,
);
assertOccursOnce(aiRenderOutput, readyAiMarkerText.readingGuideTitle, "ready-AI readingGuide.title");
assertOccursOnce(aiRenderOutput, readyAiMarkerText.nextStepTitle, "ready-AI nextStep.title");
assertOccursOnce(aiRenderOutput, readyAiMarkerText.nextStepBody, "ready-AI nextStep.body");
for (const readingGuideBullet of [
  readyAiMarkerText.readingGuideIq,
  readyAiMarkerText.readingGuidePercentile,
  readyAiMarkerText.readingGuidePractice,
  readyAiMarkerText.readingGuideDecision,
  readyAiMarkerText.readingGuideContext,
]) {
  assertOccursOnce(aiRenderOutput, readingGuideBullet, "ready-AI readingGuide.bullets[]");
}
const readyAiSignalsSection = getHtmlSliceBetween(
  aiRenderOutput,
  "Profil kognitivnih signala",
  readyAiMarkerText.readingGuideTitle,
  "ready-AI signals section",
);
assert.equal(
  readyAiSignalsSection.includes(readyAiMarkerText.primarySignal),
  true,
  "Expected primarySignal inside signals section.",
);
assert.equal(
  readyAiSignalsSection.includes(readyAiMarkerText.balanceNote),
  true,
  "Expected balanceNote inside signals section.",
);
assert.equal(
  readyAiSignalsSection.includes(readyAiMarkerText.cautionSignal),
  true,
  "Expected cautionSignal inside signals section.",
);
assert.equal(
  readyAiSignalsSection.includes(readyAiMarkerText.nextStepBody),
  false,
  "nextStep.body must not be remapped into the signal/caution section.",
);
const readyAiReadingGuideSection = getHtmlSliceBetween(
  aiRenderOutput,
  readyAiMarkerText.readingGuideTitle,
  readyAiMarkerText.nextStepTitle,
  "ready-AI reading guide section",
);
assert.equal(
  readyAiReadingGuideSection.includes(readyAiMarkerText.nextStepBody),
  false,
  "nextStep.body must not be remapped into the reading guide section.",
);
const readyAiNextStepSection = aiRenderOutput.slice(
  aiRenderOutput.indexOf(readyAiMarkerText.nextStepTitle),
);
assert.equal(
  readyAiNextStepSection.includes(readyAiMarkerText.nextStepBody),
  true,
  "Expected nextStep.body inside next step section.",
);
assert.equal(
  aiRenderOutput.includes(
    "Ukupni rezultat sažima učinak kroz verbalni, figuralni i numerički dio i najkorisnije ga je čitati zajedno s pregledom po oblastima.",
  ),
  false,
);
assert.equal(aiRenderOutput.includes("Nazad na pregled"), true);
assert.equal(aiRenderOutput.includes("Nazad na pregled procjene"), false);

assert.doesNotMatch(displaySource, /buildSafranAiSignalParagraph|buildSafranCautionSentence|normalizeSafranDisplayText/);
assert.doesNotMatch(rendererSource, /buildSafranParticipantDomainSummary|buildSafranAiSignalParagraph|buildSafranCautionSentence|normalizeSafranDisplayText/);
assert.doesNotMatch(displaySource, /validateSafranParticipantAiReport/);
for (const source of [displaySource, rendererSource]) {
  assert.doesNotMatch(
    source,
    /from\s+["'][^"']*(?:provider|openai|lifecycle|worker|scheduler|app\/actions|supabase)[^"']*["']/i,
  );
  assert.doesNotMatch(
    source,
    /\b(?:generateSafran|processSafran|enqueueSafran|createSupabaseClient|createSupabaseAdminClient)\s*\(/,
  );
  assert.doesNotMatch(source, /\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
}

console.log("SAFRAN participant report display tests passed.");
