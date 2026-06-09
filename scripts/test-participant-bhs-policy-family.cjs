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
  validateMwmsParticipantReportV1,
} = require("../lib/assessment/mwms-participant-report-v1.ts");
const {
  buildMockSafranParticipantAiReport,
  validateSafranParticipantAiReport,
} = require("../lib/assessment/safran-participant-ai-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms-participant-family-bhs-smoke",
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
  };
}

function buildSafranResults() {
  return {
    attemptId: "attempt-safran-participant-family-bhs-smoke",
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

function buildPreparedMwmsInput(locale) {
  return buildPreparedReportGenerationInput(
    {
      attemptId: `attempt-mwms-participant-family-${locale ?? "null"}`,
      testId: "test-mwms",
      testSlug: "mwms_v1",
      audience: "participant",
      locale,
      scoringMethod: "likert_sum",
      promptVersion: "v1",
      testName: "Procjena radne motivacije",
      results: buildMwmsResults(),
    },
    {
      promptVersionId: null,
      promptTemplate: null,
    },
  );
}

function buildPreparedSafranInput(locale) {
  return buildPreparedReportGenerationInput(
    {
      attemptId: `attempt-safran-participant-family-${locale ?? "null"}`,
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

function buildMwmsReport() {
  return {
    schema_version: "mwms_participant_report_v1",
    test_slug: "mwms_v1",
    audience: "participant",
    title: "Radna motivacija",
    summary: {
      headline:
        "Ti možeš ovaj snapshot čitati kao moderate signal koji traži provjeru kroz tvoj radni kontekst.",
      paragraph:
        "Profil pokazuje da energija za rad dolazi iz kombinacije ličnog smisla, očekivanja i high potrebe za jasnim kontekstom zadatka.",
    },
    motivation_pattern: {
      autonomous:
        "Autonomni izvori su vidljivi kroz zadatke koje ti povezuješ sa vrijednošću, interesom i osjećajem odgovornosti.",
      controlled:
        "Kontrolisani izvori se mogu pojaviti kada su očekivanja, priznanje ili low osjećaj sigurnosti posebno naglašeni u radu.",
      amotivation:
        "Amotivacija se čita kao signal za provjeru uslova u kojima ti gubiš jasnoću, energiju ili osjećaj svrhe.",
    },
    key_observations: [
      "Vrijedi istražiti koji zadaci ti najviše povezuju trud sa ličnim smislom i korisnim ishodom.",
      "Motivacijski obrazac treba povezati sa konkretnom ulogom, tempom rada i vrstom feedbacka.",
    ],
    possible_tensions: [
      "Napetost se može javiti kada vanjska očekivanja postanu jača od osjećaja autonomije i svrhe.",
      "Niži osjećaj smisla može smanjiti stabilnost angažmana ako zadaci dugo ostaju nejasni zbog moderate konflikta prioriteta.",
    ],
    reflection_questions: [
      "Koji zadaci ti najčešće daju osjećaj smisla, interesa ili lične vrijednosti?",
      "U kojim situacijama ti snapshot ili high očekivanja počnu smanjivati energiju za rad?",
    ],
    development_suggestions: [
      "Poveži jedan važan zadatak sa konkretnim ishodom koji ti ima smisla i može se pratiti kroz sedmicu.",
      "Dogovori način feedbacka koji povećava jasnoću, autonomiju i osjećaj odgovornosti u radu.",
    ],
    interpretation_note:
      "Ovaj izvještaj nije samostalna osnova za odluku o zapošljavanju i treba ga čitati uz razgovor, ulogu i druge rezultate procjene.",
  };
}

function buildSafranReport(input) {
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

function main() {
  const bsPolicy = resolveAiReportLanguagePolicy("bs");
  assert.ok(bsPolicy);
  assert.equal(bsPolicy.key, "bhs_bs_user_facing");
  assert.equal(resolveAiReportLanguagePolicy("hr"), null);
  assert.equal(resolveAiReportLanguagePolicy("sr"), null);
  assert.equal(resolveAiReportLanguagePolicy("en"), null);
  assert.equal(resolveAiReportLanguagePolicy("unknown"), null);
  assert.equal(resolveAiReportLanguagePolicy(null), null);
  assert.equal(resolveAiReportLanguagePolicy("de"), null);

  const participantAllowedTiErrors = bsPolicy.validateUserFacingOutput(
    { text: "Ti možeš ovaj izvještaj čitati kao signal za svoj radni kontekst." },
    { audience: "participant" },
  );
  assert.equal(
    participantAllowedTiErrors.some((error) => error.message.includes("second-person singular")),
    false,
  );

  const hrBlockedTiErrors = bsPolicy.validateUserFacingOutput(
    { text: "Ti treba da koristiš ovaj izvještaj u razgovoru." },
    { audience: "hr" },
  );
  assert.equal(
    hrBlockedTiErrors.some((error) => error.message.includes("second-person singular")),
    true,
  );

  const mwmsBsInput = buildPreparedMwmsInput("bs");
  const mwmsBsValidated = validateStructuredReport(buildMwmsReport(), mwmsBsInput);
  assert.equal(mwmsBsValidated.summary.headline.includes("snapshot"), false);
  assert.equal(mwmsBsValidated.summary.paragraph.includes("high"), false);
  assert.equal(mwmsBsValidated.motivation_pattern.controlled.includes("low"), false);
  assert.equal(mwmsBsValidated.reflection_questions[1].includes("snapshot"), false);
  assert.equal(mwmsBsValidated.reflection_questions[1].includes("high"), false);
  assert.equal(mwmsBsValidated.reflection_questions[1].trim().endsWith("?"), true);
  assert.equal(mwmsBsValidated.summary.headline.includes("Ti"), true);
  assert.equal(mwmsBsValidated.schema_version, "mwms_participant_report_v1");
  assert.equal(mwmsBsValidated.test_slug, "mwms_v1");
  assert.equal(mwmsBsValidated.audience, "participant");
  assert.equal(mwmsBsValidated.title, "Radna motivacija");

  const mwmsDirectValidation = validateMwmsParticipantReportV1(mwmsBsValidated);
  assert.equal(
    mwmsDirectValidation.ok,
    true,
    mwmsDirectValidation.ok ? undefined : mwmsDirectValidation.errors.join(" | "),
  );

  const safranBsInput = buildPreparedSafranInput("bs");
  const safranBsValidated = validateStructuredReport(buildSafranReport(safranBsInput), safranBsInput);
  assert.equal(safranBsValidated.summary.interpretation.includes("snapshot"), false);
  assert.equal(safranBsValidated.summary.interpretation.includes("high"), false);
  assert.equal(safranBsValidated.cognitiveSignals.primarySignal.includes("snapshot"), false);
  assert.equal(safranBsValidated.readingGuide.bullets[0].includes("high"), false);
  assert.equal(safranBsValidated.nextStep.body.includes("Ti"), true);
  assert.equal(safranBsValidated.reportType, "safran_participant_ai_report_v1");
  assert.equal(safranBsValidated.testSlug, "safran_v1");
  assert.equal(safranBsValidated.audience, "participant");
  assert.equal(safranBsValidated.locale, "bs");
  assert.equal(safranBsValidated.generatedLanguage, "bs");
  assert.equal(safranBsValidated.summary.scoreLabel, "30/54");
  assert.equal(safranBsValidated.summary.bandLabel, "umjeren ukupni broj tačnih odgovora");
  assert.equal(safranBsValidated.domains[0].code, "verbal");
  assert.equal(safranBsValidated.domains[0].scoreLabel, "10/18");
  assert.equal(safranBsValidated.domains[0].bandLabel, "umjeren broj tačnih odgovora");
  assert.equal(safranBsValidated.safetyChecks.containsIqClaim, false);

  const safranDirectValidation = validateSafranParticipantAiReport(safranBsValidated, {
    expectedInput: safranBsInput.promptInput,
  });
  assert.equal(
    safranDirectValidation.ok,
    true,
    safranDirectValidation.ok ? undefined : safranDirectValidation.errors.join(" | "),
  );

  for (const locale of ["hr", "sr", "en", "unknown", null, "de"]) {
    const mwmsInput = buildPreparedMwmsInput(locale);
    const mwmsValidated = validateStructuredReport(buildMwmsReport(), mwmsInput);
    assert.equal(mwmsValidated.summary.headline.includes("snapshot"), true);
    assert.equal(mwmsValidated.summary.paragraph.includes("high"), true);
    assert.equal(mwmsValidated.reflection_questions[1].includes("snapshot"), true);
    assert.equal(mwmsValidated.reflection_questions[1].includes("high"), true);
    assert.equal(mwmsValidated.reflection_questions[1].trim().endsWith("?"), true);
    assert.equal(mwmsValidated.schema_version, "mwms_participant_report_v1");
    assert.equal(mwmsValidated.test_slug, "mwms_v1");
    assert.equal(mwmsValidated.audience, "participant");

    const safranInput = buildPreparedSafranInput(locale);
    const safranValidated = validateStructuredReport(buildSafranReport(safranInput), safranInput);
    assert.equal(safranValidated.summary.interpretation.includes("snapshot"), true);
    assert.equal(safranValidated.summary.interpretation.includes("high"), true);
    assert.equal(safranValidated.readingGuide.bullets[0].includes("high"), true);
    assert.equal(safranValidated.reportType, "safran_participant_ai_report_v1");
    assert.equal(safranValidated.testSlug, "safran_v1");
    assert.equal(safranValidated.audience, "participant");
    assert.equal(safranValidated.summary.scoreLabel, safranInput.promptInput.scores.overall.scoreLabel);
    assert.equal(safranValidated.summary.bandLabel, safranInput.promptInput.scores.overall.bandLabel);
    assert.equal(safranValidated.safetyChecks.containsIqClaim, false);

    if (locale === "unknown" || locale === null || locale === "de") {
      assert.notEqual(safranInput.requestedLocale, undefined);
      assert.equal(safranInput.promptInput.test.locale, "bs");
    }

    if (locale === "unknown") {
      assert.equal(safranInput.requestedLocale, "unknown");
    }

    if (locale === null) {
      assert.equal(safranInput.requestedLocale, null);
    }
  }

  console.log("test-participant-bhs-policy-family: ok");
}

main();
