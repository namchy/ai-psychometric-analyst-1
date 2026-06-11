const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const helperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-contract.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
const safetyPolicyPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "hr-report-safety-policy.ts",
);
const safetyPolicySource = fs.readFileSync(safetyPolicyPath, "utf8");
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
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

assert.match(helperSource, /INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE/);
assert.match(helperSource, /validateIndividualDevelopmentProfileSnapshot/);
assert.match(helperSource, /validateHrReportSafety/);
assert.doesNotMatch(helperSource, /function hasUnsafeIdpClaim/);
assert.doesNotMatch(helperSource, /\.from\("/);
assert.doesNotMatch(helperSource, /OpenAI|renderer|route|worker|scheduler/i);
assert.doesNotMatch(helperSource, /team-fit|team_dynamics/i);
assert.match(safetyPolicySource, /individual_development_profile_hr_report/);
assert.doesNotMatch(safetyPolicySource, /team.fit|team.dynamics|composite|safran|mwms|ipip/i);

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
  validateIndividualDevelopmentProfileSnapshot,
} = require(helperPath);
const {
  validateHrReportSafety,
} = require(safetyPolicyPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildValidSnapshot() {
  return {
    reportType: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
    reportVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
    locale: "bs",
    audience: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
    developmentSummary: {
      headline: "Razvojni obrazac traži jasan okvir i redovan feedback.",
      overallPattern:
        "Osoba djeluje najstabilnije kada su očekivanja jasna, prioriteti pregledni i razvojni razgovori konkretni.",
      strongestContributionSignals: [
        "Može održati fokus kada su ciljevi i kriteriji uspjeha rano razjašnjeni.",
      ],
      mainSupportNeed:
        "U ranom periodu vrijedi provjeriti koliko strukture i ritma povratne informacije pomaže stabilnom radu.",
      usageNote:
        "Ovaj izvještaj služi kao razvojna hipoteza za HR i menadžerski rad, ne kao konačna procjena osobe.",
    },
    contributionPattern: {
      bestConditions: ["Može doprinijeti najbolje kada su prioriteti i granice odgovornosti jasno postavljeni."],
      collaborationConditions: ["Vjerovatno će imati koristi od eksplicitnog dogovora o načinu saradnje i check-in ritmu."],
      supportPreferences: ["Ovaj signal sugeriše moguću preferenciju za pregledan radni okvir i jasan feedback."],
      roleShapingImplications: ["HR i menadžer treba da provjere da li je korisno rano definisati ritam autonomije i eskalacije."],
    },
    developmentRisks: [
      {
        possibleBlocker: "Nejasna očekivanja mogu usporiti rani razvojni zamah.",
        whyItMatters: "Bez jasnog okvira osoba može trošiti energiju na tumačenje prioriteta umjesto na izvršenje.",
        whatToCheck: "Provjeriti kako reaguje kada su prioriteti promjenjivi ili nedovoljno objašnjeni.",
        howToSupport: "Rano uskladiti ciljeve, kriterije uspjeha i ritam povratne informacije.",
      },
    ],
    communicationAndFeedbackGuidance: {
      whatHelps: ["Konkretan feedback sa jasnim primjerima i prioritetima za naredni korak."],
      whatToAvoid: ["Nejasne ili kontradiktorne poruke bez dogovora o tome šta je trenutno najvažnije."],
      howToPhraseFeedback: ["Feedback je najbolje dati kroz jasan signal šta funkcioniše, šta treba prilagoditi i do kada."],
      whatToClarify: ["Vrijedi razjasniti očekivani standard, nivo autonomije i kada tražiti podršku."],
    },
    motivationAndEnergyGuidance: {
      likelySourcesOfEnergy: ["Osoba može dobiti energiju iz osjećaja smisla i preglednog napretka."],
      likelySourcesOfDrain: ["Produžena neizvjesnost bez jasnog prioriteta može djelovati iscrpljujuće."],
      supportSignals: ["Priznanje napretka i jasan kontekst zadatka mogu pomoći održavanju angažmana."],
      whatToValidate: ["U razgovoru provjeriti koliko joj znače autonomija, struktura i vidljivost doprinosa."],
    },
    oneOnOneGuidance: [
      {
        question: "Kada najlakše održavate fokus i osjećaj napretka u novoj ulozi?",
        whatToListenFor: "Da li spontano traži jasne prioritete, povratnu informaciju ili prostor za autonomiju.",
        signalBeingChecked: "Odnos između strukture, motivacije i osjećaja kontrole nad radom.",
        possibleFollowUp: "Šta bi vam u prvih nekoliko sedmica najviše pomoglo da radite sigurnije i samostalnije?",
      },
    ],
    onboardingPlan: {
      summary: "Onboarding plan prevodi razvojni signal u strukturiran 7 / 30 / 60 / 90 okvir za HR i menadžera.",
      first7Days: {
        focus: "U prvoj sedmici fokus je na jasnim očekivanjima, ritmu podrške i sigurnom početnom kontekstu.",
        managerActions: ["Objasniti prioritete, standard rada i način traženja podrške."],
        feedbackGuidance: ["Feedback držati kratak, konkretan i dovoljno čest da smanji nejasnoću."],
        riskSignals: ["Ako osoba i dalje nije sigurna šta je prioritet, onboarding okvir treba dodatno precizirati."],
      },
      first30Days: {
        focus: "U prvih 30 dana fokus je na provjeri koliko pomažu struktura, feedback ritam i pregledan osjećaj napretka.",
        managerActions: ["Razjasniti očekivanja, ključne prioritete i ritam check-in razgovora."],
        feedbackGuidance: ["Vrijedi provjeriti da li osoba bolje reaguje na detaljniji okvir ili na jasne ciljeve uz više autonomije."],
        riskSignals: ["Ako se napredak vidi samo uz stalna dodatna pojašnjenja, podršku treba strukturirati preglednije."],
      },
      days31To60: {
        focus: "Između 31. i 60. dana fokus je na odnosu autonomije, saradnje i održivog ritma rada.",
        managerActions: ["Testirati odnos između autonomije i strukture kroz postepeno širenje odgovornosti."],
        feedbackGuidance: ["Feedback povezati sa opaženim obrascima angažmana i kvaliteta rada."],
        riskSignals: ["Ako kvalitet ostaje stabilan samo uz vrlo usku strukturu, autonomiju treba širiti sporije."],
      },
      days61To90: {
        focus: "Između 61. i 90. dana fokus je na učvršćivanju vlasništva nad ulogom i narednom razvojnom prioritetu.",
        managerActions: ["Pregledati razvojne signale, potvrditi watchpoint-e i prilagoditi model podrške."],
        feedbackGuidance: ["Feedback vezati za ono što se stvarno pokazalo u radu, ne samo za početnu hipotezu."],
        riskSignals: ["Ako isti zastoji ostaju prisutni, onboarding plan treba prevesti u uži razvojni plan."],
      },
      managerCheckpoints: [
        "Na kraju svake faze provjeriti da li su očekivanja, način saradnje i feedback ritam ostali dovoljno jasni.",
      ],
      watchouts: [
        "Ne pretvarati onboarding plan u procjenu podobnosti, nego u okvir za podršku i provjeru razvoja.",
      ],
    },
    managerWatchpoints: [
      {
        watchpoint: "Pad jasnoće oko prioriteta može usporiti inicijativu.",
        whyItMatters: "Ako očekivanja nisu dovoljno eksplicitna, razvojni zamah može oslabiti bez vidljivog konflikta.",
        earlySignal: "Osoba odgađa odluku dok ne dobije dodatno pojašnjenje ili previše puta provjerava očekivanja.",
        suggestedManagerResponse: "Skratiti nejasnoću kroz jasan dogovor o prioritetu, standardu i sljedećem koraku.",
      },
    ],
    interpretationLimits: [
      "Izvještaj je razvojni radni dokument i signale treba validirati kroz razgovor i radni kontekst.",
    ],
    metadata: {
      generatedAt: "2026-06-02T12:00:00.000Z",
    },
  };
}

function expectInvalid(snapshot, pattern) {
  const validation = validateIndividualDevelopmentProfileSnapshot(snapshot);
  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((error) => pattern.test(error)), true);
}

function expectValidNarrative(snapshot, path, text) {
  const candidate = clone(snapshot);
  candidate.developmentRisks[0].possibleBlocker = text;
  const validation = validateIndividualDevelopmentProfileSnapshot(candidate);
  assert.equal(
    validation.ok,
    true,
    `${path} should be allowed: ${validation.ok ? "" : validation.errors.join(" | ")}`,
  );
}

function main() {
  const valid = buildValidSnapshot();
  const validResult = validateIndividualDevelopmentProfileSnapshot(valid);

  assert.equal(validResult.ok, true);
  assert.equal(valid.reportType, INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE);

  const wrongReportType = clone(valid);
  wrongReportType.reportType = "team_fit_report_v1";
  expectInvalid(wrongReportType, /reportType/);

  const wrongAudience = clone(valid);
  wrongAudience.audience = "participant";
  expectInvalid(wrongAudience, /audience/);

  const missingAudience = clone(valid);
  delete missingAudience.audience;
  expectInvalid(missingAudience, /audience/);

  const missingSection = clone(valid);
  delete missingSection.developmentRisks;
  expectInvalid(missingSection, /developmentRisks/);

  const missingOnboardingPlan = clone(valid);
  delete missingOnboardingPlan.onboardingPlan;
  expectInvalid(missingOnboardingPlan, /onboardingPlan/);

  const emptyRequiredBlock = clone(valid);
  emptyRequiredBlock.developmentSummary.overallPattern = "   ";
  expectInvalid(emptyRequiredBlock, /developmentSummary\.overallPattern/);

  for (const placeholder of ["N/A", "TBD", "Lorem ipsum"]) {
    const placeholderSnapshot = clone(valid);
    placeholderSnapshot.developmentSummary.mainSupportNeed = placeholder;
    expectInvalid(placeholderSnapshot, /developmentSummary\.mainSupportNeed/);
  }

  const genericSummary = clone(valid);
  genericSummary.developmentSummary.headline = "Ovaj izvještaj prikazuje razvojni profil.";
  assert.equal(validateIndividualDevelopmentProfileSnapshot(genericSummary).ok, true);

  const duplicateSummaryFields = clone(valid);
  duplicateSummaryFields.developmentSummary.usageNote =
    duplicateSummaryFields.developmentSummary.overallPattern;
  assert.equal(validateIndividualDevelopmentProfileSnapshot(duplicateSummaryFields).ok, true);

  const duplicateContributionSignals = clone(valid);
  duplicateContributionSignals.developmentSummary.strongestContributionSignals = [
    "Jasan dogovor o prioritetima pomaže da osoba ranije pokaže stabilan doprinos.",
    "Jasan dogovor o prioritetima pomaže da osoba ranije pokaže stabilan doprinos.",
  ];
  assert.equal(validateIndividualDevelopmentProfileSnapshot(duplicateContributionSignals).ok, true);

  const emptyOnboardingFocus = clone(valid);
  emptyOnboardingFocus.onboardingPlan.first7Days.focus = " ";
  expectInvalid(emptyOnboardingFocus, /onboardingPlan\.first7Days\.focus/);

  const forbiddenHireWording = clone(valid);
  forbiddenHireWording.developmentSummary.usageNote = "This should be a hire recommendation for the role.";
  expectInvalid(forbiddenHireWording, /forbiddenText/);

  const forbiddenDiagnosisWording = clone(valid);
  forbiddenDiagnosisWording.developmentRisks[0].possibleBlocker = "This looks like a clinical diagnosis issue.";
  expectInvalid(forbiddenDiagnosisWording, /forbiddenText/);

  const forbiddenNumericFitScoreWording = clone(valid);
  forbiddenNumericFitScoreWording.developmentSummary.mainSupportNeed = "Overall fit score: 82/100.";
  expectInvalid(forbiddenNumericFitScoreWording, /forbiddenText/);

  for (const technicalLeak of [
    "Ovaj deterministic zaključak dolazi iz internog obračuna.",
    "Ovaj snapshot sadrži razvojne preporuke.",
    "Numeric vrijednost potvrđuje razvojni obrazac.",
    "Provider je generisao ovu preporuku.",
    "Schema zahtijeva ovu formulaciju.",
  ]) {
    const technicalLeakSnapshot = clone(valid);
    technicalLeakSnapshot.developmentSummary.mainSupportNeed = technicalLeak;
    expectInvalid(technicalLeakSnapshot, /forbiddenText/);
  }

  for (const treatmentInstruction of [
    "Osoba treba započeti terapiju.",
    "Menadžer treba pratiti plan liječenja.",
    "Preporučuje se psihološka intervencija.",
  ]) {
    const treatmentSnapshot = clone(valid);
    treatmentSnapshot.developmentRisks[0].howToSupport = treatmentInstruction;
    expectInvalid(treatmentSnapshot, /forbiddenText/);
  }

  const unsafeOverclaim = clone(valid);
  unsafeOverclaim.managerWatchpoints[0].suggestedManagerResponse =
    "Ovaj rezultat sigurno pokazuje da osoba uvijek mora raditi samo uz strogu kontrolu.";
  expectInvalid(unsafeOverclaim, /unsafe or overclaiming IDP assertion/i);

  for (const allowedText of [
    "Niže izražena ekstraverzija upućuje da Amra možda neće uvijek spontano preuzimati prostor u grupnim diskusijama, pa je korisno dati joj jasan kanal za doprinos.",
    "U brzim grupnim diskusijama doprinos se možda neće uvijek pojaviti spontano, pa je korisno unaprijed dogovoriti jasan kanal za uključivanje.",
    "Ovaj obrazac može otežati doprinos u nejasno vođenim diskusijama.",
    "Vrijedi provjeriti kako se doprinos mijenja kada su očekivanja i format razmjene jasni.",
    "Saradnički stil rada vjerovatno podržava stabilne odnose i upućuje na koristan obrazac saradnje.",
  ]) {
    expectValidNarrative(
      valid,
      "developmentRisks[0].possibleBlocker",
      allowedText,
    );
  }

  const workloadPrioritization = clone(valid);
  workloadPrioritization.developmentRisks[0].howToSupport =
    "Na početku zadatka dogovoriti prioritete, granicu konsultacije i redoslijed isporuke kada sve ne može biti završeno istovremeno.";
  assert.equal(
    validateIndividualDevelopmentProfileSnapshot(workloadPrioritization).ok,
    true,
  );

  for (const blockedSafetyText of [
    "Amra će uvijek izbjegavati grupne diskusije.",
    "Rezultat dokazuje da Amra neće uspjeti u timskom radu.",
    "Niža ekstraverzija znači da kandidat nije pogodan za timski rad.",
    "Kandidata treba zaposliti.",
    "Ovo ukazuje na klinički poremećaj.",
  ]) {
    const blockedSnapshot = clone(valid);
    blockedSnapshot.developmentRisks[0].possibleBlocker = blockedSafetyText;
    expectInvalid(blockedSnapshot, /unsafe or overclaiming IDP assertion/i);
  }

  const demeaningText = clone(valid);
  demeaningText.developmentRisks[0].possibleBlocker =
    "Amra je problematična u grupnim diskusijama.";
  expectInvalid(demeaningText, /forbiddenText/);

  const directSafetyIssues = validateHrReportSafety(
    "Amra će uvijek izbjegavati grupne diskusije.",
    {
      context: "individual_development_profile_hr_report",
      path: "developmentRisks[0].possibleBlocker",
    },
  );
  assert.equal(directSafetyIssues.length > 0, true);
  assert.equal(
    directSafetyIssues[0].path,
    "developmentRisks[0].possibleBlocker",
  );
  assert.equal(directSafetyIssues[0].code, "CATEGORICAL_PREDICTION");

  const workloadSafetyIssues = validateHrReportSafety(
    workloadPrioritization.developmentRisks[0].howToSupport,
    {
      context: "individual_development_profile_hr_report",
      path: "developmentRisks[0].howToSupport",
    },
  );
  assert.equal(
    workloadSafetyIssues.some((issue) => issue.code === "VALUE_JUDGEMENT"),
    true,
  );

  const missingInterpretationLimits = clone(valid);
  missingInterpretationLimits.interpretationLimits = [];
  expectInvalid(missingInterpretationLimits, /interpretationLimits/);

  const duplicateInterpretationLimits = clone(valid);
  duplicateInterpretationLimits.interpretationLimits = [
    "Izvještaj je razvojni radni dokument i signale treba validirati kroz razgovor i radni kontekst.",
    "Izvještaj je razvojni radni dokument i signale treba validirati kroz razgovor i radni kontekst.",
  ];
  assert.equal(validateIndividualDevelopmentProfileSnapshot(duplicateInterpretationLimits).ok, true);

  const duplicateRiskSubfields = clone(valid);
  duplicateRiskSubfields.developmentRisks[0].whyItMatters =
    duplicateRiskSubfields.developmentRisks[0].possibleBlocker;
  assert.equal(validateIndividualDevelopmentProfileSnapshot(duplicateRiskSubfields).ok, true);

  const statementQuestion = clone(valid);
  statementQuestion.oneOnOneGuidance[0].question =
    "Osoba treba opisati kada najlakše održava fokus u novoj ulozi.";
  expectInvalid(statementQuestion, /oneOnOneGuidance\[0\]\.question.*question-shaped/i);

  const validDistinctArrays = clone(valid);
  validDistinctArrays.developmentSummary.strongestContributionSignals = [
    "Rano razjašnjen standard rada pomaže da osoba pokaže stabilan ritam doprinosa.",
    "Dogovoren feedback ritam pomaže da razvojni signal ne ostane samo početna pretpostavka.",
  ];
  validDistinctArrays.contributionPattern.bestConditions = [
    "Najbolje funkcioniše kada su prioriteti, odgovornosti i kriteriji uspjeha jasno povezani.",
    "Lakše doprinosi kada postoji prostor za autonomiju uz dovoljno brz pristup kontekstu.",
  ];
  validDistinctArrays.interpretationLimits = [
    "Izvještaj je razvojni radni dokument i signale treba validirati kroz razgovor i radni kontekst.",
    "Zaključke treba povezati sa stvarnim ponašanjem u ulozi, menadžerskim opažanjem i feedbackom.",
  ];
  const validDistinctArraysResult =
    validateIndividualDevelopmentProfileSnapshot(validDistinctArrays);
  assert.equal(
    validDistinctArraysResult.ok,
    true,
    validDistinctArraysResult.ok ? undefined : validDistinctArraysResult.errors.join(" | "),
  );

  const legacySnapshot = clone(valid);
  legacySnapshot.onboardingAndDevelopmentPlan = {
    first30Days: ["Legacy prvih 30 dana."],
    days31To60: ["Legacy 31 do 60 dana."],
    days61To90: ["Legacy 61 do 90 dana."],
  };
  delete legacySnapshot.onboardingPlan;
  const legacyResult = validateIndividualDevelopmentProfileSnapshot(legacySnapshot);
  assert.equal(legacyResult.ok, true);
  if (!legacyResult.ok) {
    throw new Error(legacyResult.errors.join(" | "));
  }
  assert.equal(legacyResult.value.onboardingPlan.first30Days.managerActions.length > 0, true);

  console.log("test-individual-development-profile-contract: ok");
}

main();
