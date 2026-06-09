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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms-participant-bhs-language-policy",
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

function buildPreparedInput(locale) {
  return buildPreparedReportGenerationInput(
    {
      attemptId: `attempt-mwms-participant-bhs-language-policy-${locale ?? "null"}`,
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

function buildValidReport() {
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

function expectThrows(fn, expectedPattern) {
  assert.throws(fn, expectedPattern);
}

function main() {
  const bsPolicy = resolveAiReportLanguagePolicy("bs");
  assert.ok(bsPolicy);
  assert.equal(resolveAiReportLanguagePolicy("hr"), null);
  assert.equal(resolveAiReportLanguagePolicy("sr"), null);
  assert.equal(resolveAiReportLanguagePolicy("en"), null);
  assert.equal(resolveAiReportLanguagePolicy("unknown"), null);
  assert.equal(resolveAiReportLanguagePolicy(null), null);
  assert.equal(resolveAiReportLanguagePolicy("de"), null);

  const bsInput = buildPreparedInput("bs");
  const bsValidated = validateStructuredReport(buildValidReport(), bsInput);
  assert.equal(bsValidated.summary.headline.includes("snapshot"), false);
  assert.equal(bsValidated.summary.headline.includes("umjereno izražen"), true);
  assert.equal(bsValidated.summary.paragraph.includes("high"), false);
  assert.equal(bsValidated.motivation_pattern.controlled.includes("low"), false);
  assert.equal(bsValidated.reflection_questions[1].includes("snapshot"), false);
  assert.equal(bsValidated.reflection_questions[1].includes("high"), false);
  assert.equal(bsValidated.reflection_questions[1].trim().endsWith("?"), true);
  assert.equal(bsValidated.summary.headline.includes("Ti"), true);
  assert.equal(bsValidated.reflection_questions[0].includes("ti"), true);
  assert.equal(bsValidated.schema_version, "mwms_participant_report_v1");
  assert.equal(bsValidated.test_slug, "mwms_v1");
  assert.equal(bsValidated.audience, "participant");
  assert.equal(bsValidated.title, "Radna motivacija");

  const directValidation = validateMwmsParticipantReportV1(bsValidated);
  assert.equal(
    directValidation.ok,
    true,
    directValidation.ok ? undefined : directValidation.errors.join(" | "),
  );

  const noPolicyLocales = ["hr", "sr", "en", "unknown", null, "de"];

  for (const locale of noPolicyLocales) {
    const input = buildPreparedInput(locale);
    const validated = validateStructuredReport(buildValidReport(), input);
    assert.equal(validated.summary.headline.includes("snapshot"), true);
    assert.equal(validated.summary.paragraph.includes("high"), true);
    assert.equal(validated.motivation_pattern.controlled.includes("low"), true);
    assert.equal(validated.reflection_questions[1].includes("snapshot"), true);
    assert.equal(validated.reflection_questions[1].includes("high"), true);
    assert.equal(validated.reflection_questions[1].trim().endsWith("?"), true);
    assert.equal(validated.schema_version, "mwms_participant_report_v1");
    assert.equal(validated.test_slug, "mwms_v1");
    assert.equal(validated.audience, "participant");
  }

  const forbiddenLeakage = buildValidReport();
  forbiddenLeakage.summary.paragraph =
    "Ti možeš ovaj prompt čitati kroz schema JSON validator jezik.";
  expectThrows(
    () => validateStructuredReport(forbiddenLeakage, bsInput),
    /global BHS MWMS participant output validation/i,
  );

  const invalidReflectionShape = buildValidReport();
  invalidReflectionShape.reflection_questions = [
    "Ti ovaj obrazac možeš povezati sa zadacima koji ti djeluju smisleno.",
  ];
  expectThrows(
    () => validateStructuredReport(invalidReflectionShape, bsInput),
    /MWMS participant report validation/i,
  );

  const internalFieldProtectionInput = buildPreparedInput("bs");
  const internalFieldProtectionReport = buildValidReport();
  internalFieldProtectionReport.schema_version = "mwms_participant_report_v1";
  internalFieldProtectionReport.test_slug = "mwms_v1";
  internalFieldProtectionReport.audience = "participant";
  internalFieldProtectionReport.title = "Radna motivacija";
  const internalFieldProtectionValidated = validateStructuredReport(
    clone(internalFieldProtectionReport),
    internalFieldProtectionInput,
  );
  assert.equal(internalFieldProtectionValidated.schema_version, "mwms_participant_report_v1");
  assert.equal(internalFieldProtectionValidated.test_slug, "mwms_v1");
  assert.equal(internalFieldProtectionValidated.audience, "participant");
  assert.equal(internalFieldProtectionValidated.title, "Radna motivacija");

  console.log("test-mwms-participant-bhs-language-policy: ok");
}

main();
