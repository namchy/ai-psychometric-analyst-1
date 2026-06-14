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
  validateMwmsHrReportV1,
} = require("../lib/assessment/mwms-hr-report-v1.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildMwmsResults() {
  return {
    attemptId: "attempt-mwms-hr-bhs-language-policy",
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
      attemptId: `attempt-mwms-hr-bhs-language-policy-${locale ?? "null"}`,
      testId: "test-mwms",
      testSlug: "mwms_v1",
      audience: "hr",
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

function buildValidReport(input) {
  return {
    contractVersion: "mwms_hr_report_v1",
    reportType: "mwms_hr_report_v1",
    testSlug: "mwms_v1",
    audience: "hr",
    sourceType: "single_test",
    locale: input.promptInput.locale,
    meta: {
      language: input.promptInput.locale,
      generatedAt: "2026-05-11T10:00:00.000Z",
    },
    motivation_profile_snapshot: {
      scale: {
        min: 1,
        max: 7,
      },
      dimensions: input.promptInput.dimensions.map(({ code, label, rawScore, band, bandLabel }) => ({
        code,
        label,
        rawScore,
        band,
        bandLabel,
      })),
      derivedProfile: input.promptInput.derivedProfile,
    },
    key_motivational_drivers: [
      {
        title: "Vrijednost i interes kao izvor angazmana",
        evidence: "Identificirana i intrinzicna motivacija su medju izrazenijim signalima u profilu.",
        hrImplication: "Korisno je provjeriti koje vrste zadataka kandidat povezuje sa smislom i interesom.",
      },
      {
        title: "Materijalni ishodi kao prakticni motivator",
        evidence: "Materijalna ekstrinzicna motivacija je u visem rasponu.",
        hrImplication: "Jasna ocekivanja, sigurnost i transparentni kriteriji mogu biti vazan dio angazmana.",
      },
      {
        title: "Profil treba citati kao kombinaciju izvora",
        evidence: "Autonomni i kontrolisani izvori nisu potpuno odvojeni u rezultatu.",
        hrImplication: "Intervju treba istraziti konkretne uslove u kojima se motivacija pojacava ili slabi.",
      },
    ],
    potential_friction_points: [
      {
        signal: "Motivacija moze zavisiti od jasnoce svrhe zadataka.",
        whyItMayMatter: "Ako svrha nije jasna, angazman se moze mijenjati kroz kontekst.",
        howToCheck: "Pitati za situacije u kojima je kandidat radio na zadacima sa nejasnim smislom.",
      },
      {
        signal: "Vanjski ishodi mogu imati vidljivu ulogu.",
        whyItMayMatter: "Nagrade i sigurnost mogu podrzati angazman, ali ne moraju objasniti cijeli profil.",
        howToCheck: "Provjeriti kako kandidat reaguje na promjene prioriteta, priznanja ili kriterija uspjeha.",
      },
      {
        signal: "Amotivacija je signal za oprezno kontekstualno citanje.",
        whyItMayMatter: "Ovaj signal moze ukazivati na potrebu da se razjasne energija, uslovi rada i ocekivanja.",
        howToCheck: "Pitati sta kandidatu najcesce smanjuje osjecaj jasnog razloga za ulaganje truda.",
      },
    ],
    work_context_hypotheses: [
      {
        context: "Uloge sa jasnom svrhom i vidljivim ishodima",
        hypothesis: "Profil moze biti podrzan kada osoba vidi zasto je zadatak vazan.",
        verification: "Provjeriti kroz primjere zadataka koje je kandidat dozivio kao vrijedne.",
      },
      {
        context: "Uloge sa promjenjivim prioritetima",
        hypothesis: "Motivacijski signal moze traziti cesce uskladjivanje ocekivanja.",
        verification: "Pitati kako kandidat odrzava angazman kada se prioriteti promijene.",
      },
      {
        context: "Okruzenja sa ogranicenim feedbackom",
        hypothesis: "Vanjski i socijalni izvori motivacije mogu traziti jasniji ritam povratne informacije.",
        verification: "Provjeriti kakva vrsta feedbacka kandidatu pomaze da ostane usmjeren.",
      },
    ],
    manager_support_guidance: [
      {
        focus: "Jasnoca svrhe",
        recommendation: "Povezati zadatke sa konkretnim ciljem, korisnikom ili poslovnim ishodom.",
        rationale: "Identificirana motivacija je korisnija kada je vrijednost rada eksplicitna.",
      },
      {
        focus: "Autonomija u izvedbi",
        recommendation: "Dati okvir i kriterije, ali ostaviti prostor za nacin rada gdje je moguce.",
        rationale: "Autonomni izvori motivacije se lakse odrzavaju uz osjecaj izbora i odgovornosti.",
      },
      {
        focus: "Transparentni vanjski kriteriji",
        recommendation: "Jasno komunicirati nagrade, rokove, standarde i posljedice promjena.",
        rationale: "Kontrolisani izvori motivacije mogu biti stabilniji kada su pravila predvidiva.",
      },
      {
        focus: "Rani razgovor o energiji",
        recommendation: "U onboardingu provjeriti sta osobi daje ili oduzima energiju u konkretnim zadacima.",
        rationale: "Amotivacijski signal je korisno citati kao hipotezu o kontekstu, ne kao presudu.",
      },
    ],
    interview_questions: [
      {
        question: "Koji tip zadataka vam najbrze postane smislen i zasto?",
        evaluates: "Vezu izmedju vrijednosti, interesa i radnog angazmana.",
        whatToListenFor: "Konkretne primjere svrhe, odgovornosti i interesa bez opcih tvrdnji.",
      },
      {
        question: "Kada radite na zadatku koji nije licno zanimljiv, sta vam pomaze da odrzite trud?",
        evaluates: "Odnos autonomnih i kontrolisanih izvora motivacije.",
        whatToListenFor: "Strategije za povezivanje zadatka sa ciljem, standardom ili korisnim ishodom.",
      },
      {
        question: "Kako reagujete kada se priznanje ili nagrada za rad promijeni?",
        evaluates: "Ulogu vanjskih i socijalnih motivatora.",
        whatToListenFor: "Realisticno opisivanje uticaja priznanja, sigurnosti i jasnih kriterija.",
      },
      {
        question: "Sta vam u novoj ulozi najvise pomaze da uhvatite ritam?",
        evaluates: "Onboarding potrebe i uslove za rani angazman.",
        whatToListenFor: "Potrebu za jasnocom, feedbackom, autonomijom ili strukturisanim ciljevima.",
      },
      {
        question: "U kojim situacijama vam najvise opadne osjecaj razloga za ulaganje truda?",
        evaluates: "Moguce izvore motivacijske frikcije.",
        whatToListenFor: "Kontekstualne okidace, a ne fiksne zakljucke o osobi.",
      },
    ],
    onboarding_recommendations: [
      {
        phase: "Prvih 30 dana",
        recommendation: "Razjasniti svrhu uloge, kriterije uspjeha i kratkorocne prioritete.",
        why: "Profil moze dobiti stabilniji oslonac kada su vrijednost i ocekivanja eksplicitni.",
      },
      {
        phase: "Prvih 30 dana",
        recommendation: "Uvesti redovan kratki feedback o napretku i standardima rada.",
        why: "Socijalni i vanjski signali mogu imati prakticnu ulogu u ranom angazmanu.",
      },
      {
        phase: "60 dana",
        recommendation: "Provjeriti koji zadaci imaju najvise smisla, a koji najvise iscrpljuju energiju.",
        why: "Motivacijske frikcije se bolje citaju kroz konkretan radni kontekst.",
      },
      {
        phase: "90 dana",
        recommendation: "Uskladiti nivo autonomije, priznanja i jasnih ciljeva za nastavak rada.",
        why: "Kombinovani profil trazi balans izmedju smisla, strukture i vidljivih ishoda.",
      },
    ],
    decision_support_note: [
      "Ovaj izvjestaj daje HR hipoteze za razgovor, onboarding i menadzersku podrsku.",
      "Ne treba ga koristiti kao samostalnu odluku o kandidatu niti kao rangiranje osobe.",
    ],
    interpretation_note:
      "MWMS HR izvjestaj koristi vec izracunate rezultate kao motivacijski profil. Vec izracunate vrijednosti ostaju nepromijenjene i sluze samo kao oprezna HR hipoteza za dalji razgovor.",
    safety_checks: {
      noScoreRecalculation: true,
      noScoreMutation: true,
      noHireNoHireDecision: true,
      noDiagnosticLanguage: true,
      hypothesesOnly: true,
      singleTestOnly: true,
    },
  };
}

function main() {
  assert.ok(resolveAiReportLanguagePolicy("bs"));
  assert.equal(resolveAiReportLanguagePolicy("hr"), null);
  assert.equal(resolveAiReportLanguagePolicy("sr"), null);
  assert.equal(resolveAiReportLanguagePolicy("en"), null);
  assert.equal(resolveAiReportLanguagePolicy("unknown"), null);
  assert.equal(resolveAiReportLanguagePolicy(null), null);

  const bsInput = buildPreparedInput("bs");
  const bsReport = buildValidReport(bsInput);
  bsReport.key_motivational_drivers[0].evidence =
    "Ovaj snapshot pokazuje moderate signal koji treba citati oprezno.";
  bsReport.manager_support_guidance[0].recommendation =
    "Koristi ovaj high signal kao prakticnu temu za razgovor.";
  const bsReportBeforeValidation = clone(bsReport);
  const originalWarn = console.warn;
  const warningCalls = [];
  console.warn = (...args) => {
    warningCalls.push(args);
  };

  let validatedBsReport;

  try {
    validatedBsReport = validateStructuredReport(bsReport, bsInput);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(validatedBsReport.locale, "bs");
  assert.equal(validatedBsReport.meta.language, "bs");
  assert.deepEqual(validatedBsReport, bsReportBeforeValidation);
  assert.match(validatedBsReport.key_motivational_drivers[0].evidence, /\bsnapshot\b/i);
  assert.match(validatedBsReport.key_motivational_drivers[0].evidence, /\bmoderate\b/i);
  assert.match(validatedBsReport.manager_support_guidance[0].recommendation, /\bhigh\b/i);
  assert.equal(warningCalls.length > 0, true);
  assert.match(String(warningCalls[0][0]), /non-blocking findings/i);
  assert.equal(validatedBsReport.contractVersion, "mwms_hr_report_v1");
  assert.equal(validatedBsReport.reportType, "mwms_hr_report_v1");
  assert.equal(validatedBsReport.testSlug, "mwms_v1");
  assert.equal(validatedBsReport.sourceType, "single_test");
  assert.equal(validatedBsReport.meta.generatedAt, "2026-05-11T10:00:00.000Z");
  assert.equal(validatedBsReport.motivation_profile_snapshot.dimensions[0].rawScore, bsInput.promptInput.dimensions[0].rawScore);
  assert.equal(validatedBsReport.motivation_profile_snapshot.dimensions[0].band, bsInput.promptInput.dimensions[0].band);
  assert.equal(validatedBsReport.motivation_profile_snapshot.dimensions[1].rawScore, bsInput.promptInput.dimensions[1].rawScore);
  assert.equal(validatedBsReport.motivation_profile_snapshot.scale.min, 1);
  assert.equal(validatedBsReport.motivation_profile_snapshot.scale.max, 7);

  const invalidBsReport = buildValidReport(bsInput);
  invalidBsReport.interpretation_note =
    "Ti treba da citas ovaj prompt kao finalnu odluku o kandidatu.";
  const invalidBsReportBeforeValidation = clone(invalidBsReport);
  console.warn = () => {};

  try {
    assert.deepEqual(
      validateStructuredReport(invalidBsReport, bsInput),
      invalidBsReportBeforeValidation,
    );
  } finally {
    console.warn = originalWarn;
  }

  const invalidMwmsReport = buildValidReport(bsInput);
  invalidMwmsReport.safety_checks.noScoreMutation = false;
  assert.throws(
    () => validateStructuredReport(invalidMwmsReport, bsInput),
    /MWMS HR report validation.*noScoreMutation/i,
  );

  for (const locale of ["hr", "sr", "en"]) {
    const input = buildPreparedInput(locale);
    const report = buildValidReport(input);
    const before = clone(report);
    report.key_motivational_drivers[0].evidence =
      "Ovaj snapshot pokazuje moderate signal koji treba citati oprezno.";

    const directValidation = validateMwmsHrReportV1(report, { expectedInput: input.promptInput });
    assert.equal(directValidation.ok, true);

    const validated = validateStructuredReport(report, input);
    assert.equal(validated.locale, locale);
    assert.equal(validated.meta.language, locale);
    assert.equal(
      validated.key_motivational_drivers[0].evidence,
      "Ovaj snapshot pokazuje moderate signal koji treba citati oprezno.",
    );
    assert.match(validated.key_motivational_drivers[0].evidence, /\bsnapshot\b/i);
    assert.match(validated.key_motivational_drivers[0].evidence, /\bmoderate\b/i);
    assert.equal(validated.motivation_profile_snapshot.dimensions[0].band, before.motivation_profile_snapshot.dimensions[0].band);
    assert.equal(validated.motivation_profile_snapshot.dimensions[0].rawScore, before.motivation_profile_snapshot.dimensions[0].rawScore);
  }

  console.log("test-mwms-hr-bhs-language-policy: ok");
}

main();
