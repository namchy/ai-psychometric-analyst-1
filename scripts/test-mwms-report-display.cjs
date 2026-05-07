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

function compileTypeScriptModule(module, filename) {
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

require.extensions[".ts"] = compileTypeScriptModule;
require.extensions[".tsx"] = compileTypeScriptModule;

const {
  buildMwmsComputedDimensionsFromPersistedScores,
} = require("../lib/assessment/scoring.ts");
const {
  CompletedAssessmentSummary,
} = require("../components/assessment/completed-assessment-summary.tsx");
const {
  formatDimensionLabel,
  formatMwmsScoreLabel,
  formatScoreLabel,
  getMwmsScoreWidth,
  isMwmsDimensionSet,
} = require("../lib/assessment/result-display.ts");

const completedSummarySource = fs.readFileSync(
  path.join(projectRoot, "components/assessment/completed-assessment-summary.tsx"),
  "utf8",
);

const mwmsRenderOutput = renderToStaticMarkup(
  React.createElement(CompletedAssessmentSummary, {
    completedAt: "2026-05-04T10:30:00.000Z",
    locale: "bs",
    organizationName: "Test organizacija",
    participantName: "Test kandidat",
    testSlug: "mwms_v1",
    testName: "Procjena radne motivacije",
    results: {
      attemptId: "attempt-mwms-report",
      scoringMethod: "likert_sum",
      dimensions: [
        { dimension: "amotivation", rawScore: 4, scoredQuestionCount: 3 },
        { dimension: "external_social", rawScore: 4, scoredQuestionCount: 3 },
        { dimension: "external_material", rawScore: 5, scoredQuestionCount: 3 },
        { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
        { dimension: "identified", rawScore: 4.67, scoredQuestionCount: 3 },
        { dimension: "intrinsic", rawScore: 5, scoredQuestionCount: 3 },
      ],
      scoredResponseCount: 19,
      unscoredResponses: [],
    },
    reportState: null,
  }),
);

const mwmsAiRenderOutput = renderToStaticMarkup(
  React.createElement(CompletedAssessmentSummary, {
    completedAt: "2026-05-04T10:30:00.000Z",
    locale: "bs",
    organizationName: "Test organizacija",
    participantName: "Test kandidat",
    testSlug: "mwms_v1",
    testName: "Procjena radne motivacije",
    results: {
      attemptId: "attempt-mwms-report",
      scoringMethod: "likert_sum",
      dimensions: [
        { dimension: "amotivation", rawScore: 4, scoredQuestionCount: 3 },
        { dimension: "external_social", rawScore: 4, scoredQuestionCount: 3 },
        { dimension: "external_material", rawScore: 5, scoredQuestionCount: 3 },
        { dimension: "introjected", rawScore: 3.75, scoredQuestionCount: 4 },
        { dimension: "identified", rawScore: 4.67, scoredQuestionCount: 3 },
        { dimension: "intrinsic", rawScore: 5, scoredQuestionCount: 3 },
      ],
      scoredResponseCount: 19,
      unscoredResponses: [],
    },
    reportState: {
      status: "ready",
      reportFamily: "mwms",
      reportAudience: "participant",
      reportVersion: "v1",
      reportRenderFormat: "mwms_participant_report_v1",
      report: {
        schema_version: "mwms_participant_report_v1",
        test_slug: "mwms_v1",
        audience: "participant",
        title: "Radna motivacija",
        summary: {
          headline: "Tvoj profil pokazuje kombinaciju različitih izvora radne motivacije.",
          paragraph:
            "Ovaj izvještaj čita šest već izračunatih skala kao profil, bez ukupnog rezultata ili presude.",
        },
        motivation_pattern: {
          autonomous:
            "Autonomni izvori motivacije pokazuju koliko se posao može povezati sa smislom, vrijednostima ili interesom.",
          controlled:
            "Kontrolisani izvori motivacije pokazuju koliko napor može dolaziti iz očekivanja, pritiska ili nagrade.",
          amotivation:
            "Amotivaciju treba čitati oprezno i povezati je sa konkretnim kontekstom rada.",
        },
        key_observations: [
          "Identificirana i intrinzična motivacija daju važan dio profila.",
          "Ekstrinzični izvori motivacije ne treba čitati kao jedini zaključak.",
        ],
        possible_tensions: [
          "Moguća napetost je odnos između ličnog smisla i vanjskih očekivanja.",
        ],
        reflection_questions: [
          "Koji aspekti posla ti daju najviše osjećaja smisla i energije?",
        ],
        development_suggestions: [
          "Poveži važne zadatke sa konkretnim vrijednostima i očekivanjima uloge.",
        ],
        interpretation_note:
          "Ovaj rezultat nije dijagnoza, presuda niti samostalna osnova za odluku o zapošljavanju.",
      },
    },
  }),
);

function assertApproxEqual(actual, expected, epsilon = 1e-9) {
  assert.equal(Math.abs(actual - expected) <= epsilon, true, `Expected ${actual} to be within ${epsilon} of ${expected}.`);
}

assert.equal(isMwmsDimensionSet([
  "amotivation",
  "external_social",
  "external_material",
  "introjected",
  "identified",
  "intrinsic",
]), true);

assert.equal(formatDimensionLabel("amotivation"), "Amotivacija");
assert.equal(formatDimensionLabel("external_social"), "Ekstrinzična motivacija — socijalna");
assert.equal(formatDimensionLabel("external_material"), "Ekstrinzična motivacija — materijalna");
assert.equal(formatDimensionLabel("introjected"), "Introjektirana motivacija");
assert.equal(formatDimensionLabel("identified"), "Identificirana motivacija");
assert.equal(formatDimensionLabel("intrinsic"), "Intrinzična motivacija");

assert.equal(formatMwmsScoreLabel(1), "1.00 / 7");
assert.equal(formatMwmsScoreLabel(4.67), "4.67 / 7");
assert.equal(formatMwmsScoreLabel(7), "7.00 / 7");
assert.equal(formatMwmsScoreLabel(4.67).includes("bod"), false);

assert.equal(getMwmsScoreWidth(1), 0);
assert.equal(getMwmsScoreWidth(4), 50);
assert.equal(getMwmsScoreWidth(7), 100);
assert.equal(getMwmsScoreWidth(0), 0);
assert.equal(getMwmsScoreWidth(8), 100);

const persistedMwmsDimensions = buildMwmsComputedDimensionsFromPersistedScores([
  { dimension: "amotivation", raw_score: 4.0 },
  { dimension: "external_social", raw_score: 4.0 },
  { dimension: "external_material", raw_score: 5.0 },
  { dimension: "introjected", raw_score: 3.75 },
  { dimension: "identified", raw_score: 4.67 },
  { dimension: "intrinsic", raw_score: 5.0 },
]);

assert.ok(persistedMwmsDimensions, "Expected MWMS persisted dimensions to map successfully.");
assert.deepEqual(
  persistedMwmsDimensions.map((dimension) => ({
    dimension: dimension.dimension,
    rawScore: dimension.rawScore,
    scoreLabel: formatMwmsScoreLabel(dimension.rawScore),
  })),
  [
    { dimension: "amotivation", rawScore: 4, scoreLabel: "4.00 / 7" },
    { dimension: "external_social", rawScore: 4, scoreLabel: "4.00 / 7" },
    { dimension: "external_material", rawScore: 5, scoreLabel: "5.00 / 7" },
    { dimension: "introjected", rawScore: 3.75, scoreLabel: "3.75 / 7" },
    { dimension: "identified", rawScore: 4.67, scoreLabel: "4.67 / 7" },
    { dimension: "intrinsic", rawScore: 5, scoreLabel: "5.00 / 7" },
  ],
);
assertApproxEqual(getMwmsScoreWidth(4), 50);
assertApproxEqual(getMwmsScoreWidth(5), 66.66666666666666);
assertApproxEqual(getMwmsScoreWidth(3.75), 45.83333333333333);
assertApproxEqual(getMwmsScoreWidth(4.67), 61.16666666666666);
assert.equal(persistedMwmsDimensions.some((dimension) => dimension.rawScore === 12), false);
assert.equal(persistedMwmsDimensions.some((dimension) => dimension.rawScore === 15), false);
assert.equal(persistedMwmsDimensions.some((dimension) => dimension.rawScore === 14), false);

assert.equal(formatScoreLabel(12), "12 bodova");
assert.equal(formatDimensionLabel("EXTRAVERSION"), "Ekstraverzija");

assert.equal(completedSummarySource.includes("Radna motivacija"), true);
assert.equal(completedSummarySource.includes("Profil motivacije"), true);
assert.equal(completedSummarySource.includes("Kako čitati profil motivacije"), true);
assert.equal(completedSummarySource.includes("Napomena o interpretaciji"), true);
assert.equal(completedSummarySource.includes("Naredni korak"), true);
assert.equal(
  completedSummarySource.includes("!isMwmsResults && bigFiveReport && topInsights.length > 0"),
  true,
);
assert.equal(
  completedSummarySource.includes("!isMwmsResults && bigFiveParticipantReport"),
  true,
);
assert.equal(
  completedSummarySource.includes('!isMwmsResults &&\n    (reportState === null ||'),
  true,
);
assert.equal(
  completedSummarySource.includes('!isMwmsResults &&\n    (reportState?.status === "failed" || reportState?.status === "unavailable")'),
  true,
);

for (const expectedText of [
  "Radna motivacija",
  "Kako čitati profil motivacije",
  "Profil motivacije",
  "Napomena o interpretaciji",
  "Naredni korak",
  "Amotivacija",
  "Manjak smisla ili energije",
  "Ekstrinzična motivacija — socijalna",
  "Priznanje i očekivanja drugih",
  "Ekstrinzična motivacija — materijalna",
  "Nagrada, sigurnost ili korist",
  "Introjektirana motivacija",
  "Obaveza i unutrašnji pritisak",
  "Identificirana motivacija",
  "Posao koji ti je važan",
  "Intrinzična motivacija",
  "Interes i zadovoljstvo u radu",
]) {
  assert.equal(
    mwmsRenderOutput.includes(expectedText),
    true,
    `Expected MWMS render output to include: ${expectedText}`,
  );
}

for (const expectedText of [
  "PARTICIPANT INSIGHT",
  "Sažetak motivacijskog profila",
  "Profil u jednoj rečenici",
  "Šta te najviše pokreće",
  "Šta dodatno pomaže",
  "Mogući rizik",
  "Šta ovaj obrazac znači u radu",
  "Ključni uvidi",
  "Na šta obratiti pažnju",
  "Razvojne smjernice",
  "Pitanja za refleksiju",
  "Interpretacijska napomena",
  "Tvoji najizraženiji izvori motivacije su",
  "tvom radnom ponašanju",
  "Odgovornost, lični standardi i želja da ispuniš očekivanja",
  "Interes za posao i osjećaj da tvoj doprinos drugi prepoznaju",
  "Dio motivacije može preći u pritisak ako zadaci nemaju dovoljno ličnog smisla",
]) {
  assert.equal(
    mwmsAiRenderOutput.includes(expectedText),
    true,
    `Expected ready MWMS AI render output to include: ${expectedText}`,
  );
}

assert.equal(mwmsAiRenderOutput.includes("4.00 / 7"), true);
assert.equal(mwmsAiRenderOutput.includes("4.67 / 7"), true);

assert.equal(mwmsRenderOutput.includes("4.00 / 7"), true);
assert.equal(mwmsRenderOutput.includes("4.67 / 7"), true);
assert.equal(mwmsRenderOutput.includes("3.75 / 7"), true);

for (const forbiddenText of [
  "Sažetak ključnih obrazaca",
  "Zaključak",
  "Preporuke",
  "Dostupni skorovi ukazuju",
  "nizak raspon",
  "Detaljna interpretacija za ovu dimenziju trenutno nije dostupna",
  "Prikaži detalje",
  "total score",
  "percentile",
  "pass/fail",
  "hire/no-hire",
  "V1",
  "Obrazac motivacije",
  "Moguće napetosti",
  "Pitanja za razmišljanje",
  "Kod Vas su",
  "Vaš profil",
  "Vašem radnom ponašanju",
  "tvojem radnom ponašanju",
]) {
  assert.equal(
    mwmsRenderOutput.includes(forbiddenText),
    false,
    `Expected MWMS render output to exclude: ${forbiddenText}`,
  );
  assert.equal(
    mwmsAiRenderOutput.includes(forbiddenText),
    false,
    `Expected ready MWMS AI render output to exclude: ${forbiddenText}`,
  );
}

assert.equal(mwmsAiRenderOutput.includes("Napomena o interpretaciji"), false);

for (const forbiddenFormalText of [
  " Vi ",
  " Vam ",
  " Vas ",
  " Vaš ",
  " Vaša ",
  " Vaše ",
  " Vašem ",
  " Vašim ",
  " Vaši ",
  " kod Vas",
  "pokušajte",
  "razmislite",
  "obratite",
  "koristite",
  "prepoznajte",
  "pratite",
  "zastanite",
  "razdvojite",
  "osjećate",
  "radite",
  "želite",
  "morate",
  "možete",
]) {
  assert.equal(
    mwmsAiRenderOutput.includes(forbiddenFormalText),
    false,
    `Expected ready MWMS AI render output to exclude formal address fragment: ${forbiddenFormalText}`,
  );
}

console.log("MWMS report display tests passed.");
