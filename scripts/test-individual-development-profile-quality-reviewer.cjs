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
  validateIndividualDevelopmentProfileSnapshot,
} = require("../lib/assessment/individual-development-profile-contract.ts");
const {
  formatReportLanguageQualityIssues,
  validateReportLanguageQuality,
} = require("../lib/assessment/report-language-quality.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildGoldenIdpHrReport() {
  return {
    reportType: "individual_development_profile_v1",
    reportVersion: "v1",
    locale: "bs",
    audience: "hr",
    developmentSummary: {
      headline: "Strukturisana podrška pomaže da razvojni nalaz brže postane vidljiv u radu.",
      overallPattern:
        "Korisno je postaviti jasan ritam rada, pregledan kontekst i kratke cikluse povratne informacije.",
      strongestContributionSignals: [
        "Nalaz se najlakše vidi kada su očekivanja pregledna i tempo dogovoren.",
        "Korisno je rano razjasniti način saradnje i prioritete.",
      ],
      mainSupportNeed: "Najviše pomaže jasan prioritet i konkretan feedback okvir.",
      usageNote:
        "Ovaj izvještaj je razvojni HR radni dokument i nalaze treba potvrditi kroz razgovor, onboarding i stvarni radni kontekst.",
    },
    contributionPattern: {
      bestConditions: ["Pregledan zadatak, jasan cilj i dogovoren ritam provjere napretka."],
      collaborationConditions: ["Redovan dogovor o prioritetima i očekivanjima u saradnji."],
      supportPreferences: ["Kratki feedback ciklusi i jasan kontekst prije širenja odgovornosti."],
      roleShapingImplications: ["Ulogu širiti postepeno kroz jasno definisane odgovornosti."],
    },
    developmentRisks: [
      {
        possibleBlocker: "Nejasni prioriteti mogu usporiti razvoj.",
        whyItMatters: "Bez jasnog fokusa teže je pretvoriti nalaz u stabilan radni ritam.",
        whatToCheck: "Provjeriti kako osoba traži kontekst i prioritete kada je zadatak otvoren.",
        howToSupport: "Dogovoriti ritam poravnanja očekivanja i povratne informacije.",
      },
    ],
    communicationAndFeedbackGuidance: {
      whatHelps: ["Kratak kontekst prije feedbacka i jasan sljedeći korak."],
      whatToAvoid: ["Preširoke komentare bez primjera ili dogovora o prioritetu."],
      howToPhraseFeedback: ["Feedback vezati za konkretan obrazac ponašanja i naredni korak."],
      whatToClarify: ["Šta je prioritet i kako će se pratiti napredak."],
    },
    motivationAndEnergyGuidance: {
      likelySourcesOfEnergy: ["Vidljiv napredak i smislen cilj koji je povezan sa radnim zadatkom."],
      likelySourcesOfDrain: ["Dug period bez povratne informacije ili jasno objašnjenog prioriteta."],
      supportSignals: ["Korisno je provjeriti gdje osoba vidi najviše smisla u radu."],
      whatToValidate: ["Šta pomaže da zadrži ritam, fokus i osjećaj napretka."],
    },
    oneOnOneGuidance: [
      {
        question: "Koji tip zadataka najlakše drži energiju stabilnom?",
        whatToListenFor: "Da li osoba jasno prepoznaje uslove u kojima najbolje funkcioniše.",
        signalBeingChecked: "Samouvid o angažmanu, fokusu i uslovima saradnje.",
        possibleFollowUp: "Koju podršku bi bilo korisno postaviti rano?",
      },
    ],
    onboardingPlan: {
      summary: "Onboarding plan prevodi razvojne nalaze u jasan 7 / 30 / 60 / 90 okvir za HR i menadžera.",
      first7Days: {
        focus: "U prvoj sedmici fokus je na jasnim očekivanjima i sigurnom početnom kontekstu.",
        managerActions: ["Definisati očekivanja i ritam check-in sastanaka."],
        feedbackGuidance: ["Feedback držati kratak, konkretan i dovoljno čest."],
        riskSignals: ["Ako prioritet i dalje nije jasan, onboarding okvir treba dodatno precizirati."],
      },
      first30Days: {
        focus: "U prvih 30 dana fokus je na provjeri kako se razvojni nalaz prevodi u svakodnevni rad.",
        managerActions: ["Provjeriti kako se razvojni nalaz prevodi u svakodnevni rad."],
        feedbackGuidance: ["Provjeriti da li osoba bolje reaguje na detaljniji okvir ili na jasne ciljeve uz više autonomije."],
        riskSignals: ["Ako napredak zavisi od stalnog pojašnjenja, podršku treba strukturirati preglednije."],
      },
      days31To60: {
        focus: "Između 31. i 60. dana fokus je na odnosu autonomije, saradnje i održivog ritma rada.",
        managerActions: ["Testirati odnos između autonomije i strukture kroz postepeno širenje odgovornosti."],
        feedbackGuidance: ["Feedback povezati sa opaženim obrascima angažmana i kvaliteta rada."],
        riskSignals: ["Ako kvalitet ostaje stabilan samo uz usku strukturu, autonomiju treba širiti sporije."],
      },
      days61To90: {
        focus: "Između 61. i 90. dana fokus je na učvršćivanju vlasništva nad ulogom i razvojnim prioritetima.",
        managerActions: ["Ažurirati razvojne prioritete prema opaženim obrascima."],
        feedbackGuidance: ["Feedback vezati za ono što se stvarno pokazalo u radu, ne samo za početnu hipotezu."],
        riskSignals: ["Ako isti zastoji ostaju prisutni, onboarding plan treba prevesti u uži razvojni plan."],
      },
      managerCheckpoints: ["Na kraju svake faze provjeriti da li su očekivanja, način saradnje i feedback ritam dovoljno jasni."],
      watchouts: ["Ne pretvarati onboarding plan u procjenu podobnosti, nego u okvir za podršku i provjeru razvoja."],
    },
    managerWatchpoints: [
      {
        watchpoint: "Pad angažmana kada je prioritet nejasan.",
        whyItMatters: "Može usporiti stabilizaciju uloge i razvojni ritam.",
        earlySignal: "Češće traženje potvrde oko redoslijeda zadataka.",
        suggestedManagerResponse: "Pojačati kratke razgovore o usklađivanju i konkretne naredne korake.",
      },
    ],
    interpretationLimits: [
      "Izvještaj je razvojni HR okvir i ne zamjenjuje direktno opažanje rada.",
    ],
    metadata: {
      generatedAt: "2026-06-02T12:00:00.000Z",
      generatorType: "mock",
      generatorVersion: "individual_development_profile_mock_v1",
      inputVersion: "individual_development_profile_input_v1",
    },
  };
}

function review(report) {
  return validateReportLanguageQuality({
    snapshot: report,
    locale: "bs",
    audience: "hr",
    reportType: "single_test",
    context: "individual_development_profile_hr_report",
  });
}

function expectIssue(report, expectedCode, label) {
  const result = review(report);
  assert.equal(result.ok, false, `${label} should fail quality review.`);
  assert.equal(
    result.issues.some((issue) => issue.code === expectedCode),
    true,
    `${label} should include ${expectedCode}. Issues: ${formatReportLanguageQualityIssues(result.issues)}`,
  );
}

function main() {
  const golden = buildGoldenIdpHrReport();
  const contractValidation = validateIndividualDevelopmentProfileSnapshot(golden);
  assert.equal(
    contractValidation.ok,
    true,
    contractValidation.ok ? undefined : contractValidation.errors.join(" | "),
  );

  const goldenReview = review(golden);
  assert.equal(
    goldenReview.ok,
    true,
    `Golden IDP HR report should pass quality review: ${formatReportLanguageQualityIssues(goldenReview.issues)}`,
  );

  const forbiddenTerminology = clone(golden);
  forbiddenTerminology.developmentSummary.headline =
    "Ugodnost treba čitati kao razvojni nalaz za saradnju.";
  expectIssue(forbiddenTerminology, "GLOSSARY_VIOLATION", "forbidden terminology");

  const internalTerms = clone(golden);
  internalTerms.developmentSummary.overallPattern =
    "HR-facing reduced AI narativ koristi numeric podatke za razvojni pregled.";
  expectIssue(internalTerms, "FORBIDDEN_TERM", "internal terms");

  const secondPersonTone = clone(golden);
  secondPersonTone.developmentSummary.usageNote =
    "Ti treba da pratiš svoj razvoj i tvoja pitanja treba uključiti u onboarding.";
  expectIssue(secondPersonTone, "FORBIDDEN_HR_SECOND_PERSON", "candidate-facing tone");

  const repeatedSignal = clone(golden);
  repeatedSignal.developmentSummary.overallPattern = Array.from(
    { length: 40 },
    () => "signal",
  ).join(" ");
  expectIssue(repeatedSignal, "REPETITIVE_WORDING", "repetitive signal wording");

  const cyrillicText = clone(golden);
  cyrillicText.developmentSummary.headline = "Развојни налаз треба провјерити у раду.";
  expectIssue(cyrillicText, "FORBIDDEN_SCRIPT", "non-latin script");

  const ekavianText = clone(golden);
  ekavianText.interpretationLimits[0] =
    "Ovaj izveštaj treba koristiti uz intervju, iskustvo i kontekst uloge.";
  expectIssue(ekavianText, "FORBIDDEN_PHRASE", "non-ijekavian wording");

  const sourceLeak = clone(golden);
  sourceLeak.developmentSummary.mainSupportNeed =
    "Ovaj source snapshot i metadata blok ne smiju biti vidljivi u HR izvještaju.";
  expectIssue(sourceLeak, "FORBIDDEN_DEBUG_LANGUAGE", "source wording leakage");

  console.log("test-individual-development-profile-quality-reviewer: ok");
}

main();
