const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const viewPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "individual-development-profile-report-view.tsx",
);
const contractPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-contract.ts",
);
const displayHelperPath = path.join(
  projectRoot,
  "lib",
  "assessment",
  "individual-development-profile-display.ts",
);
const emptyModulePath = path.join(__dirname, "empty-module.cjs");
const originalResolveFilename = Module._resolveFilename;

const viewSource = fs.readFileSync(viewPath, "utf8");
const displaySource = fs.readFileSync(displayHelperPath, "utf8");

assert.match(viewSource, /export function IndividualDevelopmentProfileReportView/);
assert.match(viewSource, /Individualni razvojni profil/);
assert.match(viewSource, /Razvojni sažetak/);
assert.match(viewSource, /Kako osoba može najbolje doprinijeti/);
assert.match(viewSource, /Šta može blokirati razvoj/);
assert.match(viewSource, /Razvojni rizik/);
assert.match(viewSource, /Komunikacija i feedback/);
assert.match(viewSource, /Motivacija i energija/);
assert.match(viewSource, /1:1 razgovori/);
assert.match(viewSource, /Onboarding i razvojni plan/);
assert.match(viewSource, /Sažetak plana/);
assert.match(viewSource, /7 \/ 30 \/ 60 \/ 90/);
assert.match(viewSource, /Plan po fazama/);
assert.match(viewSource, /Prvih 7 dana/);
assert.match(viewSource, /Fokus faze/);
assert.match(viewSource, /Menadžerske akcije/);
assert.match(viewSource, /Feedback smjernice/);
assert.match(viewSource, /Rani signali za pažnju/);
assert.match(viewSource, /Sekundarne provjere/);
assert.match(viewSource, /Checkpoints i watchout signali/);
assert.match(viewSource, /Menadžerske checkpoint tačke/);
assert.match(viewSource, /Watchout signali/);
assert.match(viewSource, /Na šta menadžer treba obratiti pažnju/);
assert.match(viewSource, /Ograničenja tumačenja/);
assert.doesNotMatch(viewSource, /radne hipoteze/i);
assert.doesNotMatch(viewSource, /svaka kartica je hipoteza/i);
assert.doesNotMatch(viewSource, /ovaj signal može pomoći HR-u/i);
assert.doesNotMatch(viewSource, /pretvori u operativan|pretvori u operativni/i);
assert.doesNotMatch(viewSource, /provjeri šta održava angažman/i);
assert.doesNotMatch(viewSource, /\.from\(|\.insert\(|\.update\(/);
assert.doesNotMatch(viewSource, /loadIndividualDevelopmentProfileDisplay|buildIndividualDevelopmentProfileInputSnapshot|processIndividualDevelopmentProfileAssessmentReport/);
assert.doesNotMatch(viewSource, /validateIndividualDevelopmentProfileSnapshot/);
assert.doesNotMatch(viewSource, /generateIndividualDevelopmentProfileReport|generateIndividualDevelopmentProfileWithMock|OpenAI|openai|external/i);
assert.doesNotMatch(viewSource, /route|app\/actions|worker|scheduler/i);
assert.doesNotMatch(
  viewSource,
  /from\s+["'][^"']*(?:provider|openai|lifecycle|action|worker|scheduler|supabase|database|db-write)[^"']*["']/i,
);
assert.doesNotMatch(
  viewSource,
  /\b(?:fetch|createClient|createAdminClient|revalidatePath|redirect|enqueue|publish|dispatch)\s*\(/,
);
assert.doesNotMatch(viewSource, /team-fit|team_dynamics/i);
assert.doesNotMatch(viewSource, /\bno-hire\b|\bhire\/no-hire\b|\bfit score\b|\bbad fit\b/i);
assert.doesNotMatch(viewSource, /\bne zaposliti\b|\bzaposliti\b kao preporuk/i);
assert.doesNotMatch(viewSource, /\bdijagnoz/i);
assert.doesNotMatch(viewSource, /\brank(?:ing|irati|iranj)/i);
assert.doesNotMatch(viewSource, /rawAnswers|rawResponses|itemText|rawItemText|input_snapshot|scoringKeys|JSON\.stringify/);
assert.doesNotMatch(viewSource, /`onboardingPlan`|onboardingPlan bez dodatnog tumačenja/);
assert.doesNotMatch(viewSource, /\bti\b/);
assert.doesNotMatch(displaySource, /IndividualDevelopmentProfileReportView/);

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
  if (request === "server-only" || request === "@/lib/supabase/admin") {
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

require.extensions[".tsx"] = function compileTsx(module, filename) {
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
};

const {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
} = require(contractPath);
const {
  IndividualDevelopmentProfileReportView,
} = require(viewPath);

function buildSnapshot(overrides = {}) {
  return {
    reportType: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
    reportVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
    locale: "bs",
    audience: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
    developmentSummary: {
      headline: "Strukturisana podrška pomaže da razvojni signal brže postane vidljiv u radu.",
      overallPattern:
        "Korisno je postaviti jasan ritam rada, pregledan kontekst i kratke cikluse povratne informacije.",
      strongestContributionSignals: [
        "Signal se najlakše vidi kada su očekivanja pregledna i tempo dogovoren.",
        "Korisno je rano razjasniti način saradnje i prioritete.",
      ],
      mainSupportNeed: "Najviše pomaže jasan prioritet i konkretan feedback okvir.",
      usageNote:
        "Ovaj signal može pomoći HR-u da provjeri kako najbolje postaviti onboarding, feedback i razvojni plan.",
    },
    contributionPattern: {
      bestConditions: ["Pregledan zadatak i jasan cilj."],
      collaborationConditions: ["Redovan dogovor o prioritetima i očekivanjima."],
      supportPreferences: ["Kratki feedback loopovi i jasan kontekst."],
      roleShapingImplications: ["Ulogu širiti postepeno kroz jasno definisane odgovornosti."],
    },
    developmentRisks: [
      {
        possibleBlocker: "Nejasni prioriteti mogu usporiti razvoj.",
        whyItMatters: "Bez jasnog fokusa teže je pretvoriti signal u stabilan radni ritam.",
        whatToCheck: "Provjeriti kako osoba traži kontekst i prioritete kada je zadatak otvoren.",
        howToSupport: "Dogovoriti ritam poravnanja očekivanja i povratne informacije.",
      },
    ],
    communicationAndFeedbackGuidance: {
      whatHelps: ["Kratak kontekst prije feedbacka."],
      whatToAvoid: ["Preširoke komentare bez primjera."],
      howToPhraseFeedback: ["Feedback vezati za konkretan obrazac ponašanja i naredni korak."],
      whatToClarify: ["Šta je prioritet i kako će se pratiti napredak."],
    },
    motivationAndEnergyGuidance: {
      likelySourcesOfEnergy: ["Vidljiv napredak i smislen cilj."],
      likelySourcesOfDrain: ["Dug period bez povratne informacije."],
      supportSignals: ["Korisno je provjeriti gdje osoba vidi najviše smisla."],
      whatToValidate: ["Šta joj pomaže da zadrži ritam i fokus."],
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
      summary: "Onboarding plan prevodi razvojni signal u jasan 7 / 30 / 60 / 90 okvir za HR i menadžera.",
      first7Days: {
        focus: "U prvoj sedmici fokus je na jasnim očekivanjima i sigurnom početnom kontekstu.",
        managerActions: ["Definisati očekivanja i ritam check-in sastanaka."],
        feedbackGuidance: ["Feedback držati kratak, konkretan i dovoljno čest."],
        riskSignals: ["Ako prioritet i dalje nije jasan, onboarding okvir treba dodatno precizirati."],
      },
      first30Days: {
        focus: "U prvih 30 dana fokus je na provjeri kako se razvojni signal prevodi u svakodnevni rad.",
        managerActions: ["Provjeriti kako se razvojni signal prevodi u svakodnevni rad."],
        feedbackGuidance: ["Provjeriti da li osoba bolje reaguje na detaljniji okvir ili na jasne ciljeve uz više autonomije."],
        riskSignals: ["Ako napredak zavisi od stalnog dodatnog pojašnjenja, podršku treba strukturirati preglednije."],
      },
      days31To60: {
        focus: "Između 31. i 60. dana fokus je na odnosu autonomije, saradnje i održivog ritma rada.",
        managerActions: ["Testirati odnos između autonomije i strukture kroz postepeno širenje odgovornosti."],
        feedbackGuidance: ["Feedback povezati sa opaženim obrascima angažmana i kvaliteta rada."],
        riskSignals: ["Ako kvalitet ostaje stabilan samo uz vrlo usku strukturu, autonomiju treba širiti sporije."],
      },
      days61To90: {
        focus: "Između 61. i 90. dana fokus je na učvršćivanju vlasništva nad ulogom i razvojnim prioritetima.",
        managerActions: ["Ažurirati razvojne prioritete prema opaženim obrascima."],
        feedbackGuidance: ["Feedback vezati za ono što se stvarno pokazalo u radu, ne samo za početnu hipotezu."],
        riskSignals: ["Ako isti zastoji ostaju prisutni, onboarding plan treba prevesti u uži razvojni plan."],
      },
      managerCheckpoints: ["Na kraju svake faze provjeriti da li su očekivanja, način saradnje i feedback ritam ostali dovoljno jasni."],
      watchouts: ["Ne pretvarati onboarding plan u procjenu podobnosti, nego u okvir za podršku i provjeru razvoja."],
    },
    managerWatchpoints: [
      {
        watchpoint: "Pad angažmana kada je prioritet nejasan.",
        whyItMatters: "Može usporiti stabilizaciju uloge i razvojni ritam.",
        earlySignal: "Češće traženje potvrde oko redoslijeda zadataka.",
        suggestedManagerResponse: "Pojačati kratke alignment razgovore i konkretne naredne korake.",
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
    ...overrides,
  };
}

function render(element) {
  return ReactDOMServer.renderToStaticMarkup(element);
}

function countOccurrences(value, searchValue) {
  return value.split(searchValue).length - 1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectVisibleReportText(snapshot) {
  return [
    ...Object.values(snapshot.developmentSummary).flat(),
    ...Object.values(snapshot.contributionPattern).flat(),
    ...snapshot.developmentRisks.flatMap(Object.values),
    ...Object.values(snapshot.communicationAndFeedbackGuidance).flat(),
    ...Object.values(snapshot.motivationAndEnergyGuidance).flat(),
    ...snapshot.oneOnOneGuidance.flatMap(Object.values),
    snapshot.onboardingPlan.summary,
    ...[
      snapshot.onboardingPlan.first7Days,
      snapshot.onboardingPlan.first30Days,
      snapshot.onboardingPlan.days31To60,
      snapshot.onboardingPlan.days61To90,
    ].flatMap((stage) => Object.values(stage).flat()),
    ...snapshot.onboardingPlan.managerCheckpoints,
    ...snapshot.onboardingPlan.watchouts,
    ...snapshot.managerWatchpoints.flatMap(Object.values),
    ...snapshot.interpretationLimits,
  ];
}

function main() {
  const snapshot = buildSnapshot();

  const htmlFromSnapshot = render(
    React.createElement(IndividualDevelopmentProfileReportView, {
      snapshot,
      participantDisplayName: "Amina Candidate",
      generatedAt: "2026-06-02T12:00:00.000Z",
      completedAt: "2026-06-02T12:05:00.000Z",
    }),
  );

  assert.match(htmlFromSnapshot, /Individualni razvojni profil/);
  assert.match(htmlFromSnapshot, /Razvojni sažetak/);
  assert.match(htmlFromSnapshot, /Kako osoba može najbolje doprinijeti/);
  assert.match(htmlFromSnapshot, /Šta može blokirati razvoj/);
  assert.match(htmlFromSnapshot, /Razvojni rizik/);
  assert.equal(
    countOccurrences(htmlFromSnapshot, "Šta može blokirati razvoj"),
    1,
    "risk section title must not be duplicated as the card eyebrow",
  );
  assert.match(htmlFromSnapshot, /Komunikacija i feedback/);
  assert.match(htmlFromSnapshot, /Motivacija i energija/);
  assert.match(htmlFromSnapshot, /1:1 razgovori/);
  assert.match(htmlFromSnapshot, /Onboarding i razvojni plan/);
  assert.match(htmlFromSnapshot, /Sažetak plana/);
  assert.match(htmlFromSnapshot, /7 \/ 30 \/ 60 \/ 90/);
  assert.match(htmlFromSnapshot, /Plan po fazama/);
  assert.match(htmlFromSnapshot, /Prvih 7 dana/);
  assert.match(htmlFromSnapshot, /Prvih 30 dana/);
  assert.match(htmlFromSnapshot, /31 do 60 dana/);
  assert.match(htmlFromSnapshot, /61 do 90 dana/);
  assert.match(htmlFromSnapshot, /Fokus faze/);
  assert.match(htmlFromSnapshot, /Menadžerske akcije/);
  assert.match(htmlFromSnapshot, /Feedback smjernice/);
  assert.match(htmlFromSnapshot, /Rani signali za pažnju/);
  assert.match(htmlFromSnapshot, /Sekundarne provjere/);
  assert.match(htmlFromSnapshot, /Checkpoints i watchout signali/);
  assert.match(htmlFromSnapshot, /Menadžerske checkpoint tačke/);
  assert.match(htmlFromSnapshot, /Watchout signali/);
  assert.match(htmlFromSnapshot, /Na šta menadžer treba obratiti pažnju/);
  assert.match(htmlFromSnapshot, /Ograničenja tumačenja/);
  assert.match(htmlFromSnapshot, /Amina Candidate/);
  assert.match(htmlFromSnapshot, /Ovaj razvojni HR izvještaj služi za onboarding, feedback, 1:1 razgovore i razvojni plan/);
  assert.equal(
    countOccurrences(htmlFromSnapshot, snapshot.developmentSummary.overallPattern),
    1,
    "overallPattern must render exactly once",
  );
  assert.equal(
    countOccurrences(htmlFromSnapshot, snapshot.developmentSummary.usageNote),
    1,
    "usageNote must render exactly once",
  );
  assert.equal(
    countOccurrences(htmlFromSnapshot, snapshot.onboardingPlan.summary),
    1,
    "onboardingPlan.summary must render exactly once",
  );
  assert.match(
    htmlFromSnapshot,
    new RegExp(
      `Kako HR može koristiti nalaz[\\s\\S]*${escapeRegExp(snapshot.developmentSummary.usageNote)}`,
    ),
  );
  assert.doesNotMatch(
    htmlFromSnapshot,
    new RegExp(
      `Korištenje[\\s\\S]{0,500}${escapeRegExp(snapshot.developmentSummary.usageNote)}`,
    ),
  );
  assert.doesNotMatch(
    htmlFromSnapshot,
    new RegExp(
      `Onboarding i razvojni plan[\\s\\S]*${escapeRegExp(snapshot.developmentSummary.overallPattern)}`,
    ),
    "onboarding section must not repeat overallPattern",
  );
  assert.doesNotMatch(
    htmlFromSnapshot,
    new RegExp(
      `Onboarding i razvojni plan[\\s\\S]*${escapeRegExp(snapshot.developmentSummary.usageNote)}`,
    ),
    "onboarding section must not repeat usageNote",
  );
  assert.doesNotMatch(htmlFromSnapshot, /onboardingPlan bez dodatnog tumačenja|`onboardingPlan`/);
  assert.match(
    htmlFromSnapshot,
    /Korištenje[\s\S]{0,500}Namijenjeno strukturiranom HR i menadžerskom pregledu\./,
  );
  assert.doesNotMatch(
    htmlFromSnapshot,
    /radne hipoteze|svaka kartica je hipoteza|pretvori u operativan|pretvori u operativni|provjeri šta održava angažman/i,
  );
  collectVisibleReportText(snapshot).forEach((text) => {
    assert.ok(
      htmlFromSnapshot.includes(text),
      `Expected fixture report text to remain unchanged in rendered output: ${text}`,
    );
  });
  assert.doesNotMatch(htmlFromSnapshot, /fit score|no-hire|hire\/no-hire|bad fit|rawAnswers|input_snapshot|JSON/i);

  const htmlFromRecord = render(
    React.createElement(IndividualDevelopmentProfileReportView, {
      record: {
        status: "ready",
        participantDisplayName: "Lejla Profile",
        generatedAt: "2026-06-02T12:00:00.000Z",
        completedAt: "2026-06-02T12:10:00.000Z",
        safeStatusMessage: "Izvještaj je spreman za pregled.",
        metadata: {
          generatorType: "mock",
          generatorVersion: "individual_development_profile_mock_v1",
          modelName: "mock-model",
        },
        reportSnapshot: buildSnapshot({
          contributionPattern: {
            bestConditions: [],
            collaborationConditions: [],
            supportPreferences: [],
            roleShapingImplications: [],
          },
          developmentRisks: [],
          oneOnOneGuidance: [],
          managerWatchpoints: [],
          interpretationLimits: [],
        }),
      },
    }),
  );

  assert.match(htmlFromRecord, /Lejla Profile/);
  assert.match(htmlFromRecord, /U ovom izvještaju nema dodatnih razvojnih blokatora za ovu sekciju/);
  assert.match(htmlFromRecord, /U ovom izvještaju nema dodatnih pitanja za ovu sekciju/);
  assert.match(htmlFromRecord, /U ovom izvještaju nema dodatnih ograničenja za ovu sekciju/);

  console.log("test-individual-development-profile-renderer: ok");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
