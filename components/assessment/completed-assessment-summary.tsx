"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  PersonalityRadarChart,
  getPersonalityRadarSnapshot,
  type PersonalityRadarDomain,
} from "@/components/assessment/personality-radar-chart";
import type { DetailedReportV1 } from "@/lib/assessment/detailed-report-v1";
import type {
  IpipNeo120HrReportV1,
  IpipNeo120ParticipantReportV1,
} from "@/lib/assessment/ipip-neo-120-report-v1";
import type { AssessmentLocale } from "@/lib/assessment/locale";
import type { IpcHrReportV1, IpcParticipantReportV1 } from "@/lib/assessment/ipc-report-v1";
import type { CompletedAssessmentReportState } from "@/lib/assessment/reports";
import {
  formatDimensionLabel,
  formatIpcOctantLabel,
  formatIpcPrimaryDiscLabel,
  formatIpcStaticLabel,
  formatIpcStyleMetricLabel,
  formatMwmsScoreLabel,
  formatScoreLabel,
  getMwmsScoreWidth,
  getDimensionHelperLabel,
  isMwmsDimensionSet,
  normalizeIpcUiLocale,
} from "@/lib/assessment/result-display";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import {
  buildSafranCandidateInterpretation,
  getSafranInterpretationFallbackText,
  type SafranScoreKey,
} from "@/lib/assessment/safran-interpretation";
import { zodiak } from "@/lib/fonts";

type CompletedAssessmentSummaryProps = {
  completedAt?: string | null;
  locale?: AssessmentLocale | null;
  organizationName?: string | null;
  participantName?: string | null;
  testName?: string | null;
  results: CompletedAssessmentResults | null;
  reportState: CompletedAssessmentReportState | null;
};

type DimensionViewModel = {
  key: string;
  label: string;
  helperLabel: string | null;
  score: number;
  scoreLabel: string;
  averageScore: number;
  scoredQuestionCount: number;
  shortInterpretation: string;
  scoreWidth: number;
  rank: number;
  totalDimensions: number;
};

type DimensionDetailBlock = {
  heading:
    | "Kako se to kod tebe često pokazuje"
    | "Šta ti to može donositi kao prednost"
    | "Na šta vrijedi obratiti pažnju";
  body: string;
};

type ReportDimensionSnapshot = {
  dimension_code: string;
  summary: string;
  work_style: string;
  risks: string;
  development_focus: string;
};

type ReportRendererSelection =
  | { kind: "ipip_neo_120_hr_v1"; report: IpipNeo120HrReportV1 }
  | { kind: "ipip_neo_120_participant_v1"; report: IpipNeo120ParticipantReportV1 }
  | { kind: "big_five_participant_v1"; report: DetailedReportV1 }
  | { kind: "big_five_hr_v1"; report: DetailedReportV1 }
  | { kind: "ipc_participant_v1"; report: IpcParticipantReportV1 }
  | { kind: "ipc_hr_v1"; report: IpcHrReportV1 }
  | { kind: "shape_mismatch"; message: string }
  | { kind: "unsupported_signal"; message: string }
  | { kind: "none" };

function isBigFiveReport(report: unknown): report is DetailedReportV1 {
  return (
    Boolean(report) &&
    typeof report === "object" &&
    Array.isArray((report as DetailedReportV1).strengths) &&
    Array.isArray((report as DetailedReportV1).blind_spots) &&
    Array.isArray((report as DetailedReportV1).dimension_insights)
  );
}

function isIpipNeo120ParticipantReport(report: unknown): report is IpipNeo120ParticipantReportV1 {
  return (
    Boolean(report) &&
    typeof report === "object" &&
    (report as IpipNeo120ParticipantReportV1).contract_version ===
      "ipip_neo_120_participant_v1" &&
    Array.isArray((report as IpipNeo120ParticipantReportV1).domains)
  );
}

function isIpipNeo120HrReport(report: unknown): report is IpipNeo120HrReportV1 {
  return (
    Boolean(report) &&
    typeof report === "object" &&
    (report as IpipNeo120HrReportV1).contract_version === "ipip_neo_120_hr_v1" &&
    Array.isArray((report as IpipNeo120HrReportV1).domains) &&
    Array.isArray((report as IpipNeo120HrReportV1).workplace_signals)
  );
}

function isIpcParticipantReport(report: unknown): report is IpcParticipantReportV1 {
  return (
    Boolean(report) &&
    typeof report === "object" &&
    Array.isArray((report as IpcParticipantReportV1).strengths_in_collaboration) &&
    Array.isArray((report as IpcParticipantReportV1).watchouts)
  );
}

function isIpcHrReport(report: unknown): report is IpcHrReportV1 {
  return (
    Boolean(report) &&
    typeof report === "object" &&
    "communication_style" in (report as IpcHrReportV1) &&
    "collaboration_style" in (report as IpcHrReportV1) &&
    "leadership_and_influence" in (report as IpcHrReportV1)
  );
}

function renderReportFallbackCard(title: string, body: string) {
  return (
    <section className="results-report__section results-report__status results-report__panel card stack-sm">
      <div className="results-report__section-heading">
        <h3>{title}</h3>
      </div>
      <p className="results-report__section-body">{body}</p>
    </section>
  );
}

function selectReportRenderer(
  reportState: CompletedAssessmentReportState | null,
): ReportRendererSelection {
  if (reportState?.status !== "ready") {
    return { kind: "none" };
  }

  if (!reportState.reportRenderFormat) {
    return {
      kind: "unsupported_signal",
      message:
        "Ready report nema podržan report render format za trenutnu family/audience/version kombinaciju.",
    };
  }

  switch (reportState.reportRenderFormat) {
    case "ipip_neo_120_participant_v1":
      return isIpipNeo120ParticipantReport(reportState.report)
        ? { kind: "ipip_neo_120_participant_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava IPIP-NEO-120 participant izvještaj, ali snapshot shape ne odgovara tom rendereru.",
          };
    case "big_five_participant_v1":
      return isBigFiveReport(reportState.report)
        ? { kind: "big_five_participant_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava Big Five participant izvještaj, ali snapshot shape ne odgovara tom rendereru.",
          };
    case "big_five_hr_v1":
      if (isIpipNeo120HrReport(reportState.report)) {
        return { kind: "ipip_neo_120_hr_v1", report: reportState.report };
      }

      return isBigFiveReport(reportState.report)
        ? { kind: "big_five_hr_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava Big Five HR izvještaj, ali snapshot shape ne odgovara tom rendereru.",
          };
    case "ipc_participant_v1":
      return isIpcParticipantReport(reportState.report)
        ? { kind: "ipc_participant_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava IPC participant izvještaj, ali snapshot shape ne odgovara participant rendereru.",
          };
    case "ipc_hr_v1":
      return isIpcHrReport(reportState.report)
        ? { kind: "ipc_hr_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava IPC HR izvještaj, ali snapshot shape ne odgovara HR rendereru.",
          };
    default:
      return {
        kind: "unsupported_signal",
        message: "Ready report render format trenutno nema podržan renderer u ovoj verziji aplikacije.",
      };
  }
}

function getReportDimensionsByKey(
  report: DetailedReportV1 | null,
): Map<string, ReportDimensionSnapshot> {
  if (!report) {
    return new Map();
  }

  return report.dimension_insights.reduce((dimensionsByKey, dimension) => {
    if (!dimension.dimension_code || dimensionsByKey.has(dimension.dimension_code)) {
      return dimensionsByKey;
    }

    dimensionsByKey.set(dimension.dimension_code, dimension);
    return dimensionsByKey;
  }, new Map<string, ReportDimensionSnapshot>());
}

function formatUnscoredReason(
  reason: CompletedAssessmentResults["unscoredResponses"][number]["reason"],
): string {
  if (reason === "question_type_not_scoreable") {
    return "Zabilježeno, ali nije bodovano u trenutnom MVP modelu.";
  }

  return "Zabilježeno bez numeričkih scoring vrijednosti u trenutnim seed podacima.";
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getLeadSentence(text: string): string {
  return splitIntoSentences(text)[0] ?? text.trim();
}

function formatParticipantIpipDomainLabel(label: string): string {
  if (label === "Ugodnost") return "Spremnost na saradnju";
  if (label === "Neuroticizam") return "Emocionalna stabilnost";
  return label;
}

function formatParticipantIpipSubdimensionLabel(label: string): string {
  if (label === "Liberalizam") return "Preispitivanje stavova";
  if (label === "Saradljivost") return "Spremnost na dogovor";
  return label;
}

function getParticipantIpipDomainMicroSummary(domainCode: ParticipantIpipDomain["domain_code"]): string {
  switch (domainCode) {
    case "EXTRAVERSION":
      return "Socijalna energija i kontakt";
    case "AGREEABLENESS":
      return "Saradnja i povjerenje";
    case "CONSCIENTIOUSNESS":
      return "Organizovanost i pouzdanost";
    case "NEUROTICISM":
      return "Mirnoća pod pritiskom";
    case "OPENNESS_TO_EXPERIENCE":
      return "Fleksibilnost i nove ideje";
    default:
      return "";
  }
}

function getParticipantIpipBandAccentColor(band: ParticipantIpipDomainDisplayState["band"]): string {
  switch (band) {
    case "higher":
      return "#06d6a0";
    case "balanced":
      return "#ffd166";
    case "lower":
      return "#ef476f";
    default:
      return "#ffd166";
  }
}

function getParticipantIpipBandPillClassName(
  band: ParticipantIpipDomainDisplayState["band"],
): string {
  switch (band) {
    case "higher":
      return "border-[rgba(6,214,160,0.34)] bg-[rgba(6,214,160,0.12)] text-[#073b4c]";
    case "balanced":
      return "border-[rgba(255,209,102,0.42)] bg-[rgba(255,209,102,0.18)] text-[#073b4c]";
    case "lower":
      return "border-[rgba(239,71,111,0.34)] bg-[rgba(239,71,111,0.12)] text-[#073b4c]";
    default:
      return "border-[rgba(255,209,102,0.42)] bg-[rgba(255,209,102,0.18)] text-[#073b4c]";
  }
}

type ParticipantIpipDomain = IpipNeo120ParticipantReportV1["domains"][number];
type ParticipantIpipDomainDisplayState = {
  score: ParticipantIpipDomain["score"];
  band: ParticipantIpipDomain["band"];
};

const PARTICIPANT_IPIP_RADAR_DOMAIN_ORDER = [
  "EXTRAVERSION",
  "AGREEABLENESS",
  "CONSCIENTIOUSNESS",
  "NEUROTICISM",
  "OPENNESS_TO_EXPERIENCE",
] as const satisfies ReadonlyArray<ParticipantIpipDomain["domain_code"]>;

function getParticipantIpipDomainDisplayState(
  domain: Pick<ParticipantIpipDomain, "domain_code" | "score" | "band">,
): ParticipantIpipDomainDisplayState {
  if (domain.domain_code !== "NEUROTICISM") {
    return {
      score: domain.score,
      band: domain.band,
    };
  }

  return {
    score: 6 - domain.score,
    band:
      domain.band === "lower"
        ? "higher"
        : domain.band === "higher"
          ? "lower"
          : "balanced",
  };
}

function stripInsightLabel(text: string): string {
  return text.replace(/^[^:]{2,40}:\s*/, "").trim();
}

function ensureSentence(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function getAverageScore(rawScore: number, scoredQuestionCount: number): number {
  if (scoredQuestionCount === 0) {
    return 0;
  }

  return Math.round((rawScore / scoredQuestionCount) * 100) / 100;
}

function getParticipantIpipRadarDomains(
  report: IpipNeo120ParticipantReportV1,
): PersonalityRadarDomain[] {
  const domainsByCode = new Map(report.domains.map((domain) => [domain.domain_code, domain]));

  return PARTICIPANT_IPIP_RADAR_DOMAIN_ORDER.flatMap((domainCode) => {
    const domain = domainsByCode.get(domainCode);

    if (!domain) {
      return [];
    }

    return [
      {
        key: domain.domain_code,
        label: formatParticipantIpipDomainLabel(domain.label),
        score: getParticipantIpipDomainDisplayState(domain).score,
      },
    ];
  });
}

function formatParticipantIpipRadarLabel(domainCode: ParticipantIpipDomain["domain_code"]): string {
  switch (domainCode) {
    case "EXTRAVERSION":
      return "Ekstraverzija";
    case "AGREEABLENESS":
      return "Saradnja";
    case "CONSCIENTIOUSNESS":
      return "Savjesnost";
    case "NEUROTICISM":
      return "Stabilnost";
    case "OPENNESS_TO_EXPERIENCE":
      return "Otvorenost";
    default:
      return "";
  }
}

function getScoreBand(score: number): "high" | "mid" | "low" {
  if (score >= 3.67) {
    return "high";
  }

  if (score >= 2.34) {
    return "mid";
  }

  return "low";
}

function toSecondPersonSingular(text: string): string {
  return text
    .replace(/\bProfil pokazuje\b/gi, "Pokazuješ")
    .replace(/\bRezultat pokazuje\b/gi, "Tvoji rezultati pokazuju")
    .replace(/\bVjerovatno glavno uporište radnog stila:\s*/gi, "U tvom radnom stilu najviše se ističe ")
    .replace(/\bSekundarni signal:\s*/gi, "Dodatno se primjećuje da ")
    .replace(/\bje najuočljiviji signal u ovom pokušaju\b/gi, "se kod tebe najviše ističe")
    .replace(/\bje komparativno niže izražena i treba je čitati kao razvojnu oblast, a ne kao nedostatak\b/gi, "je kod tebe suptilnija i najkorisnije ju je gledati kao prostor za razvoj, a ne kao nedostatak")
    .replace(/\bje niže izražena u ovom obrascu odgovora, pa osoba može\b/gi, "je kod tebe manje izražena, pa možeš")
    .replace(/\bosoba može\b/gi, "možeš")
    .replace(/\bukupni profil\b/gi, "ukupan obrazac")
    .replace(/\bukupnog profila\b/gi, "tvog ukupnog obrasca")
    .replace(/\bprofil može\b/gi, "možeš")
    .replace(/\bu ovom obrascu odgovora\b/gi, "u svojim odgovorima")
    .replace(/\bu ovom završenom pokušaju\b/gi, "u svojim odgovorima")
    .replace(/\bu ovom pokušaju\b/gi, "u svojim odgovorima")
    .replace(/\bovom pokušaju\b/gi, "tvojim odgovorima")
    .replace(/\bprofil\b/gi, "obrazac")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTopInsightSentence(text: string): string {
  const cleaned = stripInsightLabel(getLeadSentence(toSecondPersonSingular(text)));
  const normalized = cleaned.replace(/\s+/g, " ").trim();
  const rewrites: Array<[RegExp, string]> = [
    [
      /^Često djeluje energizirano kroz socijalni kontakt i vidljivo uključivanje\.?$/i,
      "Kroz kontakt s drugima često se osjećaš energizirano i prirodno se uključuješ u dešavanja.",
    ],
    [
      /^Pokazuje uravnotežen spoj otvorenog angažmana i promišljenijeg tempa\.?$/i,
      "Pokazuješ dobar balans između otvorenog angažmana i promišljenijeg tempa.",
    ],
    [
      /^Može preferirati mirnije okruženje i odmjereniji interpersonalni ritam\.?$/i,
      "Često preferiraš mirnije okruženje i odmjereniji ritam u odnosima s drugima.",
    ],
    [
      /^Naglašava saradnju, taktičnost i kvalitet međuljudskih odnosa\.?$/i,
      "U odnosima s drugima često naglašavaš saradnju, taktičnost i dobar kvalitet odnosa.",
    ],
    [
      /^Može dobro balansirati iskrenost i saradnju, zavisno od konteksta\.?$/i,
      "Zavisno od situacije, dobro balansiraš iskrenost i saradnju.",
    ],
    [
      /^Može češće birati direktan izazov umjesto prilagođavanja ili konsenzusa\.?$/i,
      "Često biraš direktan pristup umjesto prilagođavanja ili traženja konsenzusa.",
    ],
    [
      /^Vjerovatno vrednuje strukturu, dosljednost i pouzdanu realizaciju\.?$/i,
      "Vjerovatno posebno vrednuješ strukturu, dosljednost i pouzdanu realizaciju.",
    ],
    [
      /^Može se prilagođavati između planiranja i fleksibilnosti kako se zahtjevi mijenjaju\.?$/i,
      "Kako se zahtjevi mijenjaju, znaš dobro prelaziti između planiranja i fleksibilnosti.",
    ],
    [
      /^Može raditi spontanije i imati korist od jasnije vanjske strukture\.?$/i,
      "Često radiš spontanije, a jasnija vanjska struktura ti može pomoći da lakše održiš ritam.",
    ],
    [
      /^Vjerovatno zadržava stabilnost i pod uobičajenim pritiskom\.?$/i,
      "U zahtjevnijim situacijama često ostaješ pribran i pod uobičajenim pritiskom.",
    ],
    [
      /^Pokazuje mješovit profil nošenja sa stresom koji može varirati po opterećenju ili kontekstu\.?$/i,
      "Na stres reaguješ različito, zavisno od opterećenja i konkretnog konteksta.",
    ],
    [
      /^Može intenzivnije doživljavati pritisak i imati korist od stabilnijih navika oporavka\.?$/i,
      "Pritisak možeš doživjeti intenzivnije, pa ti stabilnije navike oporavka mogu biti posebno korisne.",
    ],
    [
      /^Često je usmjeren prema idejama, istraživanju i konceptualnoj raznolikosti\.?$/i,
      "Često si usmjeren prema idejama, istraživanju i konceptualnoj raznolikosti.",
    ],
    [
      /^Može prihvatati nove ideje uz zadržavanje vrijednosti poznatih pristupa\.?$/i,
      "Otvoren si za nove ideje, ali i dalje vidiš vrijednost poznatih pristupa.",
    ],
    [
      /^Može preferirati praktičnu jasnoću umjesto apstraktnog istraživanja\.?$/i,
      "Češće preferiraš praktičnu jasnoću nego apstraktno istraživanje.",
    ],
  ];

  for (const [pattern, replacement] of rewrites) {
    if (pattern.test(normalized)) {
      return replacement;
    }
  }

  const directAddressPattern =
    /\b(ti|tvoj|tvom|tvoje|tvojim|pokazuješ|ostaješ|možeš|vrednuješ|preferiraš|naglašavaš|biraš|zadržavaš|reaguješ|pristupaš|prihvataš|radiš|osjećaš|znaš|si)\b/i;

  if (directAddressPattern.test(normalized)) {
    return ensureSentence(normalized);
  }

  if (/^u tvom\b/i.test(normalized) || /^tvoji\b/i.test(normalized)) {
    return ensureSentence(normalized);
  }

  return ensureSentence(`Kod tebe se posebno vidi da ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`);
}

function joinSentences(...sentences: Array<string | null | undefined>): string {
  return sentences
    .filter((sentence): sentence is string => Boolean(sentence))
    .map((sentence) => ensureSentence(sentence))
    .join(" ");
}

function getRankContext(dimension: DimensionViewModel): string {
  if (dimension.rank === 0) {
    return "Ovo je jedna od izraženijih niti tvog trenutnog obrasca i često daje ton načinu na koji prilaziš ljudima i zadacima";
  }

  if (dimension.rank === dimension.totalDimensions - 1) {
    return "Ova dimenzija je kod tebe tiša, pa je najkorisnije pratiti kako se uključuje onda kada situacija to zaista traži";
  }

  return "Ova dimenzija kod tebe djeluje kao stabilna sredina, pa često služi kao način da zadržiš ravnotežu između impulsa i zahtjeva situacije";
}

function getFallbackDimensionDetailBlocks(dimension: DimensionViewModel): DimensionDetailBlock[] {
  return [
    {
      heading: "Kako se to kod tebe često pokazuje",
      body: joinSentences(
        getRankContext(dimension),
        "Najčešće se vidi kroz sitne izbore u tempu, komunikaciji i načinu na koji odgovaraš na očekivanja oko sebe",
      ),
    },
    {
      heading: "Šta ti to može donositi kao prednost",
      body: "Kada ovu tendenciju koristiš svjesno, može ti pomoći da prirodnije pronađeš stil rada i saradnje koji ti stvarno odgovara umjesto da radiš protiv sebe.",
    },
    {
      heading: "Na šta vrijedi obratiti pažnju",
      body: "Vrijedi paziti da ovu stranu sebe ne uzmeš kao fiksno pravilo, jer najbolji rezultat obično dolazi kada zadržiš malo fleksibilnosti prema kontekstu i ljudima oko sebe.",
    },
  ];
}

function getDimensionDetailBlocks(dimension: DimensionViewModel): DimensionDetailBlock[] {
  const band = getScoreBand(dimension.averageScore);

  const contentByDimension: Record<string, Record<"high" | "mid" | "low", DimensionDetailBlock[]>> = {
    extraversion: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često ti prija kontakt s ljudima, brže se uključuješ u razgovor i lakše unosiš energiju u prostor. U grupi se obično ne povlačiš dugo, nego spontano zauzmeš svoje mjesto.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomoći u povezivanju, pokretanju saradnje i davanju zamaha timu kada treba probiti početnu rezervu. Ljudi te često lakše primijete i zapamte jer djeluješ pristupačno i angažovano.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da brzina uključivanja ne ostavi premalo prostora za tuđi ritam ili tiše signale u razgovoru. Nekad upravo kratka pauza i više slušanja pojačaju utisak koji već prirodno ostavljaš.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Kod tebe se često vidi dobar balans između društvene otvorenosti i potrebe za vlastitim tempom. Znaš biti prisutan i topao, ali bez potrebe da budeš u centru svake situacije.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "Ovakav raspon ti može pomoći da se prilagodiš različitim ljudima i okruženjima bez velikog napora. U saradnji možeš prirodno prebacivati između angažmana, slušanja i mirnijeg promišljanja.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto možeš djelovati i otvoreno i odmjereno, nekad drugi teže procijene kada ti treba više prostora, a kada više interakcije. Korisno je da to kažeš jasnije umjesto da pretpostaviš da će drugi sami prepoznati tvoj ritam.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često ti više odgovaraju mirniji razgovori, manji broj ljudi i situacije u kojima ne moraš stalno biti izložen. Obično se lakše otvaraš kada prvo osjetiš smisao, sigurnost ili dovoljno prostora za svoj tempo.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može davati smirenije prisustvo, bolju selektivnost u odnosima i više fokusa kada buka okoline raste. U radu često pomaže jer ne trošiš energiju na stalnu socijalnu aktivaciju nego je čuvaš za ono što ti je važno.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da potreba za mirom ne bude pogrešno pročitana kao nezainteresovanost ili distanca kada ti to zapravo nisi. Nekad je dovoljno da ranije pokažeš namjeru iako ne želiš odmah puno pričati.",
        },
      ],
    },
    agreeableness: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često paziš kako tvoje riječi utiču na druge i prirodno tražiš ton koji čuva odnos. U saradnji ti je važno da komunikacija ostane korektna, a da ljudi osjete poštovanje i dobru namjeru.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomagati u građenju povjerenja, smirivanju tenzije i lakšem povezivanju različitih ljudi. Često si neko uz koga saradnja djeluje sigurnije i manje iscrpljujuće.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da želja za skladom ne potisne ono što ti stvarno misliš ili trebaš reći. Tvoja obzirnost ima najveću vrijednost kada uz nju ostane i dovoljno jasna granica.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Kod tebe se često vidi balans između saradnje i direktnosti. Znaš biti obziran, ali i reći šta misliš kada procijeniš da je to korisnije od pukog slaganja.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi vjerodostojnost u odnosima jer ne djeluješ ni pretjerano mekan ni nepotrebno tvrd. U radu i dogovaranju često pomaže zato što možeš čuvati odnos, a ipak gurati stvari naprijed.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto se dobro krećeš između takta i iskrenosti, nekad možeš predugo vagati koji pristup je pravi. Korisno je da ranije odlučiš kada je važniji mir, a kada je važnija potpuna jasnoća.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često radije ideš direktno na suštinu nego da dugo ublažavaš poruku. Kada nešto ne vidiš kao dobro rješenje, vjerovatno ti je prirodnije da to jasno pokažeš nego da ostaneš u diplomatskoj neodređenosti.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi brzinu, odlučnost i veću spremnost da otvoriš teške teme koje drugi zaobilaze. U situacijama gdje treba presjeći maglu, tvoja direktnost može biti veoma korisna.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da jasnoća ne zazvuči oštrije nego što namjeravaš, posebno kada druga strana traži više takta nego argumenta. Nekad mala doza topline u formi pojača prijem tvoje poruke bez gubitka iskrenosti.",
        },
      ],
    },
    conscientiousness: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Vjerovatno ti prijaju struktura, red i osjećaj da stvari imaju jasan tok. Često misliš unaprijed, pratiš detalje i osjetiš unutrašnje zadovoljstvo kada obaveze držiš pod kontrolom.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomagati u pouzdanosti, dosljednosti i pretvaranju planova u stvarne rezultate. Ljudi te često mogu doživjeti kao nekoga na koga se može računati kada treba iznijeti posao do kraja.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da visoki kriteriji ne prerastu u nepotreban pritisak ili osjećaj da sve mora biti potpuno sređeno prije kretanja. Ponekad je dovoljno da nešto bude dovoljno dobro da bi moglo ići dalje.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Kod tebe se često vidi praktičan balans između plana i fleksibilnosti. Možeš se organizovati kada treba, ali obično ne djeluješ ukočeno ako se okolnosti usput promijene.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može biti korisno jer znaš održati osnovni red bez gušenja spontanosti. U radu i saradnji često znači da možeš pratiti dogovor, a ipak ostati dovoljno prilagodljiv kada realnost krene drugim putem.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto se dobro snalaziš između strukture i improvizacije, nekad možeš prekasno primijetiti da zadatak ipak traži više sistema nego što si mu dao. Korisno je ranije procijeniti kada je dosta fleksibilnosti, a kada treba čvršći okvir.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često ti više odgovara spontaniji tok nego strogo praćenje unaprijed zadatog reda. Možeš brzo reagovati, krenuti iz momenta i tražiti vlastiti način umjesto da se oslanjaš na rigidnu rutinu.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi svježinu, bržu prilagodbu i manje zakočenosti kada se okolnosti naglo mijenjaju. Posebno može pomoći tamo gdje treba uhvatiti momentum umjesto čekati savršen plan.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da spontanost ne pojede kontinuitet u stvarima koje traže praćenje, dovršavanje i dosljedan ritam. Često nije potreban veliki sistem, nego samo nekoliko vanjskih oslonaca koji te vraćaju na bitno.",
        },
      ],
    },
    emotional_stability: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "U zahtjevnijim situacijama često zadržiš prisebnost i ne prepuštaš se lako početnom talasu pritiska. Drugima možeš djelovati kao neko ko i pod opterećenjem ostaje dovoljno miran da razmišlja jasno.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomoći u donošenju odluka, smirenijoj komunikaciji i održavanju stabilnog ritma kada okolina postane napeta. Ljudi uz tebe često lakše ostaju fokusirani jer ne pojačavaš dodatno stres u prostoru.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da unutrašnju stabilnost ne pretvoriš u preveliku distancu prema vlastitim signalima umora ili tuđoj emocionalnoj reakciji. Nekad baš ono što te drži mirnim treba dopuniti malo otvorenijim pokazivanjem kako ti je.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Na pritisak vjerovatno reaguješ zavisno od konteksta, intenziteta i toga koliko imaš kontrole nad situacijom. Nekad ostaješ vrlo sabran, a nekad ti treba više vremena da vratiš unutrašnji mir.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "Ovakav raspon ti može pomoći jer nisi ni previše tvrd prema sebi ni potpuno preplavljen kada stvari postanu zahtjevne. Kada prepoznaš šta te stabilizuje, obično možeš prilično dobro vratiti fokus i ritam.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto tvoja reakcija zavisi od situacije, korisno je da ranije prepoznaš svoje okidače umjesto da ih primijetiš tek kad se nakupi pritisak. Mala, redovna briga o oporavku ovdje često pravi veću razliku nego veliki jednokratni potezi.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Pritisak možeš osjetiti brže i intenzivnije, posebno kada se nagomilaju neizvjesnost, očekivanja ili previše otvorenih frontova. To ne znači slabost, nego da tvoj sistem ranije registruje opterećenje i traži više regulacije.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "Kad to dobro upoznaš, može ti pomoći da ranije primijetiš šta nije održivo i da ozbiljnije shvatiš signale iscrpljenosti koje drugi ignorišu. Ta osjetljivost može te učiniti pažljivijim prema kvalitetu okruženja i načinu rada koji ti stvarno odgovara.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da intenzitet trenutnog osjećaja ne postane jedina slika cijele situacije. Korisno je unaprijed graditi male navike smirivanja i oslonce koji te vraćaju u osjećaj kontrole prije nego što stres preuzme tempo.",
        },
      ],
    },
    intellect: {
      high: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često te privuku nove ideje, drugačiji uglovi gledanja i prostor za istraživanje van očiglednog. Vjerovatno ti prija kada možeš povezivati teme, postavljati pitanja i širiti sliku prije nego što je zatvoriš.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi kreativniji pristup, lakše učenje i veću spremnost da vidiš rješenja koja nisu odmah standardna. U razgovoru i radu često pomaže jer unosiš svježinu, radoznalost i mentalnu širinu.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da širina interesa ne odvuče fokus sa onoga što trenutno treba privesti kraju. Nekad najbolji efekat dolazi kada radoznalost namjerno spojiš s vrlo konkretnim narednim korakom.",
        },
      ],
      mid: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Kod tebe se često vidi otvorenost za novo, ali bez potrebe da svaka stvar bude potpuno drugačija ili eksperimentalna. Možeš prihvatiti novu ideju kada vidiš smisao, a istovremeno zadržati poštovanje prema onome što već radi.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može pomagati da spajaš praktičnost i svježinu bez nepotrebnog idealizovanja novog ili starog. U saradnji je korisno jer često možeš biti most između onih koji guraju promjenu i onih kojima treba više sigurnosti.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Pošto vidiš vrijednost na obje strane, nekad možeš predugo ostati između istraživanja i odluke. Korisno je ranije odrediti kad je vrijeme za još pitanja, a kad je dovoljno jasno da kreneš dalje.",
        },
      ],
      low: [
        {
          heading: "Kako se to kod tebe često pokazuje",
          body: "Često ti više odgovara jasno, konkretno i primjenjivo nego dugo zadržavanje u apstraktnim idejama. Kada nešto procjenjuješ, vjerovatno ti je važno da brzo vidiš čemu služi i kako se može stvarno upotrijebiti.",
        },
        {
          heading: "Šta ti to može donositi kao prednost",
          body: "To ti može donositi praktičnost, manje rasipanja energije i bolji osjećaj za ono što je zaista izvedivo. U radu često pomaže jer brže spuštaš stvari na zemlju i tražiš upotrebljivo rješenje umjesto teorijskog sjaja.",
        },
        {
          heading: "Na šta vrijedi obratiti pažnju",
          body: "Vrijedi paziti da potreba za jasnoćom ne zatvori vrata ideji koja u početku još nema savršen oblik. Nekad mala doza istraživanja prije zaključka otvori rješenje koje bi inače ostalo neprimijećeno.",
        },
      ],
    },
  };

  return contentByDimension[dimension.key]?.[band] ?? getFallbackDimensionDetailBlocks(dimension);
}

function formatCompletedAt(value?: string | null): string {
  if (!value) {
    return "Nije dostupno";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nije dostupno";
  }

  const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}. ${month} ${year}, ${hours}:${minutes}`;
}

function getTopInsights(
  report: DetailedReportV1 | null,
  dimensions: DimensionViewModel[],
): string[] {
  if (!report) {
    return [];
  }

  const candidates = [
    ...report.strengths.map((item) => item.description),
    ...report.blind_spots.map((item) => item.description),
    ...report.development_recommendations.map((item) => item.description),
    ...report.dimension_insights.map((item) => item.work_style),
    ...dimensions.map((dimension) => dimension.shortInterpretation),
  ];

  const uniqueItems = candidates.filter((item, index) => {
    const normalized = item.trim().toLowerCase();
    return normalized.length > 0 && candidates.findIndex((candidate) => candidate.trim().toLowerCase() === normalized) === index;
  });

  return uniqueItems
    .slice(0, 3)
    .map((item) => formatTopInsightSentence(item));
}

function getConclusion(
  report: DetailedReportV1 | null,
  dimensions: DimensionViewModel[],
): string[] {
  if (!report) {
    return [];
  }

  const highest = dimensions[0];
  const lowest = dimensions[dimensions.length - 1];
  const summaryLead =
    splitIntoSentences(toSecondPersonSingular(report.summary.headline))[0] ?? null;
  const firstParagraph = [
    summaryLead,
    highest ? `${highest.label} se kod tebe najviše ističe.` : null,
    lowest
      ? `${lowest.label} je suptilnija i daje mirniji ton tvom ukupnom obrascu.`
      : null,
  ]
    .filter((sentence): sentence is string => Boolean(sentence))
    .join(" ");
  const secondParagraph = toSecondPersonSingular(report.summary.overview);

  return [firstParagraph, secondParagraph].filter(Boolean);
}

function getRecommendations(
  report: DetailedReportV1 | null,
): Array<{ title: string; description: string; action: string }> {
  if (!report) {
    return [];
  }

  return report.development_recommendations.slice(0, 3);
}

function formatRecommendation(item: {
  title: string;
  description: string;
  action: string;
}): { lead: string; body: string | null } {
  return {
    lead: item.title.trim().replace(/[.,;:!?]+$/, ""),
    body: `${item.description.trim()} ${item.action.trim()}`.trim(),
  };
}

function formatIpcNumericMetric(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}

function formatDiscreetScore(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}

function getResultScoreByDimension(
  results: CompletedAssessmentResults,
): Map<string, number> {
  return new Map(
    results.dimensions.map((dimension) => [dimension.dimension, dimension.rawScore]),
  );
}

function isSafranV1Results(results: CompletedAssessmentResults | null): boolean {
  return (
    results?.scoringMethod === "correct_answers" &&
    Boolean(results.derived?.safranV1) &&
    results.dimensions.some((dimension) => dimension.dimension === "cognitive_composite_v1")
  );
}

function getSafranScoreCards() {
  return [
    { key: "verbal_score", label: "Verbalni dio", emphasized: false },
    { key: "figural_score", label: "Figuralni dio", emphasized: false },
    { key: "numerical_series_score", label: "Numerički nizovi", emphasized: false },
    {
      key: "cognitive_composite_v1",
      label: "Ukupni rezultat",
      emphasized: true,
    },
  ] as const;
}

function getSafranDisplayScore(
  results: CompletedAssessmentResults | null,
): Partial<Record<SafranScoreKey, number | null>> {
  const derived = results?.derived?.safranV1;

  return {
    verbal_score: derived?.verbalScore ?? null,
    figural_score: derived?.figuralScore ?? null,
    numerical_series_score: derived?.numericalSeriesScore ?? null,
    cognitive_composite_v1: derived?.cognitiveCompositeV1 ?? null,
  };
}

function renderSafranInterpretationValue(
  score: number | null | undefined,
  maxPossible: number,
): string {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return `-- / ${maxPossible}`;
  }

  return `${formatDiscreetScore(score)} / ${maxPossible}`;
}

function SafranV1ResultsSummary({
  completedAt,
  organizationName,
  participantName,
  testName,
  results,
}: {
  completedAt?: string | null;
  organizationName?: string | null;
  participantName?: string | null;
  testName?: string | null;
  results: CompletedAssessmentResults | null;
}) {
  const scoreByDimension = results ? getResultScoreByDimension(results) : new Map<string, number>();
  const primaryMetaCount = [participantName, organizationName].filter(Boolean).length;
  const scoreCards = getSafranScoreCards();
  const interpretationScores = getSafranDisplayScore(results);
  const interpretation = buildSafranCandidateInterpretation(interpretationScores);
  const overallScore = interpretationScores.cognitive_composite_v1;
  const overallHasValue = typeof overallScore === "number" && Number.isFinite(overallScore);
  const overallIsOutOfRange = overallHasValue && (overallScore < 0 || overallScore > 45);
  const domainsByKey = new Map(interpretation.domains.map((domain) => [domain.scoreKey, domain]));
  const interpretationSections = [
    {
      scoreKey: "verbal_score" as const,
      domainLabelBs: "Verbalni dio",
      maxPossible: 18,
    },
    {
      scoreKey: "figural_score" as const,
      domainLabelBs: "Figuralni dio",
      maxPossible: 18,
    },
    {
      scoreKey: "numerical_series_score" as const,
      domainLabelBs: "Numerički nizovi",
      maxPossible: 9,
    },
  ];

  return (
    <div className="results-report results-report--safran stack-md">
      <section className="results-report__hero">
        <div className="results-report__hero-copy">
          <p className="results-report__eyebrow">Rezultati procjene</p>
          <h2>{testName ?? "SAFRAN"}</h2>
          <p className="results-report__section-body">
            Rezultati su prikazani kroz sirove skorove i kratko tumačenje unutar ove procjene.
          </p>

          <div className="results-report__hero-meta-wrap">
            <dl className="results-report__hero-meta">
              {participantName ? (
                <div className={primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"}>
                  <dt>Korisnik</dt>
                  <dd>{participantName}</dd>
                </div>
              ) : null}
              {organizationName ? (
                <div className={primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"}>
                  <dt>Organizacija</dt>
                  <dd>{organizationName}</dd>
                </div>
              ) : null}
              <div className="results-report__hero-meta-item results-report__hero-meta-item--wide">
                <dt>Završeno</dt>
                <dd>{formatCompletedAt(completedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {!results ? (
        <section className="results-report__section results-report__status results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Rezultati trenutno nisu dostupni</h3>
          </div>
          <p className="results-report__section-body">
            Pokušaj je završen, ali SAFRAN skorovi trenutno nisu dostupni za prikaz.
          </p>
        </section>
      ) : (
        <>
          <section className="results-report__section results-report__section--overview results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Tvoji rezultati</h3>
            </div>

            <ol className="results-score-overview" aria-label="SAFRAN skorovi">
              {scoreCards.map((scoreCard) => (
                <li
                  key={scoreCard.key}
                  className={`results-score-overview__item${
                    scoreCard.emphasized ? " results-score-overview__item--emphasized" : ""
                  }`}
                >
                  <div className="results-score-overview__header">
                    <strong>{scoreCard.label}</strong>
                    <span>{formatDiscreetScore(scoreByDimension.get(scoreCard.key) ?? 0)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="results-report__section results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Kratko tumačenje</h3>
            </div>
            <p className="results-report__section-body">{interpretation.introBs}</p>

            <div className="stack-sm">
              <article className="results-dimension-card">
                <div className="results-dimension-card__header">
                  <div className="results-dimension-card__title">
                    <h4>Ukupni rezultat</h4>
                  </div>
                  <div className="results-dimension-card__score">
                    <span className="results-dimension-card__score-value">
                      {renderSafranInterpretationValue(overallScore, 45)}
                    </span>
                  </div>
                </div>
                <p className="results-dimension-card__helper">
                  {interpretation.overall?.bandLabelBs ??
                    getSafranInterpretationFallbackText({
                      scoreKey: "cognitive_composite_v1",
                      reason: overallIsOutOfRange ? "invalid_range" : "missing",
                    })}
                </p>
                <p className="results-dimension-card__summary">
                  {interpretation.overall?.textBs ??
                    getSafranInterpretationFallbackText({
                      scoreKey: "cognitive_composite_v1",
                      reason: overallIsOutOfRange ? "invalid_range" : "missing",
                    })}
                </p>
              </article>

              {interpretationSections.map((section) => {
                const domain = domainsByKey.get(section.scoreKey);
                const score = interpretationScores[section.scoreKey];
                const hasValue = typeof score === "number" && Number.isFinite(score);
                const isOutOfRange =
                  hasValue && (score < 0 || score > section.maxPossible);
                const fallbackText = getSafranInterpretationFallbackText({
                  scoreKey: section.scoreKey,
                  reason: isOutOfRange ? "invalid_range" : "missing",
                });

                return (
                  <article key={section.scoreKey} className="results-dimension-card">
                    <div className="results-dimension-card__header">
                      <div className="results-dimension-card__title">
                        <h4>{section.domainLabelBs}</h4>
                      </div>
                      <div className="results-dimension-card__score">
                        <span className="results-dimension-card__score-value">
                          {renderSafranInterpretationValue(score, section.maxPossible)}
                        </span>
                      </div>
                    </div>
                    <p className="results-dimension-card__helper">
                      {domain?.bandLabelBs ?? fallbackText}
                    </p>
                    <p className="results-dimension-card__summary">
                      {domain?.textBs ?? fallbackText}
                    </p>
                  </article>
                );
              })}
            </div>

            {interpretation.relativeProfileBs ? (
              <p className="results-report__section-body">{interpretation.relativeProfileBs}</p>
            ) : null}
          </section>

          <section className="results-report__section results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Kako čitati ove rezultate</h3>
            </div>
            <ul className="results-insight-list">
              {interpretation.limitationsBs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function getVisualScoreWidth(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }

  const normalized = ((value - min) / (max - min)) * 100;
  return Math.min(100, Math.max(normalized, 0));
}

function formatNeoBandLabel(band: "lower" | "balanced" | "higher"): string {
  switch (band) {
    case "higher":
      return "Više izraženo";
    case "balanced":
      return "Uravnoteženo";
    default:
      return "Niže izraženo";
  }
}

function formatNeoHrBandLabel(band: "low" | "moderate" | "high"): string {
  switch (band) {
    case "high":
      return "Visoko izraženo";
    case "moderate":
      return "Umjereno izraženo";
    default:
      return "Niže izraženo";
  }
}

function getParticipantIpipFacetAccentColor(index: number): string {
  const palette = ["#06d6a0", "#118ab2", "#ffd166", "#ef476f", "#06d6a0", "#118ab2"];
  return palette[index % palette.length] ?? "#118ab2";
}

function IpipNeo120ScoreBar({
  label,
  score,
  min,
  max,
  fillColor,
}: {
  label: string;
  score: number;
  min: number;
  max: number;
  fillColor?: string;
}) {
  const width = getVisualScoreWidth(score, min, max);

  return (
    <div
      className="results-score-overview__bar"
      role="img"
      aria-label={`${label} skor ${formatDiscreetScore(score)}`}
    >
      <span style={{ width: `${Math.max(width, 10)}%`, backgroundColor: fillColor }} />
    </div>
  );
}

function IpipNeo120ParticipantReportSections({
  report,
}: {
  report: IpipNeo120ParticipantReportV1;
}) {
  const [activeDomainCode, setActiveDomainCode] = useState<string | null>(null);
  const domainGridRef = useRef<HTMLDivElement | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const scaleMin = report.meta.scale_hint.min;
  const scaleMax = report.meta.scale_hint.max;
  const hasDevelopmentRecommendations = report.development_recommendations.length > 0;
  const activeDomain =
    report.domains.find((domain) => domain.domain_code === activeDomainCode) ?? null;
  const activeDomainDisplayState = activeDomain
    ? getParticipantIpipDomainDisplayState(activeDomain)
    : null;
  const radarDomains = getParticipantIpipRadarDomains(report);
  const shouldRenderRadarSection = radarDomains.length === PARTICIPANT_IPIP_RADAR_DOMAIN_ORDER.length;
  const radarSnapshot = shouldRenderRadarSection
    ? getPersonalityRadarSnapshot(radarDomains)
    : null;
  const radarChartDomains = shouldRenderRadarSection
    ? radarDomains.map((domain) => ({
        ...domain,
        label: formatParticipantIpipRadarLabel(domain.key as ParticipantIpipDomain["domain_code"]),
      }))
    : [];
  const radarSnapshotRows = radarSnapshot
    ? [
        {
          title: "Dominantni domen",
          domain: radarSnapshot.highest,
          accent: "#155E75",
          glow: "rgba(21, 94, 117, 0.14)",
        },
        {
          title: "Drugi izraženi domen",
          domain: radarSnapshot.secondHighest,
          accent: "#6B7D3A",
          glow: "rgba(107, 125, 58, 0.14)",
        },
        {
          title: "Najmanje izražen domen",
          domain: radarSnapshot.lowest,
          accent: "#B7791F",
          glow: "rgba(183, 121, 31, 0.14)",
        },
      ].filter(
        (
          item,
        ): item is {
          title: string;
          domain: PersonalityRadarDomain;
          accent: string;
          glow: string;
        } => item.domain !== null,
      )
    : [];

  useEffect(() => {
    if (!activeDomain || !detailPanelRef.current || typeof window === "undefined") {
      return;
    }

    const panelRect = detailPanelRef.current.getBoundingClientRect();
    const isInViewport =
      panelRect.top >= 0 && panelRect.bottom <= window.innerHeight;

    if (!isInViewport) {
      detailPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeDomain]);

  const handleCloseDomainDetails = () => {
    setActiveDomainCode(null);

    requestAnimationFrame(() => {
      domainGridRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <div className="results-report__closing stack-md">
      {shouldRenderRadarSection ? (
        <section className="results-report__section results-report__panel card px-5 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
          <div className="results-report__section-heading">
            <h3 className="text-[0.95rem] font-bold tracking-[-0.02em] text-slate-900 sm:text-[1rem]">
              Sveobuhvatni pregled
            </h3>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-slate-500">
              Ovdje vidiš kako su pojedini domeni izraženi u tvom ukupnom profilu.
            </p>
          </div>

          <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:items-start lg:gap-x-14">
            <div className="mx-auto w-full max-w-[540px]">
              <PersonalityRadarChart domains={radarChartDomains} className="h-[304px] sm:h-[300px]" />
            </div>

            {radarSnapshotRows.length > 0 ? (
              <div className="rounded-[18px] border border-[rgba(21,94,117,0.12)] bg-[#F3F8F6] px-4 py-4 sm:px-5 lg:mt-6">
                <h4 className="text-[13.5px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#073b4c]">
                  Najizraženiji signali
                </h4>
                <div className="mt-3 divide-y divide-[rgba(148,163,184,0.22)]">
                  {radarSnapshotRows.map((row) => (
                    <div
                      key={`${row.title}-${row.domain.key}`}
                      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[4px] h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.accent, boxShadow: `0 0 0 4px ${row.glow}` }}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          {row.title}
                        </p>
                        <p className="mt-1 text-[14px] font-medium leading-[1.45] text-slate-700">
                          {row.domain.label} · {formatDiscreetScore(Number(row.domain.score))}/5
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="results-report__section results-report__panel stack-sm rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 pt-[22px] pb-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)] sm:px-8 sm:pt-[28px] sm:pb-[30px]">
        <div className="h-[3px] w-[72px] rounded-full bg-[linear-gradient(90deg,#0f766e,#0e7490)] mb-[18px] sm:w-[88px]" />
        <div className="results-report__section-heading">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Sažetak
          </p>
          <h3
            className={`${zodiak.className} mb-5 max-w-[720px] text-[clamp(1.65rem,2.4vw,2.05rem)] font-bold leading-[1.08] tracking-[-0.04em] text-slate-900`}
          >
            {report.summary.headline}
          </h3>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className="inline-flex items-center rounded-full px-[11px] py-[7px] text-[12.5px] font-bold leading-none tracking-[-0.01em]"
            style={{
              background: "rgba(6, 214, 160, 0.12)",
              border: "1px solid rgba(6, 214, 160, 0.34)",
              color: "#073b4c",
            }}
          >
            Visoka savjesnost
          </span>
          <span
            className="inline-flex items-center rounded-full px-[11px] py-[7px] text-[12.5px] font-bold leading-none tracking-[-0.01em]"
            style={{
              background: "rgba(17, 138, 178, 0.12)",
              border: "1px solid rgba(17, 138, 178, 0.34)",
              color: "#073b4c",
            }}
          >
            Visoka energija
          </span>
          <span
            className="inline-flex items-center rounded-full px-[11px] py-[7px] text-[12.5px] font-bold leading-none tracking-[-0.01em]"
            style={{
              background: "rgba(255, 209, 102, 0.18)",
              border: "1px solid rgba(255, 209, 102, 0.42)",
              color: "#073b4c",
            }}
          >
            Stabilan emocionalni profil
          </span>
        </div>
        <p className="mt-0 max-w-[760px] text-[15px] leading-[1.75] text-slate-700">
          {report.summary.overview}
        </p>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Ključni obrasci u profilu</h3>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="min-h-[190px] rounded-[20px] border border-slate-200/85 bg-slate-50/70 p-5 shadow-none">
            <div className="mb-4 h-1 w-12 rounded-full" style={{ background: "#06d6a0" }} />
            <h4 className="text-[15px] font-extrabold leading-[1.25] tracking-[-0.01em] text-slate-950">
              Organizovana inicijativa
            </h4>
            <p className="mt-2.5 text-[14px] leading-[1.65] text-slate-600">
              Kombinacija vrlo visoke Savjesnosti i vrlo visoke Ekstraverzije sugeriše da
              najčešće ne ostaješ pasivan kada postoji cilj. Vjerovatno ti odgovara kada
              možeš preuzeti ritam, pokrenuti stvari i istovremeno zadržati strukturu.
            </p>
          </div>

          <div className="min-h-[190px] rounded-[20px] border border-slate-200/85 bg-slate-50/70 p-5 shadow-none">
            <div className="mb-4 h-1 w-12 rounded-full" style={{ background: "#118ab2" }} />
            <h4 className="text-[15px] font-extrabold leading-[1.25] tracking-[-0.01em] text-slate-950">
              Stabilnost pod pritiskom
            </h4>
            <p className="mt-2.5 text-[14px] leading-[1.65] text-slate-600">
              Vrlo niska emocionalna reaktivnost ukazuje da u stresnim situacijama
              najčešće ne reaguješ naglo. To može biti važna prednost u odgovornim ili
              dinamičnim okruženjima, posebno kada drugi očekuju miran ton i dosljednost.
            </p>
          </div>

          <div className="min-h-[190px] rounded-[20px] border border-slate-200/85 bg-slate-50/70 p-5 shadow-none">
            <div className="mb-4 h-1 w-12 rounded-full" style={{ background: "#ffd166" }} />
            <h4 className="text-[15px] font-extrabold leading-[1.25] tracking-[-0.01em] text-slate-950">
              Saradnja s jasnim standardima
            </h4>
            <p className="mt-2.5 text-[14px] leading-[1.65] text-slate-600">
              Visoka Spremnost na saradnju sugeriše korektan i otvoren odnos prema
              drugima. U kombinaciji s visokom Savjesnošću, može značiti da cijeniš
              dogovor, ali i očekuješ da se preuzete obaveze zaista ispune.
            </p>
          </div>

          <div className="min-h-[190px] rounded-[20px] border border-slate-200/85 bg-slate-50/70 p-5 shadow-none">
            <div className="mb-4 h-1 w-12 rounded-full" style={{ background: "#ef476f" }} />
            <h4 className="text-[15px] font-extrabold leading-[1.25] tracking-[-0.01em] text-slate-950">
              Praktična otvorenost
            </h4>
            <p className="mt-2.5 text-[14px] leading-[1.65] text-slate-600">
              Uravnotežena Otvorenost prema iskustvu sugeriše da nove ideje ne odbacuješ,
              ali ih vjerovatno procjenjuješ kroz korisnost i smisao. Najlakše prihvataš
              promjene kada vidiš kako doprinose cilju.
            </p>
          </div>
        </div>
      </section>

      <section className="results-report__section results-report__section--dimensions stack-sm">
        <div className="results-report__section-heading">
          <h3>Pregled domena</h3>
          <p className="results-report__section-note">
            Skala pokazuje koliko je svaki domen izražen u tvom profilu.
          </p>
        </div>

        <div ref={domainGridRef} className="mt-5 grid gap-4 md:grid-cols-4">
          {report.domains.map((domain, index) => {
            const domainDisplayLabel = formatParticipantIpipDomainLabel(domain.label);
            const domainDisplayState = getParticipantIpipDomainDisplayState(domain);
            const domainMicroSummary = getParticipantIpipDomainMicroSummary(domain.domain_code);
            const bandAccentColor = getParticipantIpipBandAccentColor(domainDisplayState.band);
            const bandPillClassName = getParticipantIpipBandPillClassName(domainDisplayState.band);
            const isActive = activeDomainCode === domain.domain_code;

            return (
              <div
                key={domain.domain_code}
                className={
                  index === 4
                    ? "md:col-start-2 md:col-span-2"
                    : "md:col-span-2"
                }
              >
                <div
                  className={`min-h-[132px] rounded-[22px] border border-slate-200/85 bg-white/95 p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.46)] ${
                    isActive ? "ring-2 ring-[#118ab2]/35 border-[#118ab2]/35 bg-white" : ""
                  }`}
                >
                  <div
                    className="mb-4 h-1 w-12 rounded-full"
                    style={{ background: bandAccentColor }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[14px] font-extrabold leading-[1.15] tracking-[-0.015em] text-slate-950">
                          {domainDisplayLabel}
                        </h4>
                        <p
                          className={`mt-2 inline-flex w-fit items-center rounded-full border px-2 py-1 text-[11px] font-bold leading-none ${bandPillClassName}`}
                        >
                          {formatNeoBandLabel(domainDisplayState.band)}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center rounded-full border border-slate-300/80 bg-slate-100/90 px-2 py-1 text-[12px] font-extrabold leading-none text-slate-900">
                        {formatDiscreetScore(domainDisplayState.score)}/{scaleMax}
                      </span>
                    </div>

                    <p className="mt-3 text-[12.5px] font-semibold leading-[1.35] text-slate-500">
                      {domainMicroSummary}
                    </p>

                    <div className="mt-3">
                      <IpipNeo120ScoreBar
                        label={domainDisplayLabel}
                        score={domainDisplayState.score}
                        min={scaleMin}
                        max={scaleMax}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-end">
                      <button
                        type="button"
                        className={
                          isActive
                            ? "inline-flex items-center rounded-full border border-[#ef476f]/45 bg-[rgba(239,71,111,0.10)] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#073b4c] transition-colors hover:border-[#ef476f]/70 hover:bg-[rgba(239,71,111,0.16)]"
                            : "inline-flex items-center rounded-full border border-[#118ab2]/45 bg-[rgba(17,138,178,0.10)] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#073b4c] transition-colors hover:border-[#118ab2]/70 hover:bg-[rgba(17,138,178,0.16)]"
                        }
                        onClick={() =>
                          isActive
                            ? handleCloseDomainDetails()
                            : setActiveDomainCode(domain.domain_code)
                        }
                      >
                        {isActive ? "Sakrij detalje ↑" : "Prikaži detalje ↓"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeDomain && activeDomainDisplayState ? (
          <div
            ref={detailPanelRef}
            className="mt-5 overflow-hidden rounded-[28px] border border-slate-200/85 bg-white/95 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)]"
          >
            <div className="h-[5px] w-full bg-[#118ab2]" />
            <div className="p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/75 pb-5">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                    OTVOREN DETALJ
                  </p>
                  <h4 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.03em] text-slate-950">
                    {formatParticipantIpipDomainLabel(activeDomain.label)}
                  </h4>
                  <p className="mt-2 inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-bold leading-none text-slate-500">
                    {formatNeoBandLabel(activeDomainDisplayState.band)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex shrink-0 items-center rounded-full border border-slate-300/80 bg-slate-100/90 px-3 py-1.5 text-[13px] font-extrabold leading-none text-slate-900">
                    {formatDiscreetScore(activeDomainDisplayState.score)}/{scaleMax}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-[#ef476f]/45 bg-[rgba(239,71,111,0.10)] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#073b4c] transition-colors hover:border-[#ef476f]/70 hover:bg-[rgba(239,71,111,0.16)]"
                    onClick={handleCloseDomainDetails}
                  >
                    Sakrij detalje ↑
                  </button>
                </div>
              </div>

              <p className="mt-5 text-[15px] leading-[1.8] text-slate-600">
                {activeDomain.summary}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[18px] border border-[#06d6a0]/20 bg-[rgba(6,214,160,0.045)] p-4">
                  <div className="mb-4 h-1 w-12 rounded-full bg-[#06d6a0]" />
                  <h5 className="text-[13px] font-extrabold text-[#073b4c]">Snage</h5>
                  <ul className="mt-3 space-y-2">
                    {activeDomain.strengths.map((item) => (
                      <li key={item} className="text-[13.5px] leading-[1.6] text-slate-600">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[18px] border border-[#ffd166]/28 bg-[rgba(255,209,102,0.06)] p-4">
                  <div className="mb-4 h-1 w-12 rounded-full bg-[#ffd166]" />
                  <h5 className="text-[13px] font-extrabold text-[#073b4c]">Tačke opreza</h5>
                  <ul className="mt-3 space-y-2">
                    {activeDomain.watchouts.map((item) => (
                      <li key={item} className="text-[13.5px] leading-[1.6] text-slate-600">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {activeDomain.development_tip ? (
                  <div className="rounded-[18px] border border-[#118ab2]/20 bg-[rgba(17,138,178,0.045)] p-4 md:col-span-2">
                    <div className="mb-4 h-1 w-12 rounded-full bg-[#118ab2]" />
                    <h5 className="text-[13px] font-extrabold text-[#073b4c]">
                      Razvojni fokus
                    </h5>
                    <p className="mt-3 text-[13.5px] leading-[1.6] text-slate-600">
                      {activeDomain.development_tip}
                    </p>
                  </div>
                ) : null}
              </div>

              {activeDomain.subdimensions.length > 0 ? (
                <div className="mt-7 border-t border-slate-200/75 pt-6">
                  <h5 className="text-[16px] font-extrabold text-slate-950">Poddimenzije</h5>
                  <p className="mt-1 text-[13px] leading-[1.5] text-slate-500">
                    Poddimenzije pokazuju od čega se ovaj domen sastoji.
                  </p>
                  <ol className="mt-5 grid list-none items-start gap-3 md:grid-cols-2">
                    {activeDomain.subdimensions.map((subdimension, index) => {
                      const subdimensionDisplayLabel = formatParticipantIpipSubdimensionLabel(
                        subdimension.label,
                      );
                      const facetAccentColor = getParticipantIpipFacetAccentColor(index);
                      const facetDisplayState = {
                        score: subdimension.score,
                      };
                      const facetScorePercent =
                        ((facetDisplayState.score - scaleMin) / (scaleMax - scaleMin)) * 100;
                      const activeTick = Math.round(facetDisplayState.score);

                      return (
                        <li
                          key={subdimension.facet_code}
                          className="self-start rounded-[18px] border border-slate-200/80 bg-slate-50/55 p-4"
                        >
                          <div className="space-y-3">
                            <div
                              className="h-1 w-10 rounded-full"
                              style={{ backgroundColor: facetAccentColor }}
                            />
                            <h6 className="text-[14px] font-extrabold leading-[1.25] text-slate-950">
                              {subdimensionDisplayLabel}
                            </h6>
                            <p className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[12px] font-bold leading-none text-slate-500">
                              {formatNeoBandLabel(subdimension.band)}
                            </p>
                            <div className="mt-3">
                              <div className="relative h-2 rounded-full bg-slate-200/90">
                                <div
                                  className="absolute left-0 top-0 h-2 rounded-full bg-[#118ab2]"
                                  style={{ width: `${facetScorePercent}%` }}
                                />
                                <div
                                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#073b4c] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.55)]"
                                  style={{ left: `${facetScorePercent}%` }}
                                />
                              </div>
                              <div className="mt-2 grid grid-cols-5 text-[11px] font-extrabold leading-none">
                                {[1, 2, 3, 4, 5].map((tick) => {
                                  const isActiveTick = tick === activeTick;

                                  return (
                                    <span key={tick} className="flex justify-center">
                                      <span
                                        className={
                                          isActiveTick
                                            ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#073b4c] px-1.5 text-white"
                                            : "text-slate-400"
                                        }
                                      >
                                        {tick}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <p className="mt-3 text-[13.5px] leading-[1.55] text-slate-600">
                              {subdimension.summary}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}

              <div className="mt-7 flex justify-end border-t border-slate-200/75 pt-5">
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-[#ef476f]/45 bg-[rgba(239,71,111,0.10)] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#073b4c] transition-colors hover:border-[#ef476f]/70 hover:bg-[rgba(239,71,111,0.16)]"
                  onClick={handleCloseDomainDetails}
                >
                  Sakrij detalje ↑
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Šta ovaj profil znači u praksi</h3>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-[18px] shadow-none">
            <div
              className="mb-3.5 h-1 w-14 rounded-full"
              style={{ background: "#06d6a0" }}
            />
            <h4 className="mb-3 text-[13px] font-extrabold leading-[1.2] text-slate-950">Snage</h4>
            <ul className="results-bullet-list space-y-2 text-[13.5px] leading-[1.55] text-slate-600">
              {report.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-[18px] shadow-none">
              <div
                className="mb-3.5 h-1 w-14 rounded-full"
                style={{ background: "#ffd166" }}
              />
              <h4 className="mb-3 text-[13px] font-extrabold leading-[1.2] text-slate-950">
                Tačke opreza
              </h4>
              <ul className="results-bullet-list space-y-2 text-[13.5px] leading-[1.55] text-slate-600">
                {report.watchouts.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            {hasDevelopmentRecommendations ? (
              <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-[18px] shadow-none">
                <div
                  className="mb-3.5 h-1 w-14 rounded-full"
                  style={{ background: "#118ab2" }}
                />
                <h4 className="mb-3 text-[13px] font-extrabold leading-[1.2] text-slate-950">
                  Preporuke
                </h4>
                <ul className="results-bullet-list space-y-2 text-[13.5px] leading-[1.55] text-slate-600">
                  {report.development_recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-slate-200/70 bg-slate-50/70 px-5 py-4">
        <h3 className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
          Interpretacijska napomena
        </h3>
        <p className="mt-2 text-[12.5px] leading-[1.6] text-slate-500">
          {report.interpretation_note}
        </p>
      </section>
    </div>
  );
}

function IpipNeo120HrReportSections({
  report,
}: {
  report: IpipNeo120HrReportV1;
}) {
  return (
    <div className="results-report__closing stack-md">
      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <p className="results-report__section-kicker">HR izvještaj</p>
          <h3>{report.headline}</h3>
        </div>
        <p>{report.executive_summary}</p>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Ključni workplace signali</h3>
        </div>
        <ul className="results-bullet-list">
          {report.workplace_signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__section--dimensions stack-sm">
        <div className="results-report__section-heading">
          <h3>Domene</h3>
        </div>

        <ol className="results-dimension-list">
          {report.domains.map((domain) => (
            <li key={domain.code} className="results-dimension-card">
              <div className="results-dimension-card__header">
                <div className="results-dimension-card__title">
                  <h4>{domain.label}</h4>
                  <p className="results-dimension-card__helper">{formatNeoHrBandLabel(domain.score_band)}</p>
                </div>
              </div>

              <p className="results-dimension-card__summary">{domain.summary}</p>

              <section className="results-dimension-card__details stack-xs">
                <div className="results-dimension-card__detail-block">
                  <h5>Snage u radnom kontekstu</h5>
                  <ul className="results-bullet-list">
                    {domain.workplace_strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="results-dimension-card__detail-block">
                  <h5>Tačke opreza u radnom kontekstu</h5>
                  <ul className="results-bullet-list">
                    {domain.workplace_watchouts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="results-dimension-card__detail-block">
                  <h5>Napomene za upravljanje</h5>
                  <ul className="results-bullet-list">
                    {domain.management_notes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="results-dimension-card__detail-block">
                  <h5>Facete</h5>
                  <ol className="results-score-overview" aria-label={`Facete za ${domain.label}`}>
                    {domain.facets.map((facet) => (
                      <li key={facet.code} className="results-score-overview__item">
                        <div className="results-score-overview__header">
                          <strong>{facet.label}</strong>
                          <span>{formatNeoHrBandLabel(facet.score_band)}</span>
                        </div>
                        <p className="results-dimension-card__summary">{facet.summary}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            </li>
          ))}
        </ol>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Stil saradnje</h3>
        </div>
        <p>{report.collaboration_style}</p>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Stil komunikacije</h3>
        </div>
        <p>{report.communication_style}</p>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Leadership i uticaj</h3>
        </div>
        <p>{report.leadership_and_influence}</p>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Timske tačke opreza</h3>
        </div>
        <ul className="results-bullet-list">
          {report.team_watchouts.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Preporuke za onboarding i upravljanje</h3>
        </div>
        <ul className="results-bullet-list">
          {report.onboarding_or_management_recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Interpretacijska napomena</h3>
        </div>
        <p>{report.interpretation_note}</p>
      </section>
    </div>
  );
}

function IpcStyleSnapshotList({
  locale,
  primaryDisc,
  dominantOctant,
  secondaryOctant,
  dominance,
  warmth,
}: {
  locale: ReturnType<typeof normalizeIpcUiLocale>;
  primaryDisc: string | null;
  dominantOctant: string | null;
  secondaryOctant: string | null;
  dominance?: number;
  warmth?: number;
}) {
  return (
    <dl className="results-report__hero-meta">
      <div className="results-report__hero-meta-item">
        <dt>{formatIpcStyleMetricLabel("primary_disc", locale)}</dt>
        <dd>{formatIpcPrimaryDiscLabel(primaryDisc, locale)}</dd>
      </div>
      <div className="results-report__hero-meta-item">
        <dt>{formatIpcStyleMetricLabel("dominant_octant", locale)}</dt>
        <dd>{formatIpcOctantLabel(dominantOctant, locale)}</dd>
      </div>
      <div className="results-report__hero-meta-item">
        <dt>{formatIpcStyleMetricLabel("secondary_octant", locale)}</dt>
        <dd>{formatIpcOctantLabel(secondaryOctant, locale)}</dd>
      </div>
      {typeof dominance === "number" ? (
        <div className="results-report__hero-meta-item">
          <dt>{formatIpcStyleMetricLabel("dominance", locale)}</dt>
          <dd>{formatIpcNumericMetric(dominance)}</dd>
        </div>
      ) : null}
      {typeof warmth === "number" ? (
        <div className="results-report__hero-meta-item">
          <dt>{formatIpcStyleMetricLabel("warmth", locale)}</dt>
          <dd>{formatIpcNumericMetric(warmth)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function IpcParticipantReportSections({
  locale,
  report,
}: {
  locale: ReturnType<typeof normalizeIpcUiLocale>;
  report: IpcParticipantReportV1;
}) {
  return (
    <div className="results-report__closing stack-md">
      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <p className="results-report__section-kicker">{formatIpcStaticLabel("report", locale)}</p>
          <h3>{report.report_title}</h3>
          <p className="results-report__section-body">{report.report_subtitle}</p>
        </div>
        <div className="stack-xs">
          <p><strong>{report.summary.headline}</strong></p>
          <p>{report.summary.overview}</p>
        </div>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("style_snapshot", locale)}</h3>
        </div>
        <IpcStyleSnapshotList
          locale={locale}
          primaryDisc={report.style_snapshot.primary_disc}
          dominantOctant={report.style_snapshot.dominant_octant}
          secondaryOctant={report.style_snapshot.secondary_octant}
        />
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("strengths_in_collaboration", locale)}</h3>
        </div>
        <ul className="results-bullet-list">
          {report.strengths_in_collaboration.map((item) => (
            <li key={item.title}>
              <strong>{item.title}:</strong> {item.description}
            </li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("participant_watchouts", locale)}</h3>
        </div>
        <ul className="results-bullet-list">
          {report.watchouts.map((item) => (
            <li key={item.title}>
              <strong>{item.title}:</strong> {item.description}
            </li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("development_recommendations", locale)}</h3>
        </div>
        <ul className="results-bullet-list">
          {report.development_recommendations.map((item) => (
            <li key={item.title}>
              <strong>{item.title}:</strong> {item.description} {item.action}
            </li>
          ))}
        </ul>
      </section>

      <p className="results-report__disclaimer">{report.disclaimer}</p>
    </div>
  );
}

function IpcHrReportSections({
  locale,
  report,
}: {
  locale: ReturnType<typeof normalizeIpcUiLocale>;
  report: IpcHrReportV1;
}) {
  return (
    <div className="results-report__closing stack-md">
      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <p className="results-report__section-kicker">{formatIpcStaticLabel("hr_report", locale)}</p>
          <h3>{report.report_title}</h3>
          <p className="results-report__section-body">{report.report_subtitle}</p>
        </div>
        <div className="stack-xs">
          <p><strong>{report.summary.headline}</strong></p>
          <p>{report.summary.overview}</p>
        </div>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("style_snapshot", locale)}</h3>
        </div>
        <IpcStyleSnapshotList
          locale={locale}
          primaryDisc={report.style_snapshot.primary_disc}
          dominantOctant={report.style_snapshot.dominant_octant}
          secondaryOctant={report.style_snapshot.secondary_octant}
          dominance={report.style_snapshot.dominance}
          warmth={report.style_snapshot.warmth}
        />
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("communication_style", locale)}</h3>
        </div>
        <p><strong>{report.communication_style.summary}</strong></p>
        <p>{report.communication_style.manager_notes}</p>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("collaboration_style", locale)}</h3>
        </div>
        <p><strong>{report.collaboration_style.summary}</strong></p>
        <p>{report.collaboration_style.manager_notes}</p>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("leadership_and_influence", locale)}</h3>
        </div>
        <p><strong>{report.leadership_and_influence.summary}</strong></p>
        <p>{report.leadership_and_influence.manager_notes}</p>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("team_watchouts", locale)}</h3>
        </div>
        <ul className="results-bullet-list">
          {report.team_watchouts.map((item) => (
            <li key={item.title}>
              <strong>{item.title}:</strong> {item.description}
            </li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>{formatIpcStaticLabel("onboarding_or_management_recommendations", locale)}</h3>
        </div>
        <ul className="results-bullet-list">
          {report.onboarding_or_management_recommendations.map((item) => (
            <li key={item.title}>
              <strong>{item.title}:</strong> {item.description} {item.action}
            </li>
          ))}
        </ul>
      </section>

      <p className="results-report__disclaimer">{report.disclaimer}</p>
    </div>
  );
}

export function CompletedAssessmentSummary({
  completedAt,
  locale,
  organizationName,
  participantName,
  testName,
  results,
  reportState,
}: CompletedAssessmentSummaryProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const hasResults = results !== null;
  const ipcUiLocale = normalizeIpcUiLocale(locale);
  const reportRenderer = selectReportRenderer(reportState);
  const ipipNeo120ParticipantReport =
    reportRenderer.kind === "ipip_neo_120_participant_v1" ? reportRenderer.report : null;
  const ipipNeo120HrReport =
    reportRenderer.kind === "ipip_neo_120_hr_v1" ? reportRenderer.report : null;
  const bigFiveParticipantReport =
    reportRenderer.kind === "big_five_participant_v1" ? reportRenderer.report : null;
  const bigFiveHrReport = reportRenderer.kind === "big_five_hr_v1" ? reportRenderer.report : null;
  const bigFiveReport = bigFiveParticipantReport ?? bigFiveHrReport;
  const ipcParticipantReport =
    reportRenderer.kind === "ipc_participant_v1" ? reportRenderer.report : null;
  const ipcHrReport = reportRenderer.kind === "ipc_hr_v1" ? reportRenderer.report : null;
  const shouldShowGenericDimensionCards =
    Boolean(results) && Boolean(bigFiveParticipantReport) && !ipipNeo120ParticipantReport;
  const shouldShowBigFiveHrFallbackCard = Boolean(bigFiveHrReport) && !ipipNeo120HrReport;
  const shouldShowRawResultsPreview = !ipipNeo120ParticipantReport && !ipipNeo120HrReport;

  const maxRawScore =
    results && results.dimensions.length > 0
      ? Math.max(...results.dimensions.map((dimension) => dimension.rawScore), 0)
      : 0;
  const isMwmsResults = results
    ? isMwmsDimensionSet(results.dimensions.map((dimension) => dimension.dimension))
    : false;

  const reportDimensionsByKey = getReportDimensionsByKey(bigFiveReport);

  const dimensionCards: DimensionViewModel[] =
    results?.dimensions.map((dimension, index, dimensions) => {
      const reportDimension = reportDimensionsByKey.get(dimension.dimension);

      return {
        key: dimension.dimension,
        label: formatDimensionLabel(dimension.dimension),
        helperLabel: isMwmsResults ? null : getDimensionHelperLabel(dimension.dimension),
        score: dimension.rawScore,
        scoreLabel: isMwmsResults
          ? formatMwmsScoreLabel(dimension.rawScore)
          : formatScoreLabel(dimension.rawScore),
        averageScore: getAverageScore(dimension.rawScore, dimension.scoredQuestionCount),
        scoredQuestionCount: dimension.scoredQuestionCount,
        shortInterpretation:
          reportDimension?.summary ??
          "Detaljna interpretacija za ovu dimenziju trenutno nije dostupna.",
        scoreWidth: isMwmsResults
          ? getMwmsScoreWidth(dimension.rawScore)
          : maxRawScore > 0
            ? Math.max((dimension.rawScore / maxRawScore) * 100, 10)
            : 0,
        rank: index,
        totalDimensions: dimensions.length,
      };
    }) ?? [];

  const topInsights = getTopInsights(bigFiveReport, dimensionCards);
  const conclusionParagraphs = getConclusion(bigFiveReport, dimensionCards);
  const recommendations = getRecommendations(bigFiveReport);
  const scoreRangeLabel = isMwmsResults ? "Skala 1–7" : maxRawScore > 0 ? `0–${maxRawScore} bodova` : null;
  const primaryMetaCount = [participantName, organizationName].filter(Boolean).length;
  const hasScoredDimensions = dimensionCards.length > 0;
  const shouldShowNarrativePending =
    reportState === null ||
    reportState.status === "queued" ||
    reportState.status === "processing";
  const shouldShowNarrativeFailed =
    reportState?.status === "failed" || reportState?.status === "unavailable";
  const shouldShowResultsUnavailable = !hasResults;
  const shouldShowReadyReportShapeMismatch = reportRenderer.kind === "shape_mismatch";
  const shouldShowUnsupportedReadySignal = reportRenderer.kind === "unsupported_signal";
  const reportHeroTitle = ipipNeo120ParticipantReport ? "Tvoj profil ličnosti" : testName ?? "Rezultati procjene";
  const ipipParticipantMetaLine = ipipNeo120ParticipantReport
    ? [
        "IPIP-NEO-120",
        organizationName,
        `završeno ${formatCompletedAt(completedAt)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const readyReportShapeMismatchMessage =
    reportRenderer.kind === "shape_mismatch" ? reportRenderer.message : null;
  const unsupportedReadySignalMessage =
    reportRenderer.kind === "unsupported_signal" ? reportRenderer.message : null;

  if (isSafranV1Results(results) || results?.scoringMethod === "correct_answers") {
    return (
      <SafranV1ResultsSummary
        completedAt={completedAt}
        organizationName={organizationName}
        participantName={participantName}
        testName={testName}
        results={results}
      />
    );
  }

  return (
    <div className="results-report stack-md">
      {ipipNeo120ParticipantReport ? (
        <div className="mb-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-slate-700 transition-colors duration-200 hover:text-slate-900"
          >
            <span aria-hidden="true">←</span>
            <span>Nazad na dashboard</span>
          </Link>
        </div>
      ) : null}

      <section
        className={
          ipipNeo120ParticipantReport
            ? "results-report__hero relative overflow-hidden border border-slate-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,251,0.96))] px-6 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)] sm:px-7 sm:py-6"
            : "results-report__hero"
        }
      >
        {ipipNeo120ParticipantReport ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0))]"
          />
        ) : null}

        <div
          className={
            ipipNeo120ParticipantReport
              ? "results-report__hero-copy relative z-10 gap-2.5 sm:gap-3"
              : "results-report__hero-copy"
          }
        >
          <p
            className={
              ipipNeo120ParticipantReport
                ? "results-report__eyebrow text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500"
                : "results-report__eyebrow"
            }
          >
            Izvještaj procjene
          </p>
          <h2
            className={
              ipipNeo120ParticipantReport
                ? `${zodiak.className} max-w-none whitespace-nowrap text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.04] tracking-[-0.04em] text-slate-950`
                : undefined
            }
            style={
              ipipNeo120ParticipantReport
                ? {
                    maxWidth: "none",
                    whiteSpace: "nowrap",
                  }
                : undefined
            }
          >
            {reportHeroTitle}
          </h2>

          {ipipParticipantMetaLine ? (
            <p
              className={
                ipipNeo120ParticipantReport
                  ? "mt-2 inline-flex max-w-full items-center whitespace-nowrap overflow-hidden text-ellipsis text-[13px] font-semibold leading-[1.4] tracking-[-0.01em] text-slate-500 sm:mt-2.5"
                  : "results-report__section-body"
              }
            >
              {ipipParticipantMetaLine}
            </p>
          ) : (
            <div className="results-report__hero-meta-wrap">
              <dl className="results-report__hero-meta">
                {participantName ? (
                  <div className={primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"}>
                    <dt>Korisnik</dt>
                    <dd>{participantName}</dd>
                  </div>
                ) : null}
                {organizationName ? (
                  <div className={primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"}>
                    <dt>Organizacija</dt>
                    <dd>{organizationName}</dd>
                  </div>
                ) : null}
                <div className="results-report__hero-meta-item results-report__hero-meta-item--wide">
                  <dt>Završeno</dt>
                  <dd>{formatCompletedAt(completedAt)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

      {bigFiveReport && topInsights.length > 0 ? (
        <section
          className="results-report__hero-insights results-report__hero-insights--mobile"
          aria-label="Top insights"
          >
            <p className="results-report__hero-label">Top uvidi</p>
            <ul className="results-insight-list">
              {topInsights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>

      {bigFiveReport && topInsights.length > 0 ? (
        <section
          className="results-report__section results-report__section--insights results-report__panel card stack-sm"
          aria-label="Top insights"
        >
          <div className="results-report__section-heading">
            <p className="results-report__section-kicker">Top uvidi</p>
            <h3>Sažetak ključnih obrazaca</h3>
          </div>
          <ul className="results-insight-list">
            {topInsights.map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {shouldShowNarrativePending ? (
        <section className="results-report__section results-report__status results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Interpretativni izvještaj se priprema</h3>
          </div>
          <p className="results-report__section-body">
            Tvoj detaljni narativni izvještaj je zaprimljen i trenutno se obrađuje. Preliminarni
            pregled bodovanja dostupan je ispod, a stranica će se osvježavati automatski čim puni
            izvještaj bude spreman.
          </p>
        </section>
      ) : null}

      {shouldShowNarrativeFailed ? (
        <section className="results-report__section results-report__status results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Izvještaj trenutno nije dostupan</h3>
          </div>
          <p className="results-report__section-body">
            Obrada izvještaja za ovaj završeni pokušaj trenutno nije uspjela. Bodovani rezultati i
            dalje ostaju dostupni ispod.
          </p>
        </section>
      ) : null}

      {shouldShowResultsUnavailable ? (
        <section className="results-report__section results-report__status results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Rezultati trenutno nisu dostupni</h3>
          </div>
          <p className="results-report__section-body">
            Ovaj pokušaj je završen, ali pregled bodovanja trenutno nije dostupan. To najčešće
            znači da podaci za izvještaj još nisu usklađeni.
          </p>
        </section>
      ) : null}

      {shouldShowReadyReportShapeMismatch ? (
        renderReportFallbackCard(
          "Format izvještaja nije usklađen sa rendererom",
          readyReportShapeMismatchMessage ??
            "Ready report signal postoji, ali snapshot shape ne odgovara očekivanom rendereru.",
        )
      ) : null}

      {shouldShowUnsupportedReadySignal ? (
        renderReportFallbackCard(
          "Format izvještaja trenutno nije podržan za prikaz",
          unsupportedReadySignalMessage ??
            "Ready report signal trenutno nema podržan renderer u ovoj verziji aplikacije.",
        )
      ) : null}

      {results && shouldShowRawResultsPreview ? (
        <>
          <section className="results-report__section results-report__section--overview results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Pregled dimenzija</h3>
              {scoreRangeLabel ? <p className="results-report__section-note">{scoreRangeLabel}</p> : null}
            </div>

            {dimensionCards.length > 0 ? (
              <ol className="results-score-overview" aria-label="Pregled rezultata po dimenzijama">
                {dimensionCards.map((dimension) => (
                  <li key={dimension.key} className="results-score-overview__item">
                    <div className="results-score-overview__header">
                      <strong>{dimension.label}</strong>
                      <span>{dimension.scoreLabel}</span>
                    </div>
                    <div
                      className="results-score-overview__bar"
                      role="img"
                      aria-label={`${dimension.label} skor ${dimension.score}`}
                    >
                      <span style={{ width: `${dimension.scoreWidth}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Za ovaj završeni pokušaj nisu dostupni odgovori koji se mogu bodovati.</p>
            )}
          </section>

          {shouldShowGenericDimensionCards && hasScoredDimensions ? (
            <section className="results-report__section results-report__section--dimensions stack-sm">
              <div className="results-report__section-heading">
                <h3>Dimenzije</h3>
              </div>

              <ol className="results-dimension-list">
                {dimensionCards.map((dimension) => {
                  const isExpanded = expandedDimension === dimension.key;
                  const detailId = `dimension-detail-${dimension.key}`;

                  return (
                    <li key={dimension.key} className="results-dimension-card">
                      <div className="results-dimension-card__header">
                        <div className="results-dimension-card__title">
                          <h4>{dimension.label}</h4>
                          {dimension.helperLabel ? (
                            <p className="results-dimension-card__helper">{dimension.helperLabel}</p>
                          ) : null}
                        </div>
                        <div className="results-dimension-card__score">
                          <span className="results-dimension-card__score-value">
                            {dimension.scoreLabel}
                          </span>
                        </div>
                      </div>

                      <p className="results-dimension-card__summary">
                        {getLeadSentence(toSecondPersonSingular(dimension.shortInterpretation))}
                      </p>

                      <div className="results-dimension-card__footer">
                        <button
                          type="button"
                          className="results-dimension-card__toggle"
                          aria-expanded={isExpanded}
                          aria-controls={detailId}
                          onClick={() =>
                            setExpandedDimension((current) =>
                              current === dimension.key ? null : dimension.key,
                            )
                          }
                        >
                          <span className="results-dimension-card__toggle-label-mobile">
                            {isExpanded ? "Manje" : "Više"}
                          </span>
                          <span className="results-dimension-card__toggle-label-desktop" aria-hidden="true">
                            {isExpanded ? "Sakrij detalje" : "Prikaži detalje"}
                          </span>
                        </button>
                      </div>

                      {isExpanded ? (
                        <div id={detailId} className="results-dimension-card__details stack-xs">
                          {(reportDimensionsByKey.get(dimension.key)
                            ? [
                                {
                                  heading: "Kako se to kod tebe često pokazuje" as const,
                                  body: reportDimensionsByKey.get(dimension.key)?.work_style ?? "",
                                },
                                {
                                  heading: "Šta ti to može donositi kao prednost" as const,
                                  body: reportDimensionsByKey.get(dimension.key)?.summary ?? "",
                                },
                                {
                                  heading: "Na šta vrijedi obratiti pažnju" as const,
                                  body:
                                    reportDimensionsByKey.get(dimension.key)?.risks ??
                                    reportDimensionsByKey.get(dimension.key)?.development_focus ??
                                    "",
                                },
                              ]
                            : getDimensionDetailBlocks(dimension)
                          ).map((detail) => (
                            <section key={detail.heading} className="results-dimension-card__detail-block">
                              <h5>{detail.heading}</h5>
                              <p>{detail.body}</p>
                            </section>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {results.unscoredResponses.length > 0 ? (
            <section className="results-report__section results-report__panel card stack-sm">
              <div className="results-report__section-heading">
                <h3>Nebodovani odgovori</h3>
              </div>
              <ol className="results-inline-list">
                {results.unscoredResponses.map((response) => (
                  <li key={response.questionId}>
                    <strong>{response.questionCode}</strong>: {formatUnscoredReason(response.reason)}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}

      {bigFiveParticipantReport ? (
        <div className="results-report__closing stack-md">
          <section className="results-report__section results-report__section--conclusion results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Zaključak</h3>
            </div>
            <div className="results-report__section-body stack-xs">
              {conclusionParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          {recommendations.length > 0 ? (
            <section className="results-report__section results-report__section--recommendations results-report__panel card stack-sm">
              <div className="results-report__section-heading">
                <h3>Preporuke</h3>
              </div>
              <ul className="results-bullet-list">
                {recommendations.map((item) => {
                  const formatted = formatRecommendation({
                    title: toSecondPersonSingular(item.title),
                    description: toSecondPersonSingular(item.description),
                    action: toSecondPersonSingular(item.action),
                  });

                  return (
                    <li key={item.title}>
                      <strong>{formatted.lead}:</strong>
                      {formatted.body ? ` ${formatted.body}` : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {shouldShowBigFiveHrFallbackCard ? (
        renderReportFallbackCard(
          "Big Five HR prikaz još nije dostupan",
          "Render format za Big Five HR je prepoznat, ali zaseban HR layout još nije podržan u ovoj verziji aplikacije.",
        )
      ) : null}

      {ipipNeo120ParticipantReport ? (
        <IpipNeo120ParticipantReportSections report={ipipNeo120ParticipantReport} />
      ) : null}

      {ipipNeo120HrReport ? (
        <IpipNeo120HrReportSections report={ipipNeo120HrReport} />
      ) : null}

      {ipcParticipantReport ? (
        <IpcParticipantReportSections locale={ipcUiLocale} report={ipcParticipantReport} />
      ) : null}

      {ipcHrReport ? (
        <IpcHrReportSections locale={ipcUiLocale} report={ipcHrReport} />
      ) : null}

      {bigFiveReport ? <p className="results-report__disclaimer">{bigFiveReport.disclaimer}</p> : null}

    </div>
  );
}
