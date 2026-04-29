import type { IpipNeo120ParticipantReportV1 } from "@/lib/assessment/ipip-neo-120-report-v1";
import type { IpipNeo120DomainCode } from "@/lib/assessment/ipip-neo-120-labels";

type ParticipantIpipDisplayBand = "higher" | "balanced" | "lower";

type ParticipantIpipDisplayDomainState = {
  domainCode: IpipNeo120DomainCode;
  label: string;
  score: number;
  band: ParticipantIpipDisplayBand;
};

export type ParticipantIpipProfileBadge = {
  text: string;
  accentColor: string;
  borderColor: string;
  backgroundColor: string;
};

export type ParticipantIpipProfilePattern = {
  title: string;
  body: string;
  accentColor: string;
};

type ParticipantIpipProfileOverview = {
  badges: [ParticipantIpipProfileBadge, ParticipantIpipProfileBadge, ParticipantIpipProfileBadge];
  patterns: [
    ParticipantIpipProfilePattern,
    ParticipantIpipProfilePattern,
    ParticipantIpipProfilePattern,
    ParticipantIpipProfilePattern,
  ];
};

function formatParticipantIpipDomainLabel(label: string): string {
  if (label === "Ugodnost") return "Spremnost na saradnju";
  if (label === "Neuroticizam") return "Emocionalna stabilnost";
  return label;
}

function normalizeParticipantIpipDomainState(
  domain: IpipNeo120ParticipantReportV1["domains"][number],
): ParticipantIpipDisplayDomainState {
  if (domain.domain_code !== "NEUROTICISM") {
    return {
      domainCode: domain.domain_code,
      label: formatParticipantIpipDomainLabel(domain.label),
      score: domain.score,
      band: domain.band,
    };
  }

  return {
    domainCode: domain.domain_code,
    label: "Emocionalna stabilnost",
    score: 6 - domain.score,
    band:
      domain.band === "lower"
        ? "higher"
        : domain.band === "higher"
          ? "lower"
          : "balanced",
  };
}

function getRequiredDomainState(
  states: Map<IpipNeo120DomainCode, ParticipantIpipDisplayDomainState>,
  domainCode: IpipNeo120DomainCode,
): ParticipantIpipDisplayDomainState {
  const state = states.get(domainCode);

  if (!state) {
    throw new Error(`Missing participant IPIP domain state for ${domainCode}.`);
  }

  return state;
}

function getDomainBandPhrase(
  state: ParticipantIpipDisplayDomainState,
  grammaticalCase: "nominative" | "genitive",
): string {
  switch (state.domainCode) {
    case "EXTRAVERSION":
      if (state.band === "higher") return grammaticalCase === "genitive" ? "izraženije Ekstraverzije" : "izraženija Ekstraverzija";
      if (state.band === "balanced") return grammaticalCase === "genitive" ? "uravnotežene Ekstraverzije" : "uravnotežena Ekstraverzija";
      return grammaticalCase === "genitive" ? "mirnije Ekstraverzije" : "mirnija Ekstraverzija";
    case "AGREEABLENESS":
      if (state.band === "higher") return grammaticalCase === "genitive" ? "izraženije Spremnosti na saradnju" : "izraženija Spremnost na saradnju";
      if (state.band === "balanced") return grammaticalCase === "genitive" ? "uravnotežene Spremnosti na saradnju" : "uravnotežena Spremnost na saradnju";
      return grammaticalCase === "genitive" ? "direktnije Spremnosti na saradnju" : "direktnija Spremnost na saradnju";
    case "CONSCIENTIOUSNESS":
      if (state.band === "higher") return grammaticalCase === "genitive" ? "izraženije Savjesnosti" : "izraženija Savjesnost";
      if (state.band === "balanced") return grammaticalCase === "genitive" ? "uravnotežene Savjesnosti" : "uravnotežena Savjesnost";
      return grammaticalCase === "genitive" ? "fleksibilnije Savjesnosti" : "fleksibilnija Savjesnost";
    case "NEUROTICISM":
      if (state.band === "higher") return grammaticalCase === "genitive" ? "izraženije Emocionalne stabilnosti" : "izraženija Emocionalna stabilnost";
      if (state.band === "balanced") return grammaticalCase === "genitive" ? "uravnotežene Emocionalne stabilnosti" : "uravnotežena Emocionalna stabilnost";
      return grammaticalCase === "genitive" ? "osjetljivije Emocionalne stabilnosti" : "osjetljivija Emocionalna stabilnost";
    case "OPENNESS_TO_EXPERIENCE":
      if (state.band === "higher") return grammaticalCase === "genitive" ? "izraženije Otvorenosti prema iskustvu" : "izraženija Otvorenost prema iskustvu";
      if (state.band === "balanced") return grammaticalCase === "genitive" ? "uravnotežene Otvorenosti prema iskustvu" : "uravnotežena Otvorenost prema iskustvu";
      return grammaticalCase === "genitive" ? "praktičnije Otvorenosti prema iskustvu" : "praktičnija Otvorenost prema iskustvu";
    default:
      return state.label;
  }
}

function getDomainBadgeText(state: ParticipantIpipDisplayDomainState): string {
  switch (state.domainCode) {
    case "CONSCIENTIOUSNESS":
      return state.band === "higher"
        ? "Izraženija savjesnost"
        : state.band === "balanced"
          ? "Uravnotežena savjesnost"
          : "Fleksibilnija savjesnost";
    case "EXTRAVERSION":
      return state.band === "higher"
        ? "Izraženija energija"
        : state.band === "balanced"
          ? "Uravnotežena energija"
          : "Mirnija energija";
    case "NEUROTICISM":
      return state.band === "higher"
        ? "Stabilniji emocionalni profil"
        : state.band === "balanced"
          ? "Uravnotežen emocionalni profil"
          : "Osjetljiviji emocionalni profil";
    default:
      return state.label;
  }
}

function buildProfileBadges(
  conscientiousness: ParticipantIpipDisplayDomainState,
  extraversion: ParticipantIpipDisplayDomainState,
  stability: ParticipantIpipDisplayDomainState,
): ParticipantIpipProfileOverview["badges"] {
  return [
    {
      text: getDomainBadgeText(conscientiousness),
      accentColor: "#06d6a0",
      borderColor: "rgba(6, 214, 160, 0.34)",
      backgroundColor: "rgba(6, 214, 160, 0.12)",
    },
    {
      text: getDomainBadgeText(extraversion),
      accentColor: "#118ab2",
      borderColor: "rgba(17, 138, 178, 0.34)",
      backgroundColor: "rgba(17, 138, 178, 0.12)",
    },
    {
      text: getDomainBadgeText(stability),
      accentColor: "#ffd166",
      borderColor: "rgba(255, 209, 102, 0.42)",
      backgroundColor: "rgba(255, 209, 102, 0.18)",
    },
  ];
}

function buildProfilePatterns(
  conscientiousness: ParticipantIpipDisplayDomainState,
  extraversion: ParticipantIpipDisplayDomainState,
  agreeableness: ParticipantIpipDisplayDomainState,
  stability: ParticipantIpipDisplayDomainState,
  openness: ParticipantIpipDisplayDomainState,
): ParticipantIpipProfileOverview["patterns"] {
  return [
    {
      title: "Organizovana inicijativa",
      accentColor: "#06d6a0",
      body: `${getDomainBandPhrase(conscientiousness, "nominative")} uz ${getDomainBandPhrase(extraversion, "genitive")} sugeriše da ciljevima najčešće pristupaš kroz kombinaciju strukture, ličnog ritma i količine socijalne energije koja ti prirodno odgovara.`,
    },
    {
      title: "Stabilnost pod pritiskom",
      accentColor: "#118ab2",
      body: `${getDomainBandPhrase(stability, "nominative")} sugeriše kako se pod pritiskom vjerovatno oslanjaš na nivo smirenosti i samoregulacije koji ti je trenutno prirodniji, bez pretpostavke da će reakcija biti ista u svakom kontekstu.`,
    },
    {
      title: "Saradnja s jasnim standardima",
      accentColor: "#ffd166",
      body: `${getDomainBandPhrase(agreeableness, "nominative")} u kombinaciji s ${getDomainBandPhrase(conscientiousness, "genitive")} sugeriše kako odnos prema drugima i obavezama najčešće gradiš kroz onaj nivo dogovora, pouzdanosti i direktnosti koji ti je trenutno prirodniji.`,
    },
    {
      title: "Praktična otvorenost",
      accentColor: "#ef476f",
      body: `${getDomainBandPhrase(openness, "nominative")} sugeriše kako nove ideje i promjene najčešće procjenjuješ kroz odnos između radoznalosti, korisnosti i smisla u konkretnom kontekstu.`,
    },
  ];
}

export function buildParticipantIpipProfileOverview(
  report: IpipNeo120ParticipantReportV1,
): ParticipantIpipProfileOverview {
  const states = new Map(
    report.domains.map((domain) => {
      const state = normalizeParticipantIpipDomainState(domain);
      return [state.domainCode, state] as const;
    }),
  );

  const conscientiousness = getRequiredDomainState(states, "CONSCIENTIOUSNESS");
  const extraversion = getRequiredDomainState(states, "EXTRAVERSION");
  const agreeableness = getRequiredDomainState(states, "AGREEABLENESS");
  const stability = getRequiredDomainState(states, "NEUROTICISM");
  const openness = getRequiredDomainState(states, "OPENNESS_TO_EXPERIENCE");

  return {
    badges: buildProfileBadges(conscientiousness, extraversion, stability),
    patterns: buildProfilePatterns(
      conscientiousness,
      extraversion,
      agreeableness,
      stability,
      openness,
    ),
  };
}
