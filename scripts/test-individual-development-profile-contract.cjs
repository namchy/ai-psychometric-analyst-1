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
assert.doesNotMatch(helperSource, /\.from\("/);
assert.doesNotMatch(helperSource, /OpenAI|provider|renderer|route|worker|scheduler/i);
assert.doesNotMatch(helperSource, /team-fit|team_dynamics/i);

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
  validateIndividualDevelopmentProfileSnapshot,
} = require(helperPath);

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
    onboardingAndDevelopmentPlan: {
      first30Days: ["Razjasniti očekivanja, ključne prioritete i ritam check-in razgovora."],
      days31To60: ["Testirati odnos između autonomije i strukture kroz postepeno širenje odgovornosti."],
      days61To90: ["Pregledati razvojne signale, potvrditi watchpoint-e i prilagoditi model podrške."],
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

  const emptyRequiredBlock = clone(valid);
  emptyRequiredBlock.developmentSummary.overallPattern = "   ";
  expectInvalid(emptyRequiredBlock, /developmentSummary\.overallPattern/);

  const forbiddenHireWording = clone(valid);
  forbiddenHireWording.developmentSummary.usageNote = "This should be a hire recommendation for the role.";
  expectInvalid(forbiddenHireWording, /forbiddenText/);

  const forbiddenDiagnosisWording = clone(valid);
  forbiddenDiagnosisWording.developmentRisks[0].possibleBlocker = "This looks like a clinical diagnosis issue.";
  expectInvalid(forbiddenDiagnosisWording, /forbiddenText/);

  const forbiddenNumericFitScoreWording = clone(valid);
  forbiddenNumericFitScoreWording.developmentSummary.mainSupportNeed = "Overall fit score: 82/100.";
  expectInvalid(forbiddenNumericFitScoreWording, /forbiddenText/);

  const missingInterpretationLimits = clone(valid);
  missingInterpretationLimits.interpretationLimits = [];
  expectInvalid(missingInterpretationLimits, /interpretationLimits/);

  console.log("test-individual-development-profile-contract: ok");
}

main();
