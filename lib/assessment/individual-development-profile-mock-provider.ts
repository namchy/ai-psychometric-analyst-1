import "server-only";

import {
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
  type IndividualDevelopmentOnboardingPlan,
  type IndividualDevelopmentOnboardingPlanStage,
  validateIndividualDevelopmentProfileSnapshot,
  type IndividualDevelopmentManagerWatchpoint,
  type IndividualDevelopmentOneOnOneGuidanceItem,
  type IndividualDevelopmentProfileSnapshot,
  type IndividualDevelopmentRisk,
} from "@/lib/assessment/individual-development-profile-contract";
import {
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE,
  INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION,
  type IndividualDevelopmentProfileInputSignal,
  type IndividualDevelopmentProfileInputSnapshot,
  type IndividualDevelopmentProfileInputSourceBlock,
  type IndividualDevelopmentProfileInputSourceStatus,
} from "@/lib/assessment/individual-development-profile-input";
import {
  IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_LABEL,
  IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_NARRATIVE_LABEL,
} from "@/lib/assessment/ipip-neo-120-labels";

export const INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATOR_TYPE = "mock" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATOR_VERSION =
  "individual_development_profile_mock_v1" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATED_AT =
  "2026-06-02T12:00:00.000Z" as const;

export type IndividualDevelopmentProfileMockProviderResult =
  | {
      ok: true;
      reportSnapshot: IndividualDevelopmentProfileSnapshot;
    }
  | {
      ok: false;
      reason: "invalid_input" | "validation_failed";
      errors: string[];
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalizeFixtureLabel(value: string): string {
  return value
    .replace(/\bUgodnost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_LABEL)
    .replace(/\bugodnost\b/g, IPIP_NEO_120_HR_CANONICAL_AGREEABLENESS_NARRATIVE_LABEL);
}

function getStatusLabel(status: IndividualDevelopmentProfileInputSourceStatus): string {
  switch (status) {
    case "available":
      return "dostupan";
    case "partial":
      return "djelimično dostupan";
    case "invalid":
      return "nevalidan";
    case "unavailable":
    default:
      return "nedostupan";
  }
}

function getSignalEntries(
  source: IndividualDevelopmentProfileInputSourceBlock,
): Array<IndividualDevelopmentProfileInputSignal | { code: string; label: string; signal: string }> {
  const relevantSignals = source.relevantSignals ?? [];
  const integratedSignals = source.integratedSignals ?? [];

  return [...relevantSignals, ...integratedSignals];
}

function getLeadingEntries(
  source: IndividualDevelopmentProfileInputSourceBlock,
  count: number,
): Array<IndividualDevelopmentProfileInputSignal | { code: string; label: string; signal: string }> {
  return getSignalEntries(source)
    .filter((entry) => isNonEmptyString(entry.label))
    .slice(0, count)
    .map((entry) => ({
      ...entry,
      label: canonicalizeFixtureLabel(entry.label),
    }));
}

function buildSourceStatusLimit(
  sourceName: string,
  status: IndividualDevelopmentProfileInputSourceStatus,
): string | null {
  if (status === "available") {
    return null;
  }

  if (status === "partial") {
    return `${sourceName} nalaz je djelimično dostupan i traži dodatnu provjeru prije praktičnih razvojnih zaključaka.`;
  }

  if (status === "invalid") {
    return `${sourceName} nalaz trenutno nije dovoljno pouzdan za čvršće razvojne zaključke i treba ga tretirati kao ograničenje inputa.`;
  }

  return `${sourceName} nalaz trenutno nije dostupan, pa se preporuke u toj zoni moraju potvrditi kroz razgovor i radni kontekst.`;
}

function buildSummaryHeadline(input: IndividualDevelopmentProfileInputSnapshot): string {
  const availableSources = [
    input.sourceSignals.personality,
    input.sourceSignals.motivation,
    input.sourceSignals.problemSolving,
    input.sourceSignals.composite,
  ].filter((source) => source.sourceStatus === "available").length;

  if (availableSources >= 3) {
    return "Razvojni profil daje dovoljno nalaza za strukturisan HR i menadžerski rad.";
  }

  if (availableSources >= 1) {
    return "Razvojni profil daje početne razvojne hipoteze, ali traži oprezno čitanje i dodatnu provjeru.";
  }

  return "Razvojni profil je trenutno ograničen i treba ga koristiti samo kao okvir za dodatna pitanja.";
}

function buildOverallPattern(input: IndividualDevelopmentProfileInputSnapshot): string {
  const availableAreas = [
    input.sourceSignals.personality.sourceStatus === "available" ? "načina saradnje" : null,
    input.sourceSignals.motivation.sourceStatus === "available" ? "izvora angažmana" : null,
    input.sourceSignals.problemSolving.sourceStatus === "available" ? "pristupa rješavanju problema" : null,
  ].filter(isNonEmptyString);

  if (availableAreas.length > 0) {
    return `Najkorisniji razvojni obrazac trenutno se gradi kroz povezano čitanje ${availableAreas.join(
      ", ",
    )}, uz provjeru u stvarnom radnom kontekstu.`;
  }

  return "Trenutni input ne daje dovoljno stabilnih individualnih nalaza za širu razvojnu interpretaciju, pa izvještaj ostaje usmjeren na provjeru konteksta, podrške i načina rada.";
}

function buildStrongestContributionSignals(
  input: IndividualDevelopmentProfileInputSnapshot,
): string[] {
  const personalityArea = getLeadingEntries(input.sourceSignals.personality, 1)[0]?.label;
  const motivationArea = getLeadingEntries(input.sourceSignals.motivation, 1)[0]?.label;
  const problemSolvingArea = getLeadingEntries(input.sourceSignals.problemSolving, 1)[0]?.label;
  const values = [
    personalityArea
      ? `Ličnosni nalaz usmjerava razvojni razgovor na područje "${personalityArea}".`
      : null,
    motivationArea
      ? `Motivacijski nalaz otvara pitanje kako područje "${motivationArea}" utiče na energiju i angažman.`
      : null,
    problemSolvingArea
      ? `Način rješavanja problema vrijedi provjeriti kroz područje "${problemSolvingArea}" i konkretne radne zadatke.`
      : null,
  ].filter(isNonEmptyString);

  if (values.length > 0) {
    return values.slice(0, 3);
  }

  return [
    "Najsigurniji naredni korak je strukturisano provjeriti kako osoba traži jasnoću, podršku i ritam povratne informacije u stvarnom radu.",
  ];
}

function buildMainSupportNeed(input: IndividualDevelopmentProfileInputSnapshot): string {
  const nonAvailableSource = [
    ["ličnosni", input.sourceSignals.personality.sourceStatus],
    ["motivacijski", input.sourceSignals.motivation.sourceStatus],
    ["problem-solving", input.sourceSignals.problemSolving.sourceStatus],
    ["kompozitni", input.sourceSignals.composite.sourceStatus],
  ].find((entry) => entry[1] !== "available");

  if (nonAvailableSource) {
    return `Glavna potreba u ovoj fazi je dodatno provjeriti ${nonAvailableSource[0]} područje, jer je trenutno ${getStatusLabel(
      nonAvailableSource[1] as IndividualDevelopmentProfileInputSourceStatus,
    )}.`;
  }

  return "Glavna potreba u ovoj fazi je rano uskladiti očekivanja, nivo autonomije i ritam povratne informacije kako bi se nalaz pretvorio u operativnu razvojnu podršku.";
}

function buildContributionPattern(input: IndividualDevelopmentProfileInputSnapshot) {
  const personalityAreas = getLeadingEntries(input.sourceSignals.personality, 2);
  const problemSolvingAreas = getLeadingEntries(input.sourceSignals.problemSolving, 1);
  const motivationAreas = getLeadingEntries(input.sourceSignals.motivation, 2);

  return {
    bestConditions:
      problemSolvingAreas.length > 0
        ? problemSolvingAreas.map(
            (entry) =>
              `Može doprinijeti najbolje kada su zadaci pregledni i kada se područje "${entry.label}" provjerava kroz konkretne primjere rada.`,
          )
        : [
            "Može doprinijeti najbolje kada su prioriteti, standard uspjeha i naredni koraci pregledni od početka saradnje.",
          ],
    collaborationConditions:
      personalityAreas.length > 0
        ? personalityAreas.map((entry) =>
            `U saradnji vrijedi provjeriti kako se u praksi vidi područje "${entry.label}".`
          )
        : [
            "Vrijedi rano dogovoriti ritam saradnje, način eskalacije pitanja i očekivani nivo samostalnosti.",
          ],
    supportPreferences:
      motivationAreas.length > 0
        ? motivationAreas.map((entry) =>
            `Podršku vrijedi povezati sa motivacijskim područjem "${entry.label}" i potvrditi šta zaista održava angažman.`
          )
        : [
            "Kako motivacijski nalaz nije potpuno dostupan, podršku treba graditi kroz kratke provjere šta osobi daje energiju, a šta je usporava.",
          ],
    roleShapingImplications: [
      "HR i menadžer treba da provjere koliko osobi pomažu jasan okvir, pregled očekivanja i rani radni primjeri prije širenja odgovornosti.",
      input.sourceSignals.composite.sourceStatus === "available"
        ? "Sažeti integrisani nalaz je dostupan i može pomoći u planiranju razvoja uz direktnu provjeru ponašanja."
        : "Kako sažeti integrisani nalaz nije potpuno dostupan, implikacije za oblikovanje uloge treba držati užim i više validirati kroz praksu.",
    ],
  };
}

function buildDevelopmentRisks(
  input: IndividualDevelopmentProfileInputSnapshot,
): IndividualDevelopmentRisk[] {
  const risks: IndividualDevelopmentRisk[] = [];
  const nonAvailableSources = [
    ["ličnosni", input.sourceSignals.personality.sourceStatus],
    ["motivacijski", input.sourceSignals.motivation.sourceStatus],
    ["problem-solving", input.sourceSignals.problemSolving.sourceStatus],
  ].filter((entry) => entry[1] !== "available");

  risks.push({
    possibleBlocker: "Neusklađen nivo jasnoće i podrške može usporiti rani razvojni zamah.",
    whyItMatters:
      "Kada očekivanja, autonomija i ritam povratne informacije nisu rano usklađeni, i koristan razvojni nalaz može ostati slabo iskorišten.",
    whatToCheck:
      "Provjeriti kako osoba reaguje na promjenu prioriteta, koliko traži pojašnjenje i kada se osjeća dovoljno sigurno da samostalno povuče naredni korak.",
    howToSupport:
      "Rano definisati kriterije uspjeha, vlasništvo nad zadatkom i kratke check-in tačke koje omogućavaju korekciju bez pretjerane kontrole.",
  });

  if (nonAvailableSources.length > 0) {
    risks.push({
      possibleBlocker: `Dio razvoja može biti pogrešno procijenjen jer su neki ključni izvori trenutno ${nonAvailableSources
        .map((entry) => getStatusLabel(entry[1] as IndividualDevelopmentProfileInputSourceStatus))
        .join(", ")}.`,
      whyItMatters:
        "Kada input nije potpun, postoji veći rizik da HR ili menadžer prerano generalizuju obrazac koji još nije dovoljno potvrđen.",
      whatToCheck:
        "U razgovoru ciljano dopuniti nedostajuće informacije o motivaciji, načinu rada i uslovima u kojima osoba lakše održava fokus i kvalitet.",
      howToSupport:
        "Zadržati preporuke na nivou razvojnih hipoteza i periodično ih revidirati čim se pojavi kvalitetniji individualni nalaz.",
    });
  }

  return risks;
}

function buildCommunicationGuidance(input: IndividualDevelopmentProfileInputSnapshot) {
  const personalityArea = getLeadingEntries(input.sourceSignals.personality, 1)[0]?.label ?? null;
  const problemSolvingArea = getLeadingEntries(input.sourceSignals.problemSolving, 1)[0]?.label ?? null;

  return {
    whatHelps: [
      "Najviše pomaže konkretan feedback koji jasno odvaja šta funkcioniše, šta traži korekciju i koji je sljedeći korak.",
      personalityArea
        ? `Lično-komunikacijsku hipotezu vrijedi provjeriti kroz područje "${personalityArea}" i konkretne primjere saradnje.`
        : "Kada ličnosni nalaz nije potpun, način komunikacije treba provjeravati kroz kratke iteracije i direktna pitanja.",
    ],
    whatToAvoid: [
      "Izbjegavati nejasne ili kontradiktorne poruke bez dogovora o tome šta je trenutno prioritet.",
      "Izbjegavati da se jedan razvojni nalaz pretvori u čvrstu etiketu ili zaključak o osobi.",
    ],
    howToPhraseFeedback: [
      "Feedback je najbolje dati kroz jasan opis ponašanja, uticaja i očekivane naredne prilagodbe.",
      problemSolvingArea
        ? `Vrijedi provjeriti kako osoba prima feedback kada se razgovor naslanja na područje "${problemSolvingArea}".`
        : "Ako nalaz o rješavanju problema nije potpun, feedback treba ostati uz konkretne radne primjere umjesto šire procjene kapaciteta.",
    ],
    whatToClarify: [
      "Vrijedi razjasniti koliko autonomije osoba trenutno očekuje, kada treba tražiti podršku i kako izgleda dobar standard izvršenja.",
      "Korisno je unaprijed usaglasiti šta znači dovoljno dobar napredak u prvim sedmicama razvoja.",
    ],
  };
}

function buildMotivationGuidance(input: IndividualDevelopmentProfileInputSnapshot) {
  const motivationAreas = getLeadingEntries(input.sourceSignals.motivation, 2);

  if (motivationAreas.length > 0) {
    return {
      likelySourcesOfEnergy: motivationAreas.map(
        (entry) => `Mogući izvor energije za provjeru je područje "${entry.label}".`,
      ),
      likelySourcesOfDrain: [
        "Pad energije vrijedi provjeriti kada su očekivanja nejasna, smisao zadatka slabo objašnjen ili napredak nije vidljiv.",
      ],
      supportSignals: [
        "Korisno je povezati zadatke sa jasnim razlogom zašto su važni i kakav se doprinos od osobe očekuje.",
        "Vrijedi periodično provjeriti da li trenutni način podrške pojačava angažman ili više stvara pritisak nego jasnoću.",
      ],
      whatToValidate: motivationAreas.map(
        (entry) => `U razvojnom razgovoru provjeriti kako područje "${entry.label}" utiče na angažman u stvarnim radnim uslovima.`,
      ),
    };
  }

  return {
    likelySourcesOfEnergy: [
      "Motivacijski input nije dovoljno potpun, pa izvore energije treba otkrivati kroz konkretne primjere zadataka i radnih uslova.",
    ],
    likelySourcesOfDrain: [
      "Bez stabilnog motivacijskog nalaza posebno vrijedi paziti na nejasne prioritete, prenaglu promjenu očekivanja i slab osjećaj napretka.",
    ],
    supportSignals: [
      "Korisno je rano provjeriti šta osobi daje osjećaj smisla, kontrole i mjerljivog napretka.",
    ],
    whatToValidate: [
      "U prvih nekoliko razgovora direktno pitati koje vrste zadataka, autonomije i povratne informacije najviše pomažu angažmanu.",
    ],
  };
}

function buildOneOnOneGuidance(
  input: IndividualDevelopmentProfileInputSnapshot,
): IndividualDevelopmentOneOnOneGuidanceItem[] {
  const primaryArea =
    getLeadingEntries(input.sourceSignals.personality, 1)[0]?.label ??
    "Kako osoba traži jasnoću, podršku i prostor za samostalnost u radu.";

  return [
    {
      question: "Koji uslovi vam najviše pomažu da uhvatite ritam i osjećaj sigurnog napretka u radu?",
      whatToListenFor:
        "Da li osoba spontano traži strukturu, više autonomije, češći feedback ili jasniju sliku o tome kako izgleda dobar rezultat.",
      signalBeingChecked: `Radna hipoteza za provjeru: ${primaryArea}`,
      possibleFollowUp:
        "Možete li opisati situaciju u kojoj ste najbrže počeli doprinositi i šta je tada bilo posebno korisno?",
    },
    {
      question: "Šta vam najviše otežava da održite kvalitet i energiju kada se prioriteti promijene?",
      whatToListenFor:
        "Da li je glavni izazov nejasan kontekst, previše prekida, slab osjećaj smisla ili nedovoljno povratne informacije.",
      signalBeingChecked:
        "Kako osoba reaguje na promjenu očekivanja i gdje joj najviše treba razvojna podrška.",
      possibleFollowUp:
        "Koja vrsta podrške vam tada najviše pomaže da se vratite na jasan i koristan radni ritam?",
    },
  ];
}

function buildOnboardingStage(
  focus: string,
  managerActions: string[],
  feedbackGuidance: string[],
  riskSignals: string[],
): IndividualDevelopmentOnboardingPlanStage {
  return {
    focus,
    managerActions,
    feedbackGuidance,
    riskSignals,
  };
}

function buildOnboardingPlan(
  input: IndividualDevelopmentProfileInputSnapshot,
): IndividualDevelopmentOnboardingPlan {
  const hasComposite = input.sourceSignals.composite.sourceStatus === "available";
  const motivationArea = getLeadingEntries(input.sourceSignals.motivation, 1)[0]?.label ?? null;
  const personalityArea = getLeadingEntries(input.sourceSignals.personality, 1)[0]?.label ?? null;

  return {
    summary:
      "Onboarding plan prevodi individualne razvojne nalaze u HR/menadžerski 7 / 30 / 60 / 90 okvir bez dodatnog timskog konteksta kao preduvjeta.",
    first7Days: buildOnboardingStage(
      "U prvoj sedmici fokus je na jasnim očekivanjima, ritmu podrške i sigurnom početnom kontekstu rada.",
      [
        "Objasniti šta je trenutno prioritet, kako izgleda dobar početni rezultat i kojim kanalom osoba najbrže dobija pojašnjenje.",
        "Dogovoriti kratak ritam check-in razgovora kako nejasnoće ne bi ostale predugo otvorene.",
      ],
      [
        "Feedback držati kratak, konkretan i operativan, sa jasnim opisom šta već funkcioniše i šta je naredni korak.",
      ],
      [
        "Ako osoba i dalje djeluje nesigurno oko prioriteta ili standarda rada, onboarding okvir treba dodatno precizirati.",
      ],
    ),
    first30Days: buildOnboardingStage(
      "U prvih 30 dana fokus je na provjeri koliko osobi pomažu struktura, feedback ritam i pregledan osjećaj napretka.",
      [
        "Definisati očekivanja, kriterije uspjeha i ritam kratkih check-in razgovora od samog početka.",
        hasComposite
          ? "Koristiti sažeti integrisani nalaz samo kao pomoć za izbor pitanja i podrške, ne kao zamjenu za direktnu provjeru ponašanja."
          : "Kako sažeti integrisani nalaz nije potpuno dostupan, prve sedmice koristiti za prikupljanje konkretnih primjera načina rada i motivacije.",
      ],
      [
        "Vrijedi rano provjeriti da li osoba bolje reaguje na detaljniji okvir ili na jasne ciljeve uz više autonomije u izvršenju.",
      ],
      [
        "Ako se napredak vidi samo kada menadžer stalno dodatno objašnjava kontekst, podršku treba strukturirati preglednije.",
      ],
    ),
    days31To60: buildOnboardingStage(
      "Između 31. i 60. dana fokus je na širenju odgovornosti i provjeri koliko trenutni model podrške ostaje koristan.",
      [
        "Provjeriti kako osoba reaguje na veći nivo samostalnosti i da li trenutni model podrške ostaje koristan.",
        "Pregledati koje vrste zadataka, feedbacka i strukture ubrzavaju razvoj, a koje ga usporavaju.",
      ],
      [
        motivationArea
          ? `Tokom ove faze vrijedi vezati feedback i prioritete za motivacijsko područje "${motivationArea}".`
          : "Tokom ove faze vrijedi posebno pitati koji zadaci daju osjećaj smisla i vidljivog doprinosa.",
      ],
      [
        "Ako osoba održava kvalitet samo kada su zadaci vrlo usko strukturirani, menadžer treba sporije širiti autonomiju.",
      ],
    ),
    days61To90: buildOnboardingStage(
      "Između 61. i 90. dana fokus je na učvršćivanju vlasništva nad ulogom i sužavanju razvojnih hipoteza na ono što se zaista pokazalo u radu.",
      [
        "Revidirati početne razvojne hipoteze i zadržati samo one koje su potvrđene kroz radni kontekst.",
        "Dogovoriti naredni razvojni fokus na osnovu opaženih obrazaca, ne samo početne radne hipoteze.",
      ],
      [
        personalityArea
          ? `Vrijedi dati feedback i o tome kako se u radu vidi područje "${personalityArea}".`
          : "Tokom ove faze feedback treba povezati sa opaženim obrascima saradnje, ne samo sa početnom procjenom.",
      ],
      [
        "Ako se i dalje vide isti zastoji oko jasnoće, saradnje ili angažmana, onboarding plan treba prevesti u konkretniji razvojni plan.",
      ],
    ),
    managerCheckpoints: [
      "Na kraju svake faze provjeriti da li su očekivanja, način saradnje i feedback ritam ostali dovoljno jasni i korisni.",
      "Potvrditi da se preporuke iz izvještaja koriste kao razvojne hipoteze, a ne kao čvrste etikete o osobi.",
    ],
    watchouts: [
      "Ne pretvarati onboarding plan u procjenu podobnosti, nego u okvir za podršku i provjeru razvoja.",
      "Ako se razvojna hipoteza ne potvrdi u stvarnom radu, prilagoditi plan na osnovu opaženog konteksta umjesto insistiranja na početnoj pretpostavci.",
    ],
  };
}

function buildManagerWatchpoints(
  input: IndividualDevelopmentProfileInputSnapshot,
): IndividualDevelopmentManagerWatchpoint[] {
  const watchpoints: IndividualDevelopmentManagerWatchpoint[] = [
    {
      watchpoint: "Rani razvojni nalaz može ostati nedovoljno iskorišten ako su očekivanja i podrška previše implicitni.",
      whyItMatters:
        "Osoba može djelovati tiše ili sporije nego što realno jeste kada standard rada, prioritet i način donošenja odluka nisu dovoljno razjašnjeni.",
      earlySignal:
        "Traži dodatna pojašnjenja, odgađa odluku bez jasnog okvira ili djeluje opreznije nego što situacija traži.",
      suggestedManagerResponse:
        "Skratiti nejasnoću kroz jasan dogovor o cilju, nivou autonomije i prvoj mjeri napretka koju treba pratiti.",
    },
  ];

  if (input.sourceSignals.motivation.sourceStatus !== "available") {
    watchpoints.push({
      watchpoint: "Motivacijski nalaz nije potpuno stabilan, pa angažman treba pratiti kroz praksu umjesto pretpostavke.",
      whyItMatters:
        "Bez dovoljno dobrog motivacijskog inputa lako je pogrešno pripisati pad energije karakteristici osobe umjesto uslovima rada.",
      earlySignal:
        "Angažman varira zavisno od tipa zadatka, smisla koji osoba vidi u radu i količine strukture koju dobija.",
      suggestedManagerResponse:
        "U redovnim razgovorima pitati šta trenutno pomaže angažmanu i koje uslove rada treba prilagoditi prije šire interpretacije.",
    });
  }

  return watchpoints;
}

function buildInterpretationLimits(input: IndividualDevelopmentProfileInputSnapshot): string[] {
  const limits = [
    "Izvještaj koristi sažete razvojne nalaze i ne zamjenjuje razgovor, opažanje rada niti menadžersku procjenu.",
    "Preporuke treba tretirati kao radne hipoteze koje se potvrđuju kroz onboarding i konkretne situacije.",
  ];
  const sourceStatusLimits = [
    buildSourceStatusLimit("Ličnosni", input.sourceSignals.personality.sourceStatus),
    buildSourceStatusLimit("Motivacijski", input.sourceSignals.motivation.sourceStatus),
    buildSourceStatusLimit("Problem-solving", input.sourceSignals.problemSolving.sourceStatus),
    buildSourceStatusLimit("Kompozitni", input.sourceSignals.composite.sourceStatus),
  ].filter(isNonEmptyString);

  return [...limits, ...sourceStatusLimits];
}

export function generateIndividualDevelopmentProfileWithMock(
  inputSnapshot: IndividualDevelopmentProfileInputSnapshot,
): IndividualDevelopmentProfileMockProviderResult {
  if (
    inputSnapshot.inputType !== INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_TYPE ||
    inputSnapshot.inputVersion !== INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION
  ) {
    return {
      ok: false,
      reason: "invalid_input",
      errors: [
        `Expected ${INDIVIDUAL_DEVELOPMENT_PROFILE_INPUT_VERSION} input snapshot for Individual Development Profile mock generation.`,
      ],
    };
  }

  const reportSnapshot: IndividualDevelopmentProfileSnapshot = {
    reportType: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_TYPE,
    reportVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_VERSION,
    locale: inputSnapshot.locale,
    audience: INDIVIDUAL_DEVELOPMENT_PROFILE_REPORT_AUDIENCE,
    developmentSummary: {
      headline: buildSummaryHeadline(inputSnapshot),
      overallPattern: buildOverallPattern(inputSnapshot),
      strongestContributionSignals: buildStrongestContributionSignals(inputSnapshot),
      mainSupportNeed: buildMainSupportNeed(inputSnapshot),
      usageNote:
        "Ovaj izvještaj je razvojni HR radni dokument i nalaze treba potvrditi kroz razgovor, onboarding i stvarni radni kontekst.",
    },
    contributionPattern: buildContributionPattern(inputSnapshot),
    developmentRisks: buildDevelopmentRisks(inputSnapshot),
    communicationAndFeedbackGuidance: buildCommunicationGuidance(inputSnapshot),
    motivationAndEnergyGuidance: buildMotivationGuidance(inputSnapshot),
    oneOnOneGuidance: buildOneOnOneGuidance(inputSnapshot),
    onboardingPlan: buildOnboardingPlan(inputSnapshot),
    managerWatchpoints: buildManagerWatchpoints(inputSnapshot),
    interpretationLimits: buildInterpretationLimits(inputSnapshot),
    metadata: {
      generatedAt: INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATED_AT,
      generatorType: INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATOR_TYPE,
      generatorVersion: INDIVIDUAL_DEVELOPMENT_PROFILE_MOCK_GENERATOR_VERSION,
      inputVersion: inputSnapshot.inputVersion,
    },
  };

  const validation = validateIndividualDevelopmentProfileSnapshot(reportSnapshot);

  if (!validation.ok) {
    return {
      ok: false,
      reason: "validation_failed",
      errors: validation.errors,
    };
  }

  return {
    ok: true,
    reportSnapshot: validation.value,
  };
}
