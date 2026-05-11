const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
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
  MWMS_HR_REPORT_CONTRACT_VERSION,
  MWMS_HR_REPORT_TYPE,
  MWMS_HR_REPORT_V1_CONTRACT,
  buildMwmsHrReportInput,
  formatMwmsHrReportValidationErrors,
  validateMwmsHrReportV1,
} = require("../lib/assessment/mwms-hr-report-v1.ts");

function buildInput() {
  return buildMwmsHrReportInput({
    attemptId: "attempt-mwms-hr-contract",
    testId: "test-mwms",
    testSlug: "mwms_v1",
    audience: "hr",
    locale: "bs",
    scoringMethod: "likert_sum",
    promptVersion: "v1",
    results: {
      attemptId: "attempt-mwms-hr-contract",
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
  });
}

function buildValidReport(input) {
  const dimensions = input.dimensions.map(({ code, label, rawScore, band, bandLabel }) => ({
    code,
    label,
    rawScore,
    band,
    bandLabel,
  }));

  return {
    contractVersion: MWMS_HR_REPORT_CONTRACT_VERSION,
    reportType: MWMS_HR_REPORT_TYPE,
    testSlug: "mwms_v1",
    audience: "hr",
    sourceType: "single_test",
    locale: "bs",
    meta: {
      language: "bs",
      generatedAt: "2026-05-11T10:00:00.000Z",
    },
    motivation_profile_snapshot: {
      scale: {
        min: 1,
        max: 7,
      },
      dimensions,
      derivedProfile: input.derivedProfile,
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
      "MWMS HR izvjestaj koristi vec izracunate rezultate kao motivacijski profil. Ne mijenja score ili band i sluzi samo kao oprezna HR hipoteza za dalji razgovor.",
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

const input = buildInput();
const report = buildValidReport(input);
const validation = validateMwmsHrReportV1(report, { expectedInput: input });

assert.equal(
  validation.ok,
  true,
  validation.ok ? undefined : formatMwmsHrReportValidationErrors(validation.errors),
);
assert.equal(MWMS_HR_REPORT_V1_CONTRACT.promptKey, "mwms_hr_report_v1");
assert.equal(MWMS_HR_REPORT_V1_CONTRACT.schemaId, "mwms-hr-report-v1");
assert.equal(report.motivation_profile_snapshot.dimensions.length, 6);

const wrongCardinality = {
  ...report,
  key_motivational_drivers: report.key_motivational_drivers.slice(0, 2),
};
const wrongCardinalityValidation = validateMwmsHrReportV1(wrongCardinality, { expectedInput: input });
assert.equal(wrongCardinalityValidation.ok, false);
assert.match(
  formatMwmsHrReportValidationErrors(wrongCardinalityValidation.errors),
  /key_motivational_drivers: Expected exactly 3/,
);

const forbiddenLanguage = {
  ...report,
  interpretation_note:
    "Ovaj tekst kaze da se preporucuje se zaposljavanje i zato mora pasti validaciju.",
};
const forbiddenValidation = validateMwmsHrReportV1(forbiddenLanguage, { expectedInput: input });
assert.equal(forbiddenValidation.ok, false);
assert.match(
  formatMwmsHrReportValidationErrors(forbiddenValidation.errors),
  /Forbidden phrase/,
);

const mutatedScore = structuredClone(report);
mutatedScore.motivation_profile_snapshot.dimensions[0].rawScore = 4.25;
const mutatedScoreValidation = validateMwmsHrReportV1(mutatedScore, { expectedInput: input });
assert.equal(mutatedScoreValidation.ok, false);
assert.match(
  formatMwmsHrReportValidationErrors(mutatedScoreValidation.errors),
  /rawScore: Expected 4/,
);

const mutatedBand = structuredClone(report);
mutatedBand.motivation_profile_snapshot.dimensions[2].band = "lower";
const mutatedBandValidation = validateMwmsHrReportV1(mutatedBand, { expectedInput: input });
assert.equal(mutatedBandValidation.ok, false);
assert.match(
  formatMwmsHrReportValidationErrors(mutatedBandValidation.errors),
  /band: Expected higher/,
);

const incompleteDimensions = structuredClone(report);
incompleteDimensions.motivation_profile_snapshot.dimensions[5] = {
  ...incompleteDimensions.motivation_profile_snapshot.dimensions[5],
  code: "amotivation",
};
const incompleteDimensionsValidation = validateMwmsHrReportV1(incompleteDimensions, {
  expectedInput: input,
});
assert.equal(incompleteDimensionsValidation.ok, false);
assert.match(
  formatMwmsHrReportValidationErrors(incompleteDimensionsValidation.errors),
  /Missing intrinsic|unique canonical MWMS dimension codes/,
);

console.log("MWMS HR report contract tests passed.");
