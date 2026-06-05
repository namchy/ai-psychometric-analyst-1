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

const practiceMentions = display.sections.flatMap((section) => {
  if (section.id === "reading_guide") {
    return [];
  }

  return flattenDisplayTexts({ header: { eyebrow: "", title: "", subtitle: "" }, sections: [section] });
}).filter((text) => /practice/i.test(text));

assert.deepEqual(practiceMentions, []);
assert.equal(
  display.sections[3].items.some((item) => /probna pitanja/i.test(item)),
  true,
);
assert.equal(
  display.sections[3].items.some((item) => /ne ulaze u rezultat/i.test(item)),
  true,
);

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
assert.equal(fallbackDisplay.sections[0].title, "Sažetak rezultata");

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
          interpretation:
            "Ukupni obrazac pokazuje vrlo stabilan verbalno-figuralni učinak uz izražen kontrast u odnosu na numerički dio. To je korisnije čitati kao razliku između tipova SAFRAN zadataka nego kao jedinstven zaključak o osobi.",
        },
        domains: [
          {
            code: "verbal",
            title: "Verbalni rezultat",
            scoreLabel: "18/18",
            bandLabel: "veći broj tačnih odgovora",
            interpretation:
              "Verbalni dio ovdje pokazuje da su pravila u zadacima s riječima i pojmovima bila brzo prepoznatljiva i stabilno praćena.",
          },
          {
            code: "figural",
            title: "Figuralni rezultat",
            scoreLabel: "18/18",
            bandLabel: "veći broj tačnih odgovora",
            interpretation:
              "Figuralni dio prati sličan obrazac kao verbalni: odnosi među oblicima i prostorna pravila ovdje su bili dosljedno uhvaćeni.",
          },
          {
            code: "numeric",
            title: "Numerički rezultat",
            scoreLabel: "0/18",
            bandLabel: "manji broj tačnih odgovora",
            interpretation:
              "Numerički dio se ovdje jasno odvaja od verbalno-figuralnog obrasca i traži oprezniju interpretaciju.",
          },
        ],
        cognitiveSignals: {
          title: "Profil kognitivnih signala",
          primarySignal:
            "Primarni signal je jasan odnos u kojem verbalni i figuralni dio drže stabilniji obrazac tačnosti nego numerički dio.",
          cautionSignal:
            "Glavni oprez je da se numerički kontrast ne pretvori u zaključak o osobi, jer je taj format mogao tražiti više provjere i drugačiju strategiju.",
          balanceNote:
            "Najviše smisla ima uporediti verbalni, figuralni i numerički dio kao povezan obrazac iz istog pokušaja.",
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
          body:
            "Kada čitaš ovaj obrazac, korisno je izdvojiti gdje su pravila bila odmah uočljiva, a gdje je numerički format tražio više provjere, vremena ili drugačiji pristup.",
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
  aiRenderOutput.includes(
    "Ukupni obrazac pokazuje vrlo stabilan verbalno-figuralni učinak uz izražen kontrast u odnosu na numerički dio.",
  ),
  true,
);
assert.equal(
  aiRenderOutput.split(
    "Ukupni obrazac pokazuje vrlo stabilan verbalno-figuralni učinak uz izražen kontrast u odnosu na numerički dio. To je korisnije čitati kao razliku između tipova SAFRAN zadataka nego kao jedinstven zaključak o osobi.",
  ).length - 1,
  1,
);
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
for (const domainInterpretation of [
  "Verbalni dio ovdje pokazuje da su pravila u zadacima s riječima i pojmovima bila brzo prepoznatljiva i stabilno praćena.",
  "Figuralni dio prati sličan obrazac kao verbalni: odnosi među oblicima i prostorna pravila ovdje su bili dosljedno uhvaćeni.",
  "Numerički dio se ovdje jasno odvaja od verbalno-figuralnog obrasca i traži oprezniju interpretaciju.",
]) {
  assert.equal(
    countOccurrences(aiRenderOutput, domainInterpretation),
    1,
    `Expected ready-AI domain interpretation exactly once: ${domainInterpretation}`,
  );
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
  "Primarni signal je jasan odnos u kojem verbalni i figuralni dio drže stabilniji obrazac tačnosti nego numerički dio.",
  "Najviše smisla ima uporediti verbalni, figuralni i numerički dio kao povezan obrazac iz istog pokušaja.",
  "Glavni oprez je da se numerički kontrast ne pretvori u zaključak o osobi, jer je taj format mogao tražiti više provjere i drugačiju strategiju.",
]) {
  assert.equal(
    countOccurrences(aiRenderOutput, cognitiveSignal),
    1,
    `Expected ready-AI cognitive signal exactly once: ${cognitiveSignal}`,
  );
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
  "Kako čitati ove rezultate",
  "Sljedeći korak",
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
const nextStepBody =
  "Kada čitaš ovaj obrazac, korisno je izdvojiti gdje su pravila bila odmah uočljiva, a gdje je numerički format tražio više provjere, vremena ili drugačiji pristup.";
assert.equal(countOccurrences(aiRenderOutput, nextStepBody), 1);
for (const readingGuideBullet of [
  "Ovi rezultati ne predstavljaju mjeru opšte inteligencije.",
  "Ovaj rezultat nije percentil i ne predstavlja poređenje s lokalnom referentnom grupom.",
  "Practice pitanja služe samo za upoznavanje s formatom zadataka i ne ulaze u scoring.",
  "SAFRAN rezultat ne treba koristiti kao samostalnu odluku o kandidatu.",
  "Najkorisnije ga je čitati zajedno s ostalim dijelovima Deep Profile procjene.",
]) {
  assert.equal(countOccurrences(aiRenderOutput, readingGuideBullet), 1);
}
assert.equal(
  aiRenderOutput.includes(
    "Ukupni rezultat sažima učinak kroz verbalni, figuralni i numerički dio i najkorisnije ga je čitati zajedno s pregledom po oblastima.",
  ),
  false,
);
assert.equal(aiRenderOutput.includes("Nazad na pregled"), true);
assert.equal(aiRenderOutput.includes("Nazad na pregled procjene"), false);

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
