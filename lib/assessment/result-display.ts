import {
  getIpipNeo120DomainLabel,
  getIpipNeo120FacetLabel,
} from "@/lib/assessment/ipip-neo-120-labels";

export type IpcUiLocale = "bs" | "en";

type IpcStaticLabelKey =
  | "not_available"
  | "not_expressed"
  | "octant_suffix"
  | "report"
  | "hr_report"
  | "style_snapshot"
  | "strengths_in_collaboration"
  | "participant_watchouts"
  | "development_recommendations"
  | "communication_style"
  | "collaboration_style"
  | "leadership_and_influence"
  | "team_watchouts"
  | "onboarding_or_management_recommendations";

const IPC_STATIC_LABELS: Record<IpcUiLocale, Record<IpcStaticLabelKey, string>> = {
  bs: {
    not_available: "Nije dostupno",
    not_expressed: "Nije izraženo",
    octant_suffix: "oktant",
    report: "IPC izvještaj",
    hr_report: "IPC HR izvještaj",
    style_snapshot: "Pregled stila",
    strengths_in_collaboration: "Snage u saradnji",
    participant_watchouts: "Na šta da obratiš pažnju",
    development_recommendations: "Preporuke za razvoj",
    communication_style: "Komunikacijski stil",
    collaboration_style: "Stil saradnje",
    leadership_and_influence: "Vođenje i uticaj",
    team_watchouts: "Timski rizici",
    onboarding_or_management_recommendations: "Preporuke za onboarding ili vođenje",
  },
  en: {
    not_available: "Not available",
    not_expressed: "Not expressed",
    octant_suffix: "octant",
    report: "IPC report",
    hr_report: "IPC HR report",
    style_snapshot: "Style snapshot",
    strengths_in_collaboration: "Strengths in collaboration",
    participant_watchouts: "Watchouts",
    development_recommendations: "Development recommendations",
    communication_style: "Communication style",
    collaboration_style: "Collaboration style",
    leadership_and_influence: "Leadership and influence",
    team_watchouts: "Team watchouts",
    onboarding_or_management_recommendations: "Onboarding or management recommendations",
  },
};

export function normalizeIpcUiLocale(locale?: string | null): IpcUiLocale {
  const normalizedLocale = locale?.trim().toLowerCase() ?? "";

  if (normalizedLocale.startsWith("bs")) {
    return "bs";
  }

  return "en";
}

export function formatIpcStaticLabel(
  key: IpcStaticLabelKey,
  locale?: string | null,
): string {
  const resolvedLocale = normalizeIpcUiLocale(locale);
  return IPC_STATIC_LABELS[resolvedLocale][key];
}

const DIMENSION_DISPLAY_LABELS: Record<string, string> = {
  extraversion: "Ekstraverzija",
  EXTRAVERSION: "Ekstraverzija",
  agreeableness: "Kooperativnost",
  AGREEABLENESS: "Kooperativnost",
  conscientiousness: "Savjesnost",
  CONSCIENTIOUSNESS: "Savjesnost",
  emotional_stability: "Emocionalna stabilnost",
  EMOTIONAL_STABILITY: "Emocionalna stabilnost",
  neuroticism: "Emocionalna stabilnost",
  intellect: "Intelekt / imaginacija",
  INTELLECT: "Intelekt / imaginacija",
  openness: "Otvorenost prema iskustvu",
  openness_to_experience: "Otvorenost prema iskustvu",
  PA: "PA oktant",
  BC: "BC oktant",
  DE: "DE oktant",
  FG: "FG oktant",
  HI: "HI oktant",
  JK: "JK oktant",
  LM: "LM oktant",
  NO: "NO oktant",
};

const DIMENSION_HELPER_LABELS: Record<string, string> = {
  ekstraverzija: "socijalna energija i izražavanje",
  kooperativnost: "saradnja, obzirnost i odnos prema drugima",
  savjesnost: "organizacija, disciplina i odgovornost",
  "emocionalna stabilnost": "reakcija na stres, pritisak i neizvjesnost",
  "intelekt / imaginacija": "odnos prema idejama, apstraktnom mišljenju i mašti",
  "otvorenost prema iskustvu": "odnos prema novim idejama, učenju i promjenama",
  "pa oktant": "jedan od IPC interpersonalnih oktanata",
  "bc oktant": "jedan od IPC interpersonalnih oktanata",
  "de oktant": "jedan od IPC interpersonalnih oktanata",
  "fg oktant": "jedan od IPC interpersonalnih oktanata",
  "hi oktant": "jedan od IPC interpersonalnih oktanata",
  "jk oktant": "jedan od IPC interpersonalnih oktanata",
  "lm oktant": "jedan od IPC interpersonalnih oktanata",
  "no oktant": "jedan od IPC interpersonalnih oktanata",
};

export function formatDimensionLabel(dimensionKey: string): string {
  const rawKey = dimensionKey.trim();
  const normalizedKey = rawKey.toLowerCase();
  const neoDomainLabel = getIpipNeo120DomainLabel(rawKey);

  if (neoDomainLabel) {
    return neoDomainLabel;
  }

  const neoFacetLabel = getIpipNeo120FacetLabel(rawKey);

  if (neoFacetLabel) {
    return neoFacetLabel;
  }

  if (DIMENSION_DISPLAY_LABELS[rawKey]) {
    return DIMENSION_DISPLAY_LABELS[rawKey];
  }

  if (DIMENSION_DISPLAY_LABELS[normalizedKey]) {
    return DIMENSION_DISPLAY_LABELS[normalizedKey];
  }

  return rawKey
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatScoreLabel(score: number): string {
  const absoluteScore = Math.abs(score);
  const lastTwoDigits = absoluteScore % 100;
  const lastDigit = absoluteScore % 10;

  if (lastTwoDigits < 11 || lastTwoDigits > 14) {
    if (lastDigit === 1) {
      return `${score} bod`;
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${score} boda`;
    }
  }

  return `${score} bodova`;
}

export function getDimensionHelperLabel(dimensionKey: string): string | null {
  const label = formatDimensionLabel(dimensionKey).trim().toLowerCase();
  return DIMENSION_HELPER_LABELS[label] ?? null;
}

export function formatIpcOctantLabel(
  value: string | null | undefined,
  locale?: string | null,
): string {
  if (!value) {
    return formatIpcStaticLabel("not_available", locale);
  }

  return `${value} ${formatIpcStaticLabel("octant_suffix", locale)}`;
}

export function formatIpcPrimaryDiscLabel(
  value: string | null | undefined,
  locale?: string | null,
): string {
  if (!value) {
    return formatIpcStaticLabel("not_expressed", locale);
  }

  return value;
}

export function formatIpcStyleMetricLabel(
  metric: "primary_disc" | "dominant_octant" | "secondary_octant" | "dominance" | "warmth",
  locale?: string | null,
): string {
  const resolvedLocale = normalizeIpcUiLocale(locale);

  switch (metric) {
    case "primary_disc":
      return resolvedLocale === "bs" ? "Primarni DISC signal" : "Primary DISC signal";
    case "dominant_octant":
      return resolvedLocale === "bs" ? "Dominantni oktant" : "Dominant octant";
    case "secondary_octant":
      return resolvedLocale === "bs" ? "Sekundarni oktant" : "Secondary octant";
    case "dominance":
      return resolvedLocale === "bs" ? "Dominacija" : "Dominance";
    case "warmth":
      return resolvedLocale === "bs" ? "Toplina" : "Warmth";
    default:
      return metric;
  }
}
