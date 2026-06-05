"use client";

import { useEffect, useRef, useState } from "react";

import {
  PersonalityRadarChart,
  getPersonalityRadarSnapshot,
  type PersonalityRadarDomain,
} from "@/components/assessment/personality-radar-chart";
import { ReportGenerationLoadingScreen } from "@/components/assessment/report-generation-loading-screen";
import type { DetailedReportV1 } from "@/lib/assessment/detailed-report-v1";
import type {
  IpipNeo120HrReportV1,
  IpipNeo120ParticipantReportV1,
} from "@/lib/assessment/ipip-neo-120-report-v1";
import { coerceIpipNeo120HrReportV1ForDisplay } from "@/lib/assessment/ipip-neo-120-report-v1";
import type { IpipNeo120ParticipantReportV2 } from "@/lib/assessment/ipip-neo-120-participant-report-v2";
import type { AssessmentLocale } from "@/lib/assessment/locale";
import type { IpcHrReportV1, IpcParticipantReportV1 } from "@/lib/assessment/ipc-report-v1";
import type { MwmsHrReportV1 } from "@/lib/assessment/mwms-hr-report-v1";
import type { MwmsParticipantReportV1 } from "@/lib/assessment/mwms-participant-report-v1";
import type { CompletedAssessmentReportState } from "@/lib/assessment/report-state-types";
import type { SafranHrReportV1 } from "@/lib/assessment/safran-hr-report-v1";
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
import { buildParticipantIpipProfileOverview } from "@/lib/assessment/ipip-participant-report-display";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import {
  extractSafranParticipantAiDisplayScores,
  validateSafranParticipantAiReport,
  type SafranParticipantAiReport,
} from "@/lib/assessment/safran-participant-ai-report-v1";
import type { SafranScoreKey } from "@/lib/assessment/safran-interpretation";
import {
  resolveSafranParticipantReportDisplay,
} from "@/lib/assessment/safran-participant-report-display";
import {
  resolveSafranHrReportDisplay,
} from "@/lib/assessment/safran-hr-report-display";
import {
  resolveMwmsHrReportDisplay,
} from "@/lib/assessment/mwms-hr-report-display";
import { zodiak } from "@/lib/fonts";

type CompletedAssessmentSummaryProps = {
  completedAt?: string | null;
  locale?: AssessmentLocale | null;
  organizationName?: string | null;
  participantName?: string | null;
  testSlug?: string | null;
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
  shortInterpretation: string;
  scoreWidth: number;
};

type ReportDimensionSnapshot = {
  dimension_code: string;
  summary: string;
  work_style: string;
  risks: string;
  development_focus: string;
};

type ReportRendererSelection =
  | { kind: "ipip_neo_120_hr"; report: IpipNeo120HrReportV1 }
  | { kind: "ipip_neo_120_participant_v1"; report: IpipNeo120ParticipantReportV1 }
  | { kind: "ipip_neo_120_participant_v2"; report: IpipNeo120ParticipantReportV2 }
  | { kind: "big_five_participant_v1"; report: DetailedReportV1 }
  | { kind: "big_five_hr_v1"; report: DetailedReportV1 }
  | { kind: "ipc_participant_v1"; report: IpcParticipantReportV1 }
  | { kind: "ipc_hr_v1"; report: IpcHrReportV1 }
  | { kind: "mwms_hr_report_v1"; report: MwmsHrReportV1 }
  | { kind: "mwms_participant_report_v1"; report: MwmsParticipantReportV1 }
  | { kind: "safran_participant_ai_report_v1"; report: SafranParticipantAiReport }
  | { kind: "safran_hr_report_v1"; report: SafranHrReportV1 }
  | { kind: "shape_mismatch"; message: string }
  | { kind: "unsupported_signal"; message: string }
  | { kind: "none" };

const MWMS_PROFILE_READING_GUIDANCE = [
  "Rezultat prikazuje koji su izvori radne motivacije izraženiji u ovom trenutku.",
  "Skale treba čitati zajedno, kao profil, a ne kao jedan ukupni rezultat.",
  "Viši skor na autonomnim oblicima motivacije obično ukazuje da osoba lakše povezuje posao sa ličnim vrijednostima, interesom ili smislom.",
  "Viši skor na kontrolisanim oblicima motivacije ukazuje da veći dio napora može dolaziti iz pritiska, očekivanja, nagrade ili izbjegavanja negativnih posljedica.",
  "Amotivacija se čita oprezno i služi kao signal za dodatni razgovor o kontekstu, energiji i jasnoći uloge.",
] as const;

const MWMS_NEXT_STEPS = [
  "U razgovoru provjeriti koji aspekti posla kandidatu daju osjećaj smisla, energije i odgovornosti.",
  "Povezati motivacijski profil sa očekivanjima konkretne uloge, načinom vođenja i uslovima rada.",
  "Ne koristiti pojedinačnu skalu kao eliminacioni kriterij.",
] as const;

const TECHNICAL_REPORT_TEXT_MARKERS = new Set(["paragraphs_placeholder_removed"]);

type MwmsBandLabel = "Nisko" | "Umjereno" | "Izraženo" | "Vrlo izraženo";

function getMwmsBandLabel(score: number): MwmsBandLabel {
  if (score < 2.5) {
    return "Nisko";
  }

  if (score < 3.5) {
    return "Umjereno";
  }

  if (score < 5) {
    return "Izraženo";
  }

  return "Vrlo izraženo";
}

function getMwmsBandPillClassName(score: number): string {
  const bandLabel = getMwmsBandLabel(score);

  switch (bandLabel) {
    case "Nisko":
      return "border-[rgba(100,116,139,0.34)] bg-[rgba(241,245,249,0.96)] text-slate-700";
    case "Umjereno":
      return "border-[rgba(94,234,212,0.26)] bg-[rgba(240,253,250,0.92)] text-slate-700";
    case "Izraženo":
      return "border-[rgba(13,148,136,0.42)] bg-[rgba(204,251,241,0.6)] text-slate-800";
    case "Vrlo izraženo":
      return "border-[rgba(15,23,42,0.18)] bg-[rgba(222,239,248,0.92)] text-slate-900";
    default:
      return "border-[rgba(94,234,212,0.26)] bg-[rgba(240,253,250,0.92)] text-slate-700";
  }
}

function formatMwmsShortDimensionLabel(dimensionKey: string): string {
  switch (dimensionKey) {
    case "external_social":
      return "Socijalna ekstrinzična motivacija";
    case "external_material":
      return "Materijalna ekstrinzična motivacija";
    case "introjected":
      return "Introjektirana motivacija";
    case "identified":
      return "Identificirana motivacija";
    case "intrinsic":
      return "Intrinzična motivacija";
    case "amotivation":
      return "Amotivacija";
    default:
      return formatDimensionLabel(dimensionKey);
  }
}

function getMwmsDimensionMicroDescription(dimensionKey: string): string {
  switch (dimensionKey) {
    case "amotivation":
      return "Manjak smisla ili energije";
    case "external_social":
      return "Priznanje i očekivanja drugih";
    case "external_material":
      return "Nagrada, sigurnost ili korist";
    case "introjected":
      return "Obaveza i unutrašnji pritisak";
    case "identified":
      return "Posao koji ti je važan";
    case "intrinsic":
      return "Interes i zadovoljstvo u radu";
    default:
      return "";
  }
}

function sanitizeTechnicalReportText(text: string | null | undefined): string | null {
  if (typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  if (TECHNICAL_REPORT_TEXT_MARKERS.has(trimmed.toLowerCase())) {
    return null;
  }

  return trimmed;
}

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

function isIpipNeo120ParticipantReportV2(
  report: unknown,
): report is IpipNeo120ParticipantReportV2 {
  return (
    Boolean(report) &&
    typeof report === "object" &&
    (report as IpipNeo120ParticipantReportV2).contract_version ===
      "ipip_neo_120_participant_v2" &&
    Array.isArray((report as IpipNeo120ParticipantReportV2).domains) &&
    Array.isArray((report as IpipNeo120ParticipantReportV2).key_patterns) &&
    Array.isArray((report as IpipNeo120ParticipantReportV2).strengths) &&
    Array.isArray((report as IpipNeo120ParticipantReportV2).watchouts) &&
    Array.isArray((report as IpipNeo120ParticipantReportV2).development_recommendations)
  );
}

function isIpipNeo120HrReport(report: unknown): report is IpipNeo120HrReportV1 {
  return coerceIpipNeo120HrReportV1ForDisplay(report) !== null;
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

function isMwmsParticipantReport(report: unknown): report is MwmsParticipantReportV1 {
  return (
    Boolean(report) &&
    typeof report === "object" &&
    (report as MwmsParticipantReportV1).schema_version === "mwms_participant_report_v1" &&
    (report as MwmsParticipantReportV1).test_slug === "mwms_v1" &&
    (report as MwmsParticipantReportV1).audience === "participant" &&
    (report as MwmsParticipantReportV1).title === "Radna motivacija" &&
    Boolean((report as MwmsParticipantReportV1).summary) &&
    Boolean((report as MwmsParticipantReportV1).motivation_pattern) &&
    Array.isArray((report as MwmsParticipantReportV1).key_observations) &&
    Array.isArray((report as MwmsParticipantReportV1).possible_tensions) &&
    Array.isArray((report as MwmsParticipantReportV1).reflection_questions) &&
    Array.isArray((report as MwmsParticipantReportV1).development_suggestions)
  );
}

function isMwmsHrReport(report: unknown): report is MwmsHrReportV1 {
  return resolveMwmsHrReportDisplay(report) !== null;
}

function isSafranParticipantAiReport(report: unknown): report is SafranParticipantAiReport {
  return validateSafranParticipantAiReport(report).ok;
}

function isSafranHrReport(report: unknown): report is SafranHrReportV1 {
  return resolveSafranHrReportDisplay(report) !== null;
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
    case "ipip_neo_120_participant_v2":
      return isIpipNeo120ParticipantReportV2(reportState.report)
        ? { kind: "ipip_neo_120_participant_v2", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava IPIP-NEO-120 participant V2 izvještaj, ali snapshot shape ne odgovara tom rendereru.",
          };
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
        return {
          kind: "ipip_neo_120_hr",
          report: coerceIpipNeo120HrReportV1ForDisplay(reportState.report) as IpipNeo120HrReportV1,
        };
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
    case "mwms_participant_report_v1":
      return isMwmsParticipantReport(reportState.report)
        ? { kind: "mwms_participant_report_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava MWMS participant izvještaj, ali snapshot shape ne odgovara tom rendereru.",
          };
    case "mwms_hr_report_v1":
      return isMwmsHrReport(reportState.report)
        ? { kind: "mwms_hr_report_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava MWMS HR izvještaj, ali snapshot shape ne odgovara tom rendereru.",
          };
    case "safran_participant_ai_report_v1":
      return isSafranParticipantAiReport(reportState.report)
        ? { kind: "safran_participant_ai_report_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava SAFRAN participant AI izvještaj, ali snapshot shape ne odgovara tom rendereru.",
          };
    case "safran_hr_report_v1":
      return isSafranHrReport(reportState.report)
        ? { kind: "safran_hr_report_v1", report: reportState.report }
        : {
            kind: "shape_mismatch",
            message:
              "Report render format označava SAFRAN HR izvještaj, ali snapshot shape ne odgovara tom rendereru.",
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

function formatParticipantIpipInlineNarrativeLabel(label: string): string {
  return label.trim().toLocaleLowerCase("bs");
}

function ParticipantIpipInlineNarrativeTerm({
  label,
}: {
  label: string;
}) {
  return <em>{formatParticipantIpipInlineNarrativeLabel(label)}</em>;
}

function getParticipantIpipDomainMicroSummary(domainCode: string | null | undefined): string {
  const normalizedCode = String(domainCode ?? "").toUpperCase();

  switch (normalizedCode) {
    case "EXTRAVERSION":
      return "Energija koju unosiš u kontakt s drugima";
    case "AGREEABLENESS":
      return "Način na koji gradiš povjerenje i odnose";
    case "CONSCIENTIOUSNESS":
      return "Tvoj odnos prema redu, obavezama i odgovornosti";
    case "NEUROTICISM":
      return "Tvoj odgovor na pritisak i zahtjevne situacije";
    case "OPENNESS":
    case "OPENNESS_TO_EXPERIENCE":
      return "Tvoj odnos prema novim idejama i promjenama";
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
type ParticipantIpipDomainV2 = IpipNeo120ParticipantReportV2["domains"][number];
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

function ensureSentence(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
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

function getParticipantIpipRadarLabelV2(domain: Pick<
  ParticipantIpipDomainV2,
  "domain_code" | "participant_display_label"
>): string {
  switch (domain.domain_code) {
    case "EXTRAVERSION":
      return "Ekstraverzija";
    case "AGREEABLENESS":
      return "Saradnja";
    case "CONSCIENTIOUSNESS":
      return "Savjesnost";
    case "NEUROTICISM":
      return domain.participant_display_label === "Emocionalna reaktivnost"
        ? "Emocionalna reaktivnost"
        : "Emocionalna stabilnost";
    case "OPENNESS_TO_EXPERIENCE":
      return "Otvorenost";
    default:
      return domain.participant_display_label;
  }
}

function getParticipantIpipRadarDomainsV2(
  report: IpipNeo120ParticipantReportV2,
): PersonalityRadarDomain[] {
  const domainsByCode = new Map(report.domains.map((domain) => [domain.domain_code, domain]));

  return PARTICIPANT_IPIP_RADAR_DOMAIN_ORDER.flatMap((domainCode) => {
    const domain = domainsByCode.get(domainCode);

    if (!domain || !Number.isFinite(domain.display_score)) {
      return [];
    }

    return [
      {
        key: domain.domain_code,
        label: getParticipantIpipRadarLabelV2(domain),
        score: domain.display_score,
      },
    ];
  });
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

/* Legacy dimension details must come from the persisted report, never from score bands. */
const LEGACY_DIMENSION_DETAIL_UNAVAILABLE =
  "Detaljnije tumačenje za ovu dimenziju nije dostupno u ovom izvještaju.";
const LEGACY_RECOMMENDATION_FIELD_UNAVAILABLE = "Nije dostupno u ovom izvještaju.";
const LEGACY_RECOMMENDATIONS_UNAVAILABLE = "Preporuke nisu dostupne u ovom izvještaju.";

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

function getSafranDisplayScore(
  results: CompletedAssessmentResults | null,
): Partial<Record<SafranScoreKey, number | null>> {
  return extractSafranParticipantAiDisplayScores(results);
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

function getSafranVisualScoreWidth(
  score: number | null | undefined,
  maxPossible: number,
): number {
  if (typeof score !== "number" || !Number.isFinite(score) || maxPossible <= 0) {
    return 0;
  }

  return Math.max(0, Math.min((score / maxPossible) * 100, 100));
}

function getSafranBandPillClassName(): string {
  return "inline-flex items-center rounded-full border border-[rgba(15,23,42,0.10)] bg-[rgba(248,250,252,0.96)] px-3 py-1 text-[11px] font-semibold tracking-[0.02em] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]";
}

function SafranV1ResultsSummary({
  completedAt,
  organizationName,
  participantName,
  testName,
  results,
  aiReport,
}: {
  completedAt?: string | null;
  organizationName?: string | null;
  participantName?: string | null;
  testName?: string | null;
  results: CompletedAssessmentResults | null;
  aiReport?: SafranParticipantAiReport | null;
}) {
  const primaryMetaCount = [participantName, organizationName].filter(Boolean).length;
  const hasValidAiReport = Boolean(aiReport && validateSafranParticipantAiReport(aiReport).ok);
  const reportDisplay = resolveSafranParticipantReportDisplay({
    scores: getSafranDisplayScore(results),
    testName,
    aiReport,
  });
  const [summarySection, domainsSection, signalsSection, readingGuideSection, nextStepSection] =
    reportDisplay.sections;

  return (
    <div className="results-report results-report--safran stack-md">
      <section className="results-report__hero border border-slate-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,251,0.96))] px-5 py-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)] sm:px-6 sm:py-5">
        <div className="results-report__hero-copy gap-2.5">
          <p className="results-report__eyebrow text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{reportDisplay.header.eyebrow}</p>
          <h2>{reportDisplay.header.title}</h2>
          <p className="results-report__section-body text-[15px] text-slate-600">
            {reportDisplay.header.subtitle}
          </p>
          {reportDisplay.header.statusLabel ? (
            <p className="inline-flex w-fit items-center rounded-full border border-[rgba(22,163,74,0.22)] bg-[rgba(22,163,74,0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#166534] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              {reportDisplay.header.statusLabel}
            </p>
          ) : null}

          <div className="results-report__hero-meta-wrap">
            <dl className="results-report__hero-meta">
              {participantName ? (
                <div className={`${primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"} border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]`}>
                  <dt>Korisnik</dt>
                  <dd>{participantName}</dd>
                </div>
              ) : null}
              {organizationName ? (
                <div className={`${primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"} border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]`}>
                  <dt>Organizacija</dt>
                  <dd>{organizationName}</dd>
                </div>
              ) : null}
              <div className="results-report__hero-meta-item results-report__hero-meta-item--wide border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]">
                <dt>Završeno</dt>
                <dd>{formatCompletedAt(completedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {!results && !hasValidAiReport ? (
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
          <section className="results-report__section results-report__section--overview results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 pt-5 pb-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)] sm:px-6 sm:pt-6 sm:pb-6">
            <div className="results-report__section-heading">
              <h3>{summarySection.title}</h3>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)] lg:items-start">
              <article className="rounded-[22px] border border-[rgba(17,138,178,0.14)] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.98))] px-5 py-5 shadow-[0_18px_46px_-40px_rgba(17,138,178,0.42)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Glavni obrazac</p>
                <p className="mt-3 text-[15px] leading-7 text-slate-700">{summarySection.body}</p>
              </article>

              <article className="rounded-[22px] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,250,252,0.98))] px-5 py-5 shadow-[0_22px_48px_-42px_rgba(15,23,42,0.34)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {summarySection.overall.label}
                    </p>
                    <p className="mt-4 whitespace-nowrap text-[clamp(1.9rem,3vw,2.9rem)] font-semibold leading-none tracking-[-0.04em] text-slate-900">
                      {renderSafranInterpretationValue(
                        summarySection.overall.score,
                        summarySection.overall.maxPossible,
                      )}
                    </p>
                  </div>
                  <span className={getSafranBandPillClassName()}>
                    {summarySection.overall.helper}
                  </span>
                </div>
                {summarySection.overall.summary ? (
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {summarySection.overall.summary}
                  </p>
                ) : null}
              </article>
            </div>
          </section>

          <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.82)] bg-[rgba(255,255,255,0.98)] px-5 pt-5 pb-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6 sm:pt-6 sm:pb-6">
            <div className="results-report__section-heading">
              <h3>{domainsSection.title}</h3>
            </div>
            <div className="stack-sm">
              {domainsSection.rows.map((row) => (
                <article
                  key={row.scoreKey}
                  className="rounded-[20px] border border-[rgba(226,232,240,0.95)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] px-4 py-4 shadow-[0_16px_34px_-36px_rgba(15,23,42,0.45)] sm:px-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-[1rem] font-semibold text-slate-900">{row.label}</h4>
                      <p className="mt-2">
                        <span className={getSafranBandPillClassName()}>{row.helper}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900">
                        {renderSafranInterpretationValue(row.score, row.maxPossible)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-2.5 overflow-hidden rounded-full bg-[rgba(226,232,240,0.88)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(17,138,178,0.72),rgba(17,138,178,0.28))]"
                        style={{ width: `${getSafranVisualScoreWidth(row.score, row.maxPossible)}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{row.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(17,138,178,0.16)] bg-[linear-gradient(180deg,rgba(246,251,253,0.98),rgba(255,255,255,1))] px-5 pt-5 pb-5 shadow-[0_18px_42px_-40px_rgba(17,138,178,0.24)] sm:px-6 sm:pt-6 sm:pb-6">
            <div className="results-report__section-heading">
              <h3>{signalsSection.title}</h3>
            </div>
            <article className="rounded-[20px] border border-[rgba(148,163,184,0.14)] bg-[rgba(255,255,255,0.84)] px-4 py-4 shadow-[0_16px_34px_-36px_rgba(15,23,42,0.3)] sm:px-5">
              {signalsSection.body ? (
                <p className="text-sm leading-7 text-slate-700">{signalsSection.body}</p>
              ) : null}
              {signalsSection.segments && signalsSection.segments.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  {signalsSection.segments.map((segment) => (
                    <section
                      key={segment.label}
                      className="rounded-[16px] border border-[rgba(148,163,184,0.14)] bg-[rgba(248,250,252,0.88)] px-4 py-3"
                    >
                      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {segment.label}
                      </h4>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{segment.body}</p>
                    </section>
                  ))}
                </div>
              ) : null}
              {signalsSection.items.length > 0 ? (
                <div className="mt-4 rounded-[16px] border border-[rgba(148,163,184,0.14)] bg-[rgba(248,250,252,0.88)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Obrati pažnju</p>
                  <ul className="results-insight-list mt-3 text-sm text-slate-600">
                    {signalsSection.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          </section>

          <section className="results-report__section results-report__panel rounded-[22px] border border-[rgba(226,232,240,0.82)] bg-[rgba(248,250,252,0.76)] px-5 pt-5 pb-5 shadow-[0_12px_28px_-32px_rgba(15,23,42,0.24)] sm:px-6">
            <div className="results-report__section-heading">
              <h3>{readingGuideSection.title}</h3>
            </div>
            <ul className="results-insight-list text-sm text-slate-600">
              {readingGuideSection.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(17,138,178,0.16)] bg-[linear-gradient(180deg,rgba(247,251,253,0.98),rgba(255,255,255,1))] px-5 pt-5 pb-5 shadow-[0_22px_48px_-42px_rgba(17,138,178,0.28)] sm:px-6 sm:pt-6 sm:pb-6">
            <div className="results-report__section-heading">
              <h3>{nextStepSection.title}</h3>
            </div>
            {nextStepSection.items ? (
              <ul className="results-insight-list">
                {nextStepSection.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <>
                {nextStepSection.body ? (
                  <p className="results-report__section-body">{nextStepSection.body}</p>
                ) : null}
                {nextStepSection.ctaLabel ? (
                  <div className="pt-2">
                    <span className="inline-flex items-center rounded-full border border-[rgba(17,138,178,0.18)] bg-[rgba(17,138,178,0.08)] px-4 py-2 text-sm font-semibold text-[#0f5d75] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                      {nextStepSection.ctaLabel}
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SafranHrReportSummary({
  completedAt,
  organizationName,
  participantName,
  report,
}: {
  completedAt?: string | null;
  organizationName?: string | null;
  participantName?: string | null;
  report: SafranHrReportV1;
}) {
  const display = resolveSafranHrReportDisplay(report);

  if (!display) {
    return renderReportFallbackCard(
      "SAFRAN HR izvještaj nije dostupan",
      "HR snapshot postoji, ali njegov shape ne odgovara očekivanom SAFRAN HR contractu.",
    );
  }

  const primaryMetaCount = [participantName, organizationName].filter(Boolean).length;

  return (
    <div className="results-report stack-md">
      <section className="results-report__hero border border-slate-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,251,0.96))] px-5 py-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)] sm:px-6 sm:py-5">
        <div className="results-report__hero-copy gap-2.5">
          <p className="results-report__eyebrow text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {display.header.eyebrow}
          </p>
          <h2>{display.header.title}</h2>
          <p className="results-report__section-body text-[15px] text-slate-600">
            {display.header.subtitle}
          </p>
          <p className="inline-flex w-fit items-center rounded-full border border-[rgba(15,23,42,0.12)] bg-[rgba(248,250,252,0.9)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            Namijenjeno HR-u
          </p>

          <div className="results-report__hero-meta-wrap">
            <dl className="results-report__hero-meta">
              {participantName ? (
                <div className={`${primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"} border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]`}>
                  <dt>Kandidat</dt>
                  <dd>{participantName}</dd>
                </div>
              ) : null}
              {organizationName ? (
                <div className={`${primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"} border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]`}>
                  <dt>Organizacija</dt>
                  <dd>{organizationName}</dd>
                </div>
              ) : null}
              <div className="results-report__hero-meta-item results-report__hero-meta-item--wide border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]">
                <dt>Završeno</dt>
                <dd>{formatCompletedAt(completedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.executiveSummary.title}</h3>
        </div>
        <p className="results-report__section-body text-[15px] leading-7 text-slate-700">
          {display.executiveSummary.summary}
        </p>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>Kognitivni signali</h3>
        </div>
        <div className="stack-sm">
          {display.cognitiveSignals.map((signal) => (
            <article
              key={signal.key}
              className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4"
            >
              <h4 className="text-[1rem] font-semibold text-slate-900">{signal.label}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-700">{signal.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>Tačke opreza</h3>
        </div>
        <div className="stack-sm">
          {display.pointsOfCaution.map((item) => (
            <article
              key={`${item.signal}-${item.howToCheck}`}
              className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4"
            >
              <h4 className="text-[1rem] font-semibold text-slate-900">{item.signal}</h4>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Zašto je važno
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.whyItMatters}</p>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Kako provjeriti
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.howToCheck}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>Preporučena intervju pitanja</h3>
        </div>
        <div className="stack-sm">
          {display.interviewQuestions.map((item) => (
            <article
              key={`${item.category}-${item.question}`}
              className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.category}
              </p>
              <h4 className="mt-3 text-[1rem] font-semibold text-slate-900">{item.question}</h4>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Šta slušati u odgovoru
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.whatToListenFor}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>Onboarding smjernice</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {display.onboardingGuidance.map((group) => (
            <article
              key={group.key}
              className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4"
            >
              <h4 className="text-[1rem] font-semibold text-slate-900">{group.label}</h4>
              <ul className="results-insight-list mt-3 text-sm text-slate-700">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>Interpretacijska ograničenja</h3>
        </div>
        <ul className="results-insight-list text-sm text-slate-700">
          {display.interpretationLimits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MwmsHrReportSummary({
  completedAt,
  organizationName,
  participantName,
  report,
}: {
  completedAt?: string | null;
  organizationName?: string | null;
  participantName?: string | null;
  report: MwmsHrReportV1;
}) {
  const display = resolveMwmsHrReportDisplay(report);

  if (!display) {
    return renderReportFallbackCard(
      "MWMS HR izvještaj nije dostupan",
      "HR snapshot postoji, ali njegov shape ne odgovara očekivanom MWMS HR contractu.",
    );
  }

  const primaryMetaCount = [participantName, organizationName].filter(Boolean).length;

  return (
    <div className="results-report stack-md">
      <section className="results-report__hero border border-slate-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,251,0.96))] px-5 py-5 shadow-[0_18px_38px_rgba(15,23,42,0.06)] sm:px-6 sm:py-5">
        <div className="results-report__hero-copy gap-2.5">
          <p className="results-report__eyebrow text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {display.header.eyebrow}
          </p>
          <h2>{display.header.title}</h2>
          <p className="results-report__section-body text-[15px] text-slate-600">
            {display.header.subtitle}
          </p>
          <p className="inline-flex w-fit items-center rounded-full border border-[rgba(15,23,42,0.12)] bg-[rgba(248,250,252,0.9)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            Namijenjeno HR-u
          </p>

          <div className="results-report__hero-meta-wrap">
            <dl className="results-report__hero-meta">
              {participantName ? (
                <div className={`${primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"} border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]`}>
                  <dt>Kandidat</dt>
                  <dd>{participantName}</dd>
                </div>
              ) : null}
              {organizationName ? (
                <div className={`${primaryMetaCount === 1 ? "results-report__hero-meta-item results-report__hero-meta-item--wide" : "results-report__hero-meta-item"} border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]`}>
                  <dt>Organizacija</dt>
                  <dd>{organizationName}</dd>
                </div>
              ) : null}
              <div className="results-report__hero-meta-item results-report__hero-meta-item--wide border border-[rgba(148,163,184,0.18)] bg-[rgba(255,255,255,0.78)]">
                <dt>Završeno</dt>
                <dd>{formatCompletedAt(completedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.sections.motivationProfile}</h3>
        </div>
        <p className="results-report__section-body text-[15px] leading-7 text-slate-700">
          Deterministički MWMS scorevi ostaju prikazani kao profil motivacijskih izvora, bez ukupne ocjene.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {display.dimensions.map((dimension) => (
            <article
              key={dimension.code}
              className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-[1rem] font-semibold text-slate-900">{dimension.label}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{dimension.meaning}</p>
                </div>
                <span className="rounded-full border border-[rgba(15,23,42,0.12)] bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {dimension.bandLabel}
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span>{display.scaleLabel}</span>
                  <span>{dimension.scoreLabel}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200/80" role="img" aria-label={`${dimension.label} ${dimension.scoreLabel}`}>
                  <span
                    className="block h-full rounded-full bg-[linear-gradient(90deg,#94a3b8,#0f766e)]"
                    style={{ width: `${Math.max(dimension.width, 4)}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.sections.keyMotivationalDrivers}</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {display.keyMotivationalDrivers.map((item) => (
            <article key={`${item.title}-${item.evidence}`} className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4">
              <h4 className="text-[1rem] font-semibold text-slate-900">{item.title}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.evidence}</p>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                HR implikacija
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.hrImplication}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.sections.potentialFrictionPoints}</h3>
        </div>
        <div className="stack-sm">
          {display.potentialFrictionPoints.map((item) => (
            <article key={`${item.signal}-${item.howToCheck}`} className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4">
              <h4 className="text-[1rem] font-semibold text-slate-900">{item.signal}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.whyItMayMatter}</p>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Kako provjeriti
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.howToCheck}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.sections.workContextHypotheses}</h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {display.workContextHypotheses.map((item) => (
            <article key={`${item.context}-${item.hypothesis}`} className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.context}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.hypothesis}</p>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Provjera u razgovoru
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.verification}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.sections.managerSupportGuidance}</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {display.managerSupportGuidance.map((item) => (
            <article key={`${item.focus}-${item.recommendation}`} className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.focus}
              </p>
              <h4 className="mt-3 text-[1rem] font-semibold text-slate-900">{item.recommendation}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.rationale}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.sections.interviewQuestions}</h3>
        </div>
        <div className="stack-sm">
          {display.interviewQuestions.map((item, index) => (
            <article key={`${item.question}-${index}`} className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Pitanje {index + 1}
              </p>
              <h4 className="mt-3 text-[1rem] font-semibold text-slate-900">{item.question}</h4>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Procjenjuje
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.evaluates}</p>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Šta slušati u odgovoru
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.whatToListenFor}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.28)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.sections.onboardingRecommendations}</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {display.onboardingRecommendations.map((item) => (
            <article key={`${item.phase}-${item.recommendation}`} className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.86)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.phase}
              </p>
              <h4 className="mt-3 text-[1rem] font-semibold text-slate-900">{item.recommendation}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.why}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="results-report__section results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(248,250,252,0.74)] px-5 py-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.22)] sm:px-6">
        <div className="results-report__section-heading">
          <h3>{display.sections.notes}</h3>
        </div>
        <p className="results-report__section-body text-sm leading-6 text-slate-600">
          {display.interpretationNote}
        </p>
        <ul className="results-insight-list mt-3 text-sm text-slate-600">
          {display.decisionSupportNote.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
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

function scrollReportSectionIntoView(target: HTMLElement | null) {
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function IpipNeo120ParticipantReportSections({
  report,
}: {
  report: IpipNeo120ParticipantReportV1;
}) {
  const [activeDomainCode, setActiveDomainCode] = useState<string | null>(null);
  const overviewSectionRef = useRef<HTMLElement | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTargetRef = useRef<"details" | "overview" | null>(null);
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
  const profileOverview = buildParticipantIpipProfileOverview(report);
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
    if (pendingScrollTargetRef.current === null) {
      return;
    }

    const scrollTarget = pendingScrollTargetRef.current;
    pendingScrollTargetRef.current = null;

    requestAnimationFrame(() => {
      if (scrollTarget === "details") {
        scrollReportSectionIntoView(detailPanelRef.current);
        return;
      }

      scrollReportSectionIntoView(overviewSectionRef.current);
    });
  }, [activeDomainCode]);

  const handleCloseDomainDetails = () => {
    pendingScrollTargetRef.current = "overview";
    setActiveDomainCode(null);
  };

  const handleToggleDomainDetails = (domainCode: string) => {
    pendingScrollTargetRef.current =
      activeDomainCode === domainCode ? "overview" : "details";
    setActiveDomainCode((currentDomainCode) =>
      currentDomainCode === domainCode ? null : domainCode,
    );
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
          {profileOverview.badges.map((badge) => (
            <span
              key={badge.text}
              className="inline-flex items-center rounded-full px-[11px] py-[7px] text-[12.5px] font-bold leading-none tracking-[-0.01em]"
              style={{
                background: badge.backgroundColor,
                border: `1px solid ${badge.borderColor}`,
                color: "#073b4c",
              }}
            >
              {badge.text}
            </span>
          ))}
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
          {profileOverview.patterns.map((pattern) => (
            <div
              key={pattern.title}
              className="min-h-[190px] rounded-[20px] border border-slate-200/85 bg-slate-50/70 p-5 shadow-none"
            >
              <div className="mb-4 h-1 w-12 rounded-full" style={{ background: pattern.accentColor }} />
              <h4 className="text-[15px] font-extrabold leading-[1.25] tracking-[-0.01em] text-slate-950">
                {pattern.title}
              </h4>
              <p className="mt-2.5 text-[14px] leading-[1.65] text-slate-600">
                {pattern.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        ref={overviewSectionRef}
        className="results-report__section results-report__section--dimensions stack-sm"
      >
        <div className="results-report__section-heading">
          <h3>Pregled domena</h3>
          <p className="results-report__section-note">
            Skala pokazuje koliko je svaki domen izražen u tvom profilu.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
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
                        aria-expanded={isActive}
                        className={
                          isActive
                            ? "inline-flex items-center rounded-full border border-[rgba(14,116,144,0.28)] bg-[#EAF7F7] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#155E75] transition-colors hover:border-[rgba(14,116,144,0.38)] hover:bg-[rgba(14,116,144,0.12)]"
                            : "inline-flex items-center rounded-full border border-[#118ab2]/45 bg-[rgba(17,138,178,0.10)] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#073b4c] transition-colors hover:border-[#118ab2]/70 hover:bg-[rgba(17,138,178,0.16)]"
                        }
                        onClick={() => handleToggleDomainDetails(domain.domain_code)}
                      >
                        {isActive ? "Zatvori detalje" : "Prikaži detalje"}
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
                    className="inline-flex items-center rounded-full border border-[rgba(14,116,144,0.28)] bg-[#EAF7F7] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#155E75] transition-colors hover:border-[rgba(14,116,144,0.38)] hover:bg-[rgba(14,116,144,0.12)]"
                    onClick={handleCloseDomainDetails}
                  >
                    Zatvori detalje
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
                    Poddimenzije pokazuju od čega se{" "}
                    <ParticipantIpipInlineNarrativeTerm
                      label={formatParticipantIpipDomainLabel(activeDomain.label)}
                    />{" "}
                    sastoji.
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
                  className="inline-flex items-center rounded-full border border-[rgba(14,116,144,0.28)] bg-[#EAF7F7] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#155E75] transition-colors hover:border-[rgba(14,116,144,0.38)] hover:bg-[rgba(14,116,144,0.12)]"
                  onClick={handleCloseDomainDetails}
                >
                  Zatvori detalje
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

function IpipNeo120ParticipantReportV2Sections({
  report,
}: {
  report: IpipNeo120ParticipantReportV2;
}) {
  const workStyleParagraphs = report.work_style.paragraphs
    .map((paragraph) => sanitizeTechnicalReportText(paragraph))
    .filter((paragraph): paragraph is string => Boolean(paragraph));
  const [activeDomainCode, setActiveDomainCode] = useState<string | null>(null);
  const overviewSectionRef = useRef<HTMLElement | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTargetRef = useRef<"details" | "overview" | null>(null);
  const scaleMin = report.meta.scale_hint.min;
  const scaleMax = report.meta.scale_hint.max;
  const activeDomain =
    report.domains.find((domain) => domain.domain_code === activeDomainCode) ?? null;
  const radarDomains = getParticipantIpipRadarDomainsV2(report);
  const shouldRenderRadarSection = radarDomains.length === PARTICIPANT_IPIP_RADAR_DOMAIN_ORDER.length;

  useEffect(() => {
    if (pendingScrollTargetRef.current === null) {
      return;
    }

    const scrollTarget = pendingScrollTargetRef.current;
    pendingScrollTargetRef.current = null;

    requestAnimationFrame(() => {
      if (scrollTarget === "details") {
        scrollReportSectionIntoView(detailPanelRef.current);
        return;
      }

      scrollReportSectionIntoView(overviewSectionRef.current);
    });
  }, [activeDomainCode]);

  const handleSelectDomain = (domainCode: string) => {
    pendingScrollTargetRef.current =
      activeDomainCode === domainCode ? "overview" : "details";
    setActiveDomainCode((currentDomainCode) =>
      currentDomainCode === domainCode ? null : domainCode,
    );
  };

  return (
    <div className="results-report__closing stack-md">
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
          {report.summary.badges.map((badge) => (
            <span
              key={`${badge.label}-${badge.related_domains.join("-")}-${badge.related_facets.join("-")}`}
              className="inline-flex items-center rounded-full border border-[rgba(14,116,144,0.18)] bg-[rgba(14,116,144,0.08)] px-[11px] py-[7px] text-[12.5px] font-bold leading-none tracking-[-0.01em] text-[#073b4c]"
            >
              {badge.label}
            </span>
          ))}
        </div>
        <p className="mt-0 max-w-[760px] text-[15px] leading-[1.75] text-slate-700">
          {report.summary.overview}
        </p>
      </section>

      {shouldRenderRadarSection ? (
        <section className="results-report__section results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Vizuelni profil osobina</h3>
            <p className="results-report__section-note">
              Radar prikazuje pet glavnih domena na skali od 1 do 5.
            </p>
          </div>
          <div className="mx-auto w-full max-w-[560px]">
            <PersonalityRadarChart domains={radarDomains} className="h-[304px] sm:h-[300px]" />
          </div>
        </section>
      ) : null}

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Ključni obrasci u profilu</h3>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {report.key_patterns.map((pattern) => (
            <div
              key={pattern.title}
              className="rounded-[20px] border border-slate-200/85 bg-slate-50/70 p-5 shadow-none"
            >
              <div className="mb-4 h-1 w-12 rounded-full bg-[#155E75]" />
              <h4 className="text-[15px] font-extrabold leading-[1.25] tracking-[-0.01em] text-slate-950">
                {pattern.title}
              </h4>
              <p className="mt-2.5 text-[14px] leading-[1.65] text-slate-600">
                {pattern.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {workStyleParagraphs.length > 0 ? (
        <section className="results-report__section results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>{report.work_style.title}</h3>
          </div>
          <div className="results-report__section-body stack-xs">
            {workStyleParagraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph}`}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section
        ref={overviewSectionRef}
        className="results-report__section results-report__section--dimensions stack-sm"
      >
        <div className="results-report__section-heading">
          <h3>Pregled domena</h3>
          <p className="results-report__section-note">
            Skala koristi canonical score vrijednosti iz V2 report snapshot-a.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {report.domains.map((domain, index) => {
            const isActive = activeDomainCode === domain.domain_code;
            const bandPillClassName = getParticipantIpipBandPillClassName(domain.display_band);
            const bandAccentColor = getParticipantIpipBandAccentColor(domain.display_band);
            const domainMicroSummary =
              getParticipantIpipDomainMicroSummary(domain.domain_code) || domain.card_title;

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
                  className={`min-h-[150px] rounded-[22px] border border-slate-200/85 bg-white/95 p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.46)] ${
                    isActive ? "ring-2 ring-[#155E75]/30 border-[#155E75]/35 bg-white" : ""
                  }`}
                >
                  <div
                    className="mb-4 h-1 w-12 rounded-full"
                    style={{ background: bandAccentColor }}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-extrabold leading-[1.15] tracking-[-0.015em] text-slate-950">
                        {domain.participant_display_label}
                      </h4>
                      <p
                        className={`mt-2 inline-flex w-fit items-center rounded-full border px-2 py-1 text-[11px] font-bold leading-none ${bandPillClassName}`}
                      >
                        {domain.display_band_label}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full border border-slate-300/80 bg-slate-100/90 px-2 py-1 text-[12px] font-extrabold leading-none text-slate-900">
                      {formatDiscreetScore(domain.display_score)}/{scaleMax}
                    </span>
                  </div>

                  <p className="mt-3 text-[13px] font-semibold leading-[1.45] text-slate-500">
                    {domainMicroSummary}
                  </p>

                  <div className="mt-3">
                    <IpipNeo120ScoreBar
                      label={domain.participant_display_label}
                      score={domain.display_score}
                      min={scaleMin}
                      max={scaleMax}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <button
                      type="button"
                      aria-expanded={isActive}
                      className={
                        isActive
                          ? "inline-flex items-center rounded-full border border-[rgba(14,116,144,0.28)] bg-[#EAF7F7] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#155E75] transition-colors hover:border-[rgba(14,116,144,0.38)] hover:bg-[rgba(14,116,144,0.12)]"
                          : "inline-flex items-center rounded-full border border-[#118ab2]/45 bg-[rgba(17,138,178,0.10)] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#073b4c] transition-colors hover:border-[#118ab2]/70 hover:bg-[rgba(17,138,178,0.16)]"
                      }
                      onClick={() => handleSelectDomain(domain.domain_code)}
                    >
                      {isActive ? "Zatvori detalje" : "Prikaži detalje"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeDomain ? (
          <div
            ref={detailPanelRef}
            className="mt-5 overflow-hidden rounded-[28px] border border-slate-200/85 bg-white/95 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)]"
          >
            <div className="h-[5px] w-full bg-[#155E75]" />
            <div className="p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/75 pb-5">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                    DETALJ AKTIVNE DOMENE
                  </p>
                  <h4 className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.03em] text-slate-950">
                    {activeDomain.participant_display_label}
                  </h4>
                  <p className="mt-2 inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-bold leading-none text-slate-500">
                    {activeDomain.display_band_label}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full border border-slate-300/80 bg-slate-100/90 px-3 py-1.5 text-[13px] font-extrabold leading-none text-slate-900">
                  {formatDiscreetScore(activeDomain.display_score)}/{scaleMax}
                </span>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
                <div className="space-y-4">
                  <section>
                    <h5 className="text-[13px] font-extrabold text-[#073b4c]">
                      {activeDomain.card_title}
                    </h5>
                    <p className="mt-2 text-[15px] leading-[1.8] text-slate-600">
                      {activeDomain.summary}
                    </p>
                  </section>
                  <section>
                    <h5 className="text-[13px] font-extrabold text-[#073b4c]">
                      Praktični signal
                    </h5>
                    <p className="mt-2 text-[14px] leading-[1.7] text-slate-600">
                      {activeDomain.practical_signal}
                    </p>
                  </section>
                  <section>
                    <h5 className="text-[13px] font-extrabold text-[#073b4c]">
                      Refleksija
                    </h5>
                    <p className="mt-2 text-[14px] leading-[1.7] text-slate-600">
                      {activeDomain.candidate_reflection}
                    </p>
                  </section>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[18px] border border-[#06d6a0]/20 bg-[rgba(6,214,160,0.045)] p-4">
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
                    <h5 className="text-[13px] font-extrabold text-[#073b4c]">Tačke opreza</h5>
                    <ul className="mt-3 space-y-2">
                      {activeDomain.watchouts.map((item) => (
                        <li key={item} className="text-[13.5px] leading-[1.6] text-slate-600">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[18px] border border-[#118ab2]/20 bg-[rgba(17,138,178,0.045)] p-4">
                    <h5 className="text-[13px] font-extrabold text-[#073b4c]">
                      Razvojni fokus
                    </h5>
                    <p className="mt-3 text-[13.5px] leading-[1.6] text-slate-600">
                      {activeDomain.development_tip}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 border-t border-slate-200/75 pt-6">
                <h5 className="text-[16px] font-extrabold text-slate-950">Poddimenzije</h5>
                <p className="mt-1 text-[13px] leading-[1.5] text-slate-500">
                  Poddimenzije pokazuju od čega se{" "}
                  <ParticipantIpipInlineNarrativeTerm
                    label={activeDomain.participant_display_label}
                  />{" "}
                  sastoji.
                </p>
                <ol className="mt-5 grid list-none items-start gap-3 md:grid-cols-2">
                  {activeDomain.subdimensions.map((subdimension, index) => {
                    const facetAccentColor = getParticipantIpipFacetAccentColor(index);
                    const facetScorePercent = getVisualScoreWidth(
                      subdimension.score,
                      scaleMin,
                      scaleMax,
                    );

                    return (
                      <li
                        key={subdimension.facet_code}
                        className="self-start rounded-[18px] border border-slate-200/80 bg-slate-50/55 p-4"
                      >
                        <div
                          className="mb-3 h-1 w-10 rounded-full"
                          style={{ backgroundColor: facetAccentColor }}
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h6 className="text-[14px] font-extrabold leading-[1.25] text-slate-950">
                              {subdimension.participant_display_label}
                            </h6>
                            <p className="mt-2 inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[12px] font-bold leading-none text-slate-500">
                              {subdimension.band_label}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center rounded-full border border-slate-300/80 bg-white px-2 py-1 text-[12px] font-extrabold leading-none text-slate-900">
                            {formatDiscreetScore(subdimension.score)}/{scaleMax}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="relative h-2 rounded-full bg-slate-200/90">
                            <div
                              className="absolute left-0 top-0 h-2 rounded-full bg-[#118ab2]"
                              style={{ width: `${facetScorePercent}%` }}
                            />
                          </div>
                        </div>
                        <h6 className="mt-4 text-[13px] font-extrabold text-[#073b4c]">
                          {subdimension.card_title}
                        </h6>
                        <p className="mt-2 text-[13.5px] leading-[1.55] text-slate-600">
                          {subdimension.summary}
                        </p>
                        <p className="mt-2 text-[13px] leading-[1.55] text-slate-500">
                          {subdimension.practical_signal}
                        </p>
                        <p className="mt-2 text-[13px] leading-[1.55] text-slate-500">
                          {subdimension.candidate_reflection}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="mt-7 flex justify-end border-t border-slate-200/75 pt-5">
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-[rgba(14,116,144,0.28)] bg-[#EAF7F7] px-3.5 py-2 text-[12.5px] font-extrabold leading-none text-[#155E75] transition-colors hover:border-[rgba(14,116,144,0.38)] hover:bg-[rgba(14,116,144,0.12)]"
                  onClick={() => {
                    pendingScrollTargetRef.current = "overview";
                    setActiveDomainCode(null);
                  }}
                >
                  Zatvori detalje
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
            <div className="mb-3.5 h-1 w-14 rounded-full bg-[#06d6a0]" />
            <h4 className="mb-3 text-[13px] font-extrabold leading-[1.2] text-slate-950">Snage</h4>
            <ul className="grid gap-3 md:grid-cols-2">
              {report.strengths.map((item) => (
                <li key={item.title} className="rounded-[14px] bg-white/70 p-4">
                  <h5 className="text-[13.5px] font-extrabold text-slate-900">{item.title}</h5>
                  <p className="mt-2 text-[13.5px] leading-[1.6] text-slate-600">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-[18px] shadow-none">
              <div className="mb-3.5 h-1 w-14 rounded-full bg-[#ffd166]" />
              <h4 className="mb-3 text-[13px] font-extrabold leading-[1.2] text-slate-950">
                Tačke opreza
              </h4>
              <ul className="space-y-3">
                {report.watchouts.map((item) => (
                  <li key={item.title} className="rounded-[14px] bg-white/70 p-4">
                    <h5 className="text-[13.5px] font-extrabold text-slate-900">{item.title}</h5>
                    <p className="mt-2 text-[13.5px] leading-[1.6] text-slate-600">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-[18px] shadow-none">
              <div className="mb-3.5 h-1 w-14 rounded-full bg-[#118ab2]" />
              <h4 className="mb-3 text-[13px] font-extrabold leading-[1.2] text-slate-950">
                Preporuke
              </h4>
              <ul className="space-y-3">
                {report.development_recommendations.map((item) => (
                  <li key={item.title} className="rounded-[14px] bg-white/70 p-4">
                    <h5 className="text-[13.5px] font-extrabold text-slate-900">{item.title}</h5>
                    <p className="mt-2 text-[13.5px] leading-[1.6] text-slate-600">
                      {item.description}
                    </p>
                    <p className="mt-2 text-[13px] font-semibold leading-[1.55] text-[#155E75]">
                      {item.action}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-slate-200/70 bg-slate-50/70 px-5 py-4">
        <h3 className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
          {report.interpretation_note.title}
        </h3>
        <p className="mt-2 text-[12.5px] leading-[1.6] text-slate-500">
          {report.interpretation_note.text}
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
          <h3>Ključni HR signali</h3>
        </div>
        <ul className="results-bullet-list">
          {report.key_hr_signals.map((signal) => (
            <li key={signal.title}>
              <strong>{signal.title}:</strong> {signal.evidence} {signal.hr_implication}
            </li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Šta vrijedi provjeriti</h3>
        </div>
        <ul className="results-bullet-list">
          {report.verification_focus.map((item) => (
            <li key={item.area}>
              <strong>{item.area}:</strong> {item.why_it_matters} {item.how_to_check}
            </li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Strukturirana intervju pitanja</h3>
        </div>
        <ol className="results-score-overview">
          {report.interview_questions.map((item, index) => (
            <li key={`${index + 1}-${item.question}`} className="results-score-overview__item">
              <div className="results-score-overview__header">
                <strong>{item.question}</strong>
              </div>
              <p className="results-dimension-card__summary">
                <strong>Provjerava:</strong> {item.evaluates}
              </p>
              <p className="results-dimension-card__summary">
                <strong>Dobar odgovor može pokazati:</strong> {item.what_good_answer_may_show}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Snage i mogući overuse rizici</h3>
        </div>
        <ol className="results-dimension-list">
          {report.strengths_and_overuse_risks.map((item) => (
            <li key={item.trait_or_pattern} className="results-dimension-card">
              <div className="results-dimension-card__header">
                <div className="results-dimension-card__title">
                  <h4>{item.trait_or_pattern}</h4>
                </div>
              </div>
              <section className="results-dimension-card__details stack-xs">
                <div className="results-dimension-card__detail-block">
                  <h5>Moguće snage</h5>
                  <ul className="results-bullet-list">
                    {item.possible_strengths.map((strength) => (
                      <li key={strength}>{strength}</li>
                    ))}
                  </ul>
                </div>
                <div className="results-dimension-card__detail-block">
                  <h5>Mogući overuse rizici</h5>
                  <ul className="results-bullet-list">
                    {item.possible_overuse_risks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </div>
                <div className="results-dimension-card__detail-block">
                  <h5>HR handling tip</h5>
                  <p>{item.hr_handling_tip}</p>
                </div>
              </section>
            </li>
          ))}
        </ol>
      </section>

      <section className="results-report__section results-report__section--dimensions stack-sm">
        <div className="results-report__section-heading">
          <h3>Pregled domena</h3>
        </div>
        <ol className="results-dimension-list">
          {report.domain_overview.map((domain) => (
            <li key={domain.domain_name} className="results-dimension-card">
              <div className="results-dimension-card__header">
                <div className="results-dimension-card__title">
                  <h4>{domain.domain_name}</h4>
                  <p className="results-dimension-card__helper">
                    {formatNeoHrBandLabel(domain.score_label_or_band)}
                  </p>
                </div>
              </div>
              <p className="results-dimension-card__summary">{domain.concise_meaning}</p>
              <section className="results-dimension-card__details stack-xs">
                <div className="results-dimension-card__detail-block">
                  <h5>HR relevantnost</h5>
                  <p>{domain.hr_relevance}</p>
                </div>
                <div className="results-dimension-card__detail-block">
                  <h5>Provjera u intervjuu</h5>
                  <p>{domain.check_in_interview}</p>
                </div>
                {domain.top_facets.length > 0 ? (
                  <div className="results-dimension-card__detail-block">
                    <h5>Najrelevantnije facete</h5>
                    <ol className="results-score-overview" aria-label={`Facete za ${domain.domain_name}`}>
                      {domain.top_facets.map((facet) => (
                        <li key={facet.facet_name} className="results-score-overview__item">
                          <div className="results-score-overview__header">
                            <strong>{facet.facet_name}</strong>
                            <span>{formatNeoHrBandLabel(facet.score_label_or_band)}</span>
                          </div>
                          <p className="results-dimension-card__summary">{facet.relevance}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </section>
            </li>
          ))}
        </ol>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Onboarding i management smjernice</h3>
        </div>
        <ul className="results-bullet-list">
          {report.onboarding_and_management_guidance.map((item) => (
            <li key={item.recommendation}>
              <strong>{item.recommendation}:</strong> {item.why} {item.first_30_days_application}
            </li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Napomene za timski kontekst</h3>
        </div>
        <ul className="results-bullet-list">
          {report.team_fit_notes.map((item) => (
            <li key={item.fit_condition}>
              <strong>{item.fit_condition}:</strong> {item.may_work_well_when} {item.watchout}
            </li>
          ))}
        </ul>
      </section>

      <section className="results-report__section results-report__panel card stack-sm">
        <div className="results-report__section-heading">
          <h3>Kako koristiti ovaj izvještaj</h3>
        </div>
        <ul className="results-bullet-list">
          {report.decision_support_note.map((item) => (
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
  testSlug,
  testName,
  results,
  reportState,
}: CompletedAssessmentSummaryProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const hasResults = results !== null;
  const ipcUiLocale = normalizeIpcUiLocale(locale);
  const reportRenderer = selectReportRenderer(reportState);
  const ipipNeo120ParticipantV1Report =
    reportRenderer.kind === "ipip_neo_120_participant_v1" ? reportRenderer.report : null;
  const ipipNeo120ParticipantV2Report =
    reportRenderer.kind === "ipip_neo_120_participant_v2" ? reportRenderer.report : null;
  const ipipNeo120ParticipantReport =
    ipipNeo120ParticipantV1Report ?? ipipNeo120ParticipantV2Report;
  const ipipNeo120HrReport =
    reportRenderer.kind === "ipip_neo_120_hr" ? reportRenderer.report : null;
  const bigFiveParticipantReport =
    reportRenderer.kind === "big_five_participant_v1" ? reportRenderer.report : null;
  const bigFiveHrReport = reportRenderer.kind === "big_five_hr_v1" ? reportRenderer.report : null;
  const bigFiveReport = bigFiveParticipantReport ?? bigFiveHrReport;
  const ipcParticipantReport =
    reportRenderer.kind === "ipc_participant_v1" ? reportRenderer.report : null;
  const ipcHrReport = reportRenderer.kind === "ipc_hr_v1" ? reportRenderer.report : null;
  const mwmsHrReport = reportRenderer.kind === "mwms_hr_report_v1" ? reportRenderer.report : null;
  const mwmsParticipantReport =
    reportRenderer.kind === "mwms_participant_report_v1" ? reportRenderer.report : null;
  const safranParticipantAiReport =
    reportRenderer.kind === "safran_participant_ai_report_v1" ? reportRenderer.report : null;
  const safranHrReport =
    reportRenderer.kind === "safran_hr_report_v1" ? reportRenderer.report : null;
  const shouldShowBigFiveHrFallbackCard = Boolean(bigFiveHrReport) && !ipipNeo120HrReport;
  const shouldShowRawResultsPreview =
    !ipipNeo120ParticipantReport &&
    !ipipNeo120HrReport &&
    !safranParticipantAiReport &&
    !safranHrReport &&
    !mwmsHrReport;

  const maxRawScore =
    results && results.dimensions.length > 0
      ? Math.max(...results.dimensions.map((dimension) => dimension.rawScore), 0)
      : 0;
  const isMwmsResults = results
    ? isMwmsDimensionSet(results.dimensions.map((dimension) => dimension.dimension))
    : false;
  const shouldShowGenericDimensionCards =
    Boolean(results) &&
    Boolean(bigFiveParticipantReport) &&
    !ipipNeo120ParticipantReport &&
    !isMwmsResults;

  const reportDimensionsByKey = getReportDimensionsByKey(bigFiveReport);

  const dimensionCards: DimensionViewModel[] =
    results?.dimensions.map((dimension) => {
      const reportDimension = reportDimensionsByKey.get(dimension.dimension);

      return {
        key: dimension.dimension,
        label: formatDimensionLabel(dimension.dimension),
        helperLabel: isMwmsResults ? null : getDimensionHelperLabel(dimension.dimension),
        score: dimension.rawScore,
        scoreLabel: isMwmsResults
          ? formatMwmsScoreLabel(dimension.rawScore)
          : formatScoreLabel(dimension.rawScore),
        shortInterpretation: reportDimension?.summary ?? LEGACY_DIMENSION_DETAIL_UNAVAILABLE,
        scoreWidth: isMwmsResults
          ? getMwmsScoreWidth(dimension.rawScore)
          : maxRawScore > 0
            ? Math.max((dimension.rawScore / maxRawScore) * 100, 10)
            : 0,
      };
    }) ?? [];

  const recommendations = bigFiveReport?.development_recommendations ?? [];
  const scoreRangeLabel = isMwmsResults ? "Skala 1–7" : maxRawScore > 0 ? `0–${maxRawScore} bodova` : null;
  const mwmsResultsNote = isMwmsResults
    ? "Ovaj rezultat prikazuje tvoj motivacijski profil u radnom kontekstu i služi kao uvid, ne kao presuda."
    : null;
  const shouldShowMwmsAiReport = isMwmsResults && hasResults && Boolean(mwmsParticipantReport);
  const shouldShowMwmsGuidance = isMwmsResults && hasResults && !mwmsParticipantReport;
  const primaryMetaCount = [participantName, organizationName].filter(Boolean).length;
  const hasScoredDimensions = dimensionCards.length > 0;
  const shouldShowNarrativePending =
    !isMwmsResults &&
    (reportState === null ||
      reportState.status === "queued" ||
      reportState.status === "processing");
  const shouldShowNarrativeFailed =
    !isMwmsResults &&
    (reportState?.status === "failed" || reportState?.status === "unavailable");
  const shouldShowResultsUnavailable = !hasResults;
  const shouldShowReadyReportShapeMismatch =
    !isMwmsResults && reportRenderer.kind === "shape_mismatch";
  const shouldShowUnsupportedReadySignal =
    !isMwmsResults && reportRenderer.kind === "unsupported_signal";
  const reportHeroTitle = ipipNeo120ParticipantReport
    ? "Tvoj profil ličnosti"
    : isMwmsResults
      ? "Radna motivacija"
      : testName ?? "Rezultati procjene";
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
    if (safranHrReport) {
      return (
        <SafranHrReportSummary
          completedAt={completedAt}
          organizationName={organizationName}
          participantName={participantName}
          report={safranHrReport}
        />
      );
    }

    return (
      <SafranV1ResultsSummary
        completedAt={completedAt}
        organizationName={organizationName}
        participantName={participantName}
        testName={testName}
        results={results}
        aiReport={safranParticipantAiReport}
      />
    );
  }

  if (mwmsHrReport) {
    return (
      <MwmsHrReportSummary
        completedAt={completedAt}
        organizationName={organizationName}
        participantName={participantName}
        report={mwmsHrReport}
      />
    );
  }

  return (
    <div className="results-report stack-md">
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

          {mwmsResultsNote ? (
            <p className="results-report__section-note">{mwmsResultsNote}</p>
          ) : null}
        </div>

      </section>

      {shouldShowMwmsGuidance ? (
        <section className="results-report__section results-report__section--insights results-report__panel card stack-sm">
          <div className="results-report__section-heading">
            <h3>Kako čitati profil motivacije</h3>
          </div>
          <ul className="results-bullet-list">
            {MWMS_PROFILE_READING_GUIDANCE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {shouldShowMwmsAiReport && mwmsParticipantReport ? (
        <section className="results-report__section results-report__section--insights results-report__panel rounded-[24px] border border-[rgba(17,138,178,0.18)] bg-[linear-gradient(180deg,rgba(243,250,252,0.98),rgba(255,255,255,1))] px-5 pt-5 pb-5 shadow-[0_22px_48px_-44px_rgba(15,23,42,0.24)] sm:px-6 sm:pt-6 sm:pb-6">
          <div className="results-report__section-heading">
            <p className="results-report__section-kicker text-[11px] uppercase tracking-[0.24em] text-slate-500">
              PARTICIPANT INSIGHT
            </p>
            <h3>Sažetak motivacijskog profila</h3>
          </div>

          <div className="stack-sm">
            <p className="text-[18px] font-semibold leading-[1.45] text-slate-900 sm:text-[19px]">
              {mwmsParticipantReport.summary.headline}
            </p>
            <p className="max-w-3xl text-[14px] leading-[1.68] text-slate-600">
              {mwmsParticipantReport.summary.paragraph}
            </p>
          </div>
        </section>
      ) : null}

      {shouldShowNarrativePending ? (
        <ReportGenerationLoadingScreen
          status={reportState?.status}
          testSlug={testSlug}
          testName={testName}
          participantName={participantName}
        />
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
          <section
            className={
              isMwmsResults
                ? "results-report__section results-report__section--overview results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.92)] bg-[rgba(255,255,255,0.99)] px-5 pt-5 pb-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.28)] sm:px-6 sm:pt-6 sm:pb-6"
                : "results-report__section results-report__section--overview results-report__panel card stack-sm"
            }
          >
            <div className="results-report__section-heading">
              <h3>{isMwmsResults ? "Profil motivacije" : "Pregled dimenzija"}</h3>
              {scoreRangeLabel ? (
                <div className="space-y-1">
                  <p className="results-report__section-note">{scoreRangeLabel}</p>
                  {isMwmsResults ? (
                    <p className="text-[13px] leading-[1.6] text-slate-500">
                      Viša vrijednost znači da je taj izvor motivacije prisutniji u tvom radnom ponašanju.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {dimensionCards.length > 0 ? (
              <ol
                className={
                  isMwmsResults
                    ? "results-score-overview grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-6"
                    : "results-score-overview"
                }
                aria-label={isMwmsResults ? "Profil motivacije po subskalama" : "Pregled rezultata po dimenzijama"}
              >
                {dimensionCards.map((dimension, index) => (
                  <li
                    key={dimension.key}
                    className={
                      isMwmsResults
                        ? `results-score-overview__item rounded-[18px] border border-[rgba(226,232,240,0.86)] bg-[rgba(248,250,252,0.72)] px-4 py-[18px] sm:px-[18px] sm:py-5 ${
                            index === 0 ? "!pt-[18px] sm:!pt-5" : ""
                          }`
                        : "results-score-overview__item"
                    }
                  >
                    <div
                      className={
                        isMwmsResults
                          ? "flex items-start justify-between gap-5"
                          : "results-score-overview__header"
                      }
                    >
                      <div className="min-w-0 space-y-2.5 pr-2">
                        <strong className="block text-[15px] leading-[1.45] text-slate-900">
                          {dimension.label}
                        </strong>
                        {isMwmsResults ? (
                          <p className="text-[11.5px] leading-[1.45] text-slate-500">
                            {getMwmsDimensionMicroDescription(dimension.key)}
                          </p>
                        ) : null}
                        {isMwmsResults ? (
                          <span
                            className={`inline-flex w-fit max-w-full items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase ${getMwmsBandPillClassName(dimension.score)}`}
                          >
                            {getMwmsBandLabel(dimension.score)}
                          </span>
                        ) : null}
                      </div>
                      <div className={isMwmsResults ? "shrink-0 pr-1 text-right" : ""}>
                        <span className="text-[14px] font-medium text-slate-700">
                          {dimension.scoreLabel}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`results-score-overview__bar${isMwmsResults ? " mt-[18px]" : ""}`}
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
                  const reportDimension = reportDimensionsByKey.get(dimension.key);

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
                        {dimension.shortInterpretation}
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
                          {reportDimension ? (
                            [
                              ["Radni stil", reportDimension.work_style],
                              ["Sažetak dimenzije", reportDimension.summary],
                              ["Tačke opreza", reportDimension.risks],
                              ["Razvojni fokus", reportDimension.development_focus],
                            ].map(([heading, body]) => (
                              <section key={heading} className="results-dimension-card__detail-block">
                                <h5>{heading}</h5>
                                <p>{body}</p>
                              </section>
                            ))
                          ) : (
                            <section className="results-dimension-card__detail-block">
                              <h5>Detalji</h5>
                              <p>{LEGACY_DIMENSION_DETAIL_UNAVAILABLE}</p>
                            </section>
                          )}
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

      {shouldShowMwmsGuidance ? (
        <div className="results-report__closing stack-md">
          <section className="results-report__section results-report__section--conclusion results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Napomena o interpretaciji</h3>
            </div>
            <p className="results-report__section-body">
              Ovaj rezultat ne predstavlja procjenu vrijednosti osobe niti samostalnu osnovu za odluku o zapošljavanju. Najkorisniji je kada se poveže sa konkretnom ulogom, razgovorom sa kandidatom i drugim rezultatima procjene.
            </p>
          </section>

          <section className="results-report__section results-report__section--recommendations results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Naredni korak</h3>
            </div>
            <ul className="results-bullet-list">
              {MWMS_NEXT_STEPS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {shouldShowMwmsAiReport && mwmsParticipantReport ? (
        <div className="results-report__closing stack-md">
          <section className="results-report__section results-report__section--insights results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 pt-5 pb-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.22)] sm:px-6 sm:pt-6 sm:pb-6">
            <div className="results-report__section-heading">
              <h3>Šta ovaj obrazac znači u radu</h3>
            </div>
            <div className="space-y-3 text-[14px] leading-[1.76] text-slate-700 sm:text-[14.5px]">
              <p>{mwmsParticipantReport.motivation_pattern.autonomous}</p>
              <p>{mwmsParticipantReport.motivation_pattern.controlled}</p>
              <p>{mwmsParticipantReport.motivation_pattern.amotivation}</p>
            </div>
          </section>

          <section className="results-report__section results-report__section--insights results-report__panel rounded-[24px] border border-[rgba(203,213,225,0.9)] bg-[rgba(255,255,255,0.98)] px-5 pt-5 pb-5 shadow-[0_20px_48px_-44px_rgba(15,23,42,0.22)] sm:px-6 sm:pt-6 sm:pb-6">
            <div className="results-report__section-heading">
              <h3>Ključni uvidi</h3>
            </div>
            <ul className="results-bullet-list space-y-3 text-[14px] leading-[1.72] text-slate-700">
              {mwmsParticipantReport.key_observations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="results-report__section results-report__section--insights results-report__panel rounded-[24px] border border-[rgba(148,163,184,0.2)] bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,1))] px-5 pt-5 pb-5 shadow-[0_18px_40px_-44px_rgba(15,23,42,0.18)] sm:px-6 sm:pt-6 sm:pb-6">
            <div className="results-report__section-heading">
              <h3>Na šta obratiti pažnju</h3>
            </div>
            <ul className="results-bullet-list space-y-3 text-[14px] leading-[1.72] text-slate-700">
              {mwmsParticipantReport.possible_tensions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="results-report__section results-report__section--recommendations results-report__panel rounded-[24px] border border-[rgba(17,138,178,0.16)] bg-[linear-gradient(180deg,rgba(247,251,253,0.98),rgba(255,255,255,1))] px-5 pt-5 pb-5 shadow-[0_22px_48px_-42px_rgba(17,138,178,0.2)] sm:px-6 sm:pt-6 sm:pb-6">
            <div className="results-report__section-heading">
              <h3 className="!text-[1.5rem] !font-semibold !leading-[1.08] !tracking-[-0.04em] !text-[#1f1b18]">
                Razvojne smjernice
              </h3>
            </div>
            <ul className="results-bullet-list space-y-3 text-[14px] leading-[1.72] text-slate-700">
              {mwmsParticipantReport.development_suggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="results-report__section results-report__section--insights results-report__panel rounded-[22px] border border-[rgba(226,232,240,0.88)] bg-[rgba(248,250,252,0.72)] px-5 pt-5 pb-5 shadow-[0_14px_34px_-40px_rgba(15,23,42,0.18)] sm:px-6">
            <div className="results-report__section-heading">
              <h3 className="!text-[1.5rem] !font-semibold !leading-[1.08] !tracking-[-0.04em] !text-[#1f1b18]">
                Pitanja za refleksiju
              </h3>
            </div>
            <ul className="results-bullet-list space-y-3 text-[14px] leading-[1.72] text-slate-700">
              {mwmsParticipantReport.reflection_questions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="results-report__section results-report__section--conclusion results-report__panel rounded-[16px] border border-[rgba(226,232,240,0.86)] bg-[rgba(248,250,252,0.54)] px-3.5 py-3 shadow-[0_6px_16px_-20px_rgba(15,23,42,0.12)] sm:px-4 sm:py-3.5">
            <div className="results-report__section-heading gap-1.5">
              <h3 className="!text-[10px] sm:!text-[10.5px] !font-medium !leading-[1.1] !tracking-[0.08em] !text-slate-600">
                Interpretacijska napomena
              </h3>
            </div>
            <p className="text-[12px] leading-[1.6] text-slate-500 sm:text-[12.5px]">
              {mwmsParticipantReport.interpretation_note}
            </p>
          </section>
        </div>
      ) : null}

      {!isMwmsResults && bigFiveParticipantReport ? (
        <div className="results-report__closing stack-md">
          <section className="results-report__section results-report__section--conclusion results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Zaključak</h3>
            </div>
            <div className="results-report__section-body stack-xs">
              {bigFiveParticipantReport.summary?.headline &&
              bigFiveParticipantReport.summary?.overview ? (
                <>
                  <p>{bigFiveParticipantReport.summary.headline}</p>
                  <p>{bigFiveParticipantReport.summary.overview}</p>
                </>
              ) : (
                <p>Zaključak trenutno nije dostupan u ovom izvještaju.</p>
              )}
            </div>
          </section>

          <section className="results-report__section results-report__section--recommendations results-report__panel card stack-sm">
            <div className="results-report__section-heading">
              <h3>Preporuke</h3>
            </div>
            {recommendations.length > 0 ? (
              <ul className="results-bullet-list">
                {recommendations.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="stack-xs">
                    <strong>{item.title || LEGACY_RECOMMENDATION_FIELD_UNAVAILABLE}</strong>
                    <p>{item.description || LEGACY_RECOMMENDATION_FIELD_UNAVAILABLE}</p>
                    <p>
                      <strong>Akcija:</strong>{" "}
                      {item.action || LEGACY_RECOMMENDATION_FIELD_UNAVAILABLE}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{LEGACY_RECOMMENDATIONS_UNAVAILABLE}</p>
            )}
          </section>
        </div>
      ) : null}

      {shouldShowBigFiveHrFallbackCard ? (
        renderReportFallbackCard(
          "Big Five HR prikaz još nije dostupan",
          "Render format za Big Five HR je prepoznat, ali zaseban HR layout još nije podržan u ovoj verziji aplikacije.",
        )
      ) : null}

      {ipipNeo120ParticipantReport ? (
        ipipNeo120ParticipantV1Report ? (
          <IpipNeo120ParticipantReportSections report={ipipNeo120ParticipantV1Report} />
        ) : ipipNeo120ParticipantV2Report ? (
          <IpipNeo120ParticipantReportV2Sections report={ipipNeo120ParticipantV2Report} />
        ) : null
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
