import "server-only";

import type { CompositeHrInputSnapshot } from "@/lib/assessment/composite-input";
import {
  COMPOSITE_HR_REPORT_AUDIENCE,
  COMPOSITE_HR_REPORT_CONTRACT_VERSION,
  COMPOSITE_HR_REPORT_SOURCE_TYPE,
  COMPOSITE_HR_REPORT_TYPE,
  formatCompositeHrReportValidationErrors,
  validateCompositeHrReportSnapshot,
  type CompositeHrReportEvidence,
  type CompositeHrReportSnapshot,
} from "@/lib/assessment/composite-hr-report-contract";

export const COMPOSITE_HR_REPORT_MOCK_PROVIDER = "mock" as const;
export const COMPOSITE_HR_REPORT_MOCK_PROVIDER_VERSION = "v1" as const;

function buildPersonalityEvidence(input: CompositeHrInputSnapshot): CompositeHrReportEvidence[] {
  const ipip = input.deterministicInputs.ipip;
  const highest = ipip.summarySignals.highestDomains[0] ?? ipip.summarySignals.rankedDomains[0] ?? null;
  const lowest =
    ipip.summarySignals.lowestDomains[0] ??
    ipip.summarySignals.rankedDomains[ipip.summarySignals.rankedDomains.length - 1] ??
    null;
  const evidence: CompositeHrReportEvidence[] = [];

  if (highest) {
    evidence.push({
      testSlug: ipip.testSlug,
      label: "Najizrazeniji domen licnosti",
      value: highest,
    });
  }

  if (lowest) {
    evidence.push({
      testSlug: ipip.testSlug,
      label: "Najnizi domen licnosti",
      value: lowest,
    });
  }

  return evidence;
}

function buildCognitiveEvidence(input: CompositeHrInputSnapshot): CompositeHrReportEvidence[] {
  const safran = input.deterministicInputs.safran;

  return [
    {
      testSlug: safran.testSlug,
      label: "Ukupni kognitivni rezultat",
      value: String(safran.overall.rawScore),
    },
    {
      testSlug: safran.testSlug,
      label: "Najizrazeniji kognitivni domen",
      value: safran.summarySignals.strongestDomain ?? "nema jasnog izdvajanja",
    },
  ];
}

function buildMotivationEvidence(input: CompositeHrInputSnapshot): CompositeHrReportEvidence[] {
  const mwms = input.deterministicInputs.mwms;
  const dominant = mwms.summarySignals.dominantDrivers[0] ?? null;
  const lower = mwms.summarySignals.lowerDrivers[0] ?? null;
  const evidence: CompositeHrReportEvidence[] = [];

  if (dominant) {
    evidence.push({
      testSlug: mwms.testSlug,
      label: "Dominantan motivacijski driver",
      value: dominant,
    });
  }

  if (lower) {
    evidence.push({
      testSlug: mwms.testSlug,
      label: "Nizi motivacijski driver",
      value: lower,
    });
  }

  return evidence;
}

export function generateMockCompositeHrReport(
  input: CompositeHrInputSnapshot,
): CompositeHrReportSnapshot {
  const report: CompositeHrReportSnapshot = {
    contractVersion: COMPOSITE_HR_REPORT_CONTRACT_VERSION,
    reportType: COMPOSITE_HR_REPORT_TYPE,
    audience: COMPOSITE_HR_REPORT_AUDIENCE,
    sourceType: COMPOSITE_HR_REPORT_SOURCE_TYPE,
    locale: input.locale,
    generatedFor: {
      organizationId: input.generatedFor.organizationId,
      participantId: input.generatedFor.participantId,
      assessmentAssignmentId: input.generatedFor.assessmentAssignmentId,
    },
    source: {
      inputContractVersion: input.contractVersion,
      sourceAttemptIds: input.sourceAttempts.map((attempt) => attempt.attemptId),
      testSlugs: input.coverage.completedTestSlugs.length > 0
        ? [...input.coverage.completedTestSlugs]
        : input.sourceAttempts.map((attempt) => attempt.testSlug),
    },
    summary: {
      headline:
        "Profil objedinjuje ponasajne, motivacijske i kognitivne signale za strukturisano HR citanje.",
      profileOverview:
        "Ovaj pregled koristi deterministic rezultate kao osnovu za HR interpretaciju, intervju i onboarding planiranje. Signal treba koristiti kao hipotezu za provjeru kroz razgovor i radne primjere, a ne kao automatski zakljucak.",
      keyStrengths: [
        "Profil pokazuje vise izvora signala koje je moguce provjeravati kroz isti strukturisani razgovor.",
        "Deterministicki input jasno cuva trag do linked attemptova i pojedinacnih instrumenata.",
        "Motivacijski i kognitivni obrasci mogu pomoci u planiranju uvodjenja u ulogu i menadzerske podrske.",
      ],
      watchouts: [
        "Niti jedan pojedinacni signal ne treba citati izolovano od konteksta uloge i iskustva.",
        "Najkorisnije je dodatno provjeriti konkretne primjere ponasanja i nacin rada pod pritiskom.",
        "Kognitivni i motivacijski signali ne zamjenjuju razgovor o realnim zadacima i radnim navikama.",
      ],
    },
    integratedSignals: [
      {
        id: "personality-pattern",
        title: "Ponasajni obrazac za provjeru",
        body:
          "Najizrazeniji i nizi domeni licnosti mogu pomoci HR timu da strukturise pitanja o saradnji, ritmu rada i nacinu donosenja odluka u stvarnim situacijama.",
        evidence: buildPersonalityEvidence(input),
      },
      {
        id: "cognitive-pattern",
        title: "Kognitivni signal za radne zadatke",
        body:
          "Kognitivni rezultat treba koristiti za izbor odgovarajucih provjera nacina razmisljanja, posebno kada uloga trazi promjenu izmedju verbalnih, vizuelnih i brojcanih problema.",
        evidence: buildCognitiveEvidence(input),
      },
      {
        id: "motivation-pattern",
        title: "Motivacijski obrazac za podrsku i angazman",
        body:
          "Motivacijski profil je koristan za procjenu uslova u kojima osoba lakse odrzava energiju, odgovornost i kvalitet saradnje tokom uvodjenja u posao.",
        evidence: buildMotivationEvidence(input),
      },
    ],
    interviewGuidance: {
      focusAreas: [
        {
          title: "Provjera radnih primjera",
          rationale:
            "Kombinacija signala je najkorisnija kada HR dobije konkretne primjere ponasanja, nacina ucenja i donosenja odluka iz prethodnih situacija.",
          questions: [
            "Koji primjer najbolje pokazuje kako strukturisete rad kada imate vise paralelnih zahtjeva?",
            "Kako provjeravate da ste dobro razumjeli zadatak prije nego sto donesete odluku ili predlozite rjesenje?",
          ],
        },
        {
          title: "Provjera motivacijskih uslova",
          rationale:
            "Motivacijski signali su najkorisniji kada se provjeri u kojim uslovima osoba lakse odrzava kvalitet, inicijativu i odgovornost.",
          questions: [
            "U kakvom okruzenju vam je najlakse odrzati fokus i kvalitet rada kroz duzi period?",
            "Sta vam najvise pomaze da ostanete angazovani kada zadatak postane rutinski ili administrativan?",
          ],
        },
        {
          title: "Provjera ucenja i adaptacije",
          rationale:
            "Kognitivni i ponasajni signali zajedno pomazu da se procijeni kako osoba prilagodjava pristup kada se promijeni format problema ili nacin saradnje.",
          questions: [
            "Kako prilagodite pristup kada shvatite da prvi nacin rjesavanja problema ne daje rezultat?",
            "Mozete li opisati situaciju u kojoj ste morali brzo nauciti novi proces i prenijeti ga u praksu?",
          ],
        },
      ],
    },
    onboardingGuidance: {
      managementTips: [
        "Rano uskladiti ocekivanja, ritam provjera i kriterije kvaliteta na konkretnim zadacima.",
        "Kombinovati jasne prioritete sa kratkim povratnim informacijama o nacinu rada, ne samo o ishodu.",
        "Za slozenije zadatke koristiti jasne kontrolne tacke kako bi se lakse pratila adaptacija i ucenje.",
      ],
      supportNeeds: [
        "Vrijedi provjeriti koliko osoba trazi strukturu, autonomiju i povratnu informaciju u prvim sedmicama rada.",
        "Ako uloga trazi brojcane ili analiticke provjere, korisno je rano vidjeti kako osoba verbalizuje logiku i provjeru tacnosti.",
        "Podrsku planirati kao kombinaciju jasnog konteksta, radnih primjera i prostora za pitanja tokom uvodjenja.",
      ],
    },
    limitations: [
      "Ovaj izvjestaj je HR pomoc za strukturisanu interpretaciju deterministic rezultata, ne automatska odluka.",
      "Signale treba citati zajedno sa iskustvom, intervjuom, referencama i zahtjevima konkretne uloge.",
      "Interpretacija ne mijenja score vrijednosti, bandove niti source attempts iz assessment ciklusa.",
    ],
    metadata: {
      provider: COMPOSITE_HR_REPORT_MOCK_PROVIDER,
      providerVersion: COMPOSITE_HR_REPORT_MOCK_PROVIDER_VERSION,
      generatedAt: new Date().toISOString(),
    },
  };

  const validation = validateCompositeHrReportSnapshot(report);

  if (!validation.ok) {
    throw new Error(
      `Mock composite HR report failed validation: ${formatCompositeHrReportValidationErrors(validation.errors)}`,
    );
  }

  return validation.value;
}
