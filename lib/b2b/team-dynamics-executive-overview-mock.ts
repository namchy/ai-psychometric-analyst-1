import "server-only";

import type { TeamDynamicsReportInputSnapshot } from "@/lib/b2b/team-dynamics-report-input";
import {
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION,
  type TeamDynamicsExecutiveOverviewDimension,
  type TeamDynamicsExecutiveOverviewSnapshot,
} from "@/lib/b2b/team-dynamics-executive-overview-contract";

type ScoreEntryAggregation = TeamDynamicsReportInputSnapshot["aggregationSummary"]["scoreEntryAggregations"][number];

export type GenerateTeamDynamicsExecutiveOverviewMockSnapshotResult =
  | {
      ok: true;
      snapshot: TeamDynamicsExecutiveOverviewSnapshot;
    }
  | {
      ok: false;
      code: "missing_input_snapshot" | "invalid_input_snapshot";
      reason: string;
    };

type BuildOptions = {
  inputSnapshot: TeamDynamicsReportInputSnapshot | null | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isScoreEntryAggregation(value: unknown): value is ScoreEntryAggregation {
  return (
    isRecord(value) &&
    isNonEmptyString(value.scoreKey) &&
    isNonEmptyString(value.label) &&
    typeof value.meanScore0To100 === "number"
  );
}

function isTeamDynamicsReportInputSnapshot(
  value: unknown,
): value is TeamDynamicsReportInputSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  if (value.inputType !== "team_dynamics_report_input_v1") {
    return false;
  }

  if (value.inputVersion !== "team_dynamics_report_input_v1") {
    return false;
  }

  if (!isNonEmptyString(value.organizationId) || !isNonEmptyString(value.teamId)) {
    return false;
  }

  if (!isRecord(value.teamContext) || !isRecord(value.aggregationSummary)) {
    return false;
  }

  if (!Array.isArray(value.aggregationSummary.scoreEntryAggregations)) {
    return false;
  }

  return true;
}

function normalizeCount(value: number | null | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  return fallback;
}

function describeAggregateSignal(meanScore0To100: number): string {
  if (meanScore0To100 >= 67) {
    return "Signal djeluje stabilnije i može biti dobra osnova za zadržavanje postojećih radnih obrazaca.";
  }

  if (meanScore0To100 <= 33) {
    return "Signal traži dodatnu pažnju i vrijedi ga provjeriti kroz konkretne radne situacije i timski razgovor.";
  }

  return "Signal je mješovit i najkorisniji je kao početna tačka za precizniji razgovor o svakodnevnoj saradnji.";
}

function buildDimensionOverview(
  scoreEntryAggregations: ScoreEntryAggregation[],
): TeamDynamicsExecutiveOverviewDimension[] {
  const mapped = scoreEntryAggregations
    .filter(isScoreEntryAggregation)
    .slice(0, 4)
    .map((entry) => ({
      key: entry.scoreKey,
      label: entry.label,
      summary: describeAggregateSignal(normalizeCount(entry.meanScore0To100, 50)),
    }));

  if (mapped.length > 0) {
    return mapped;
  }

  return [
    {
      key: "team_dynamics_overview_pending",
      label: "Početni pregled dimenzija",
      summary:
        "Za ovaj prikaz nije dostupan detaljniji agregirani pregled dimenzija, pa izvještaj ostaje na opreznom timskom sažetku bez dodatnog rangiranja.",
    },
  ];
}

export function generateTeamDynamicsExecutiveOverviewMockSnapshot(
  options: BuildOptions,
): GenerateTeamDynamicsExecutiveOverviewMockSnapshotResult {
  if (!options.inputSnapshot) {
    return {
      ok: false,
      code: "missing_input_snapshot",
      reason: "Team Dynamics Executive Overview generation requires a persisted input snapshot.",
    };
  }

  if (!isTeamDynamicsReportInputSnapshot(options.inputSnapshot)) {
    return {
      ok: false,
      code: "invalid_input_snapshot",
      reason: "Team Dynamics Executive Overview generation received an invalid input snapshot shape.",
    };
  }

  const input = options.inputSnapshot;
  const teamName = input.teamContext.teamName?.trim() || "Tim";
  const includedMemberCount = normalizeCount(input.includedMemberCount, 0);
  const completedMemberCount = normalizeCount(
    input.aggregationSummary.completedMemberCount,
    includedMemberCount,
  );
  const scoreEntryAggregations = input.aggregationSummary.scoreEntryAggregations.filter(
    isScoreEntryAggregation,
  );
  const dimensionOverview = buildDimensionOverview(scoreEntryAggregations);
  const visibleDimensionCount = scoreEntryAggregations.length;
  const completionNote =
    completedMemberCount >= includedMemberCount
      ? "Svi uključeni članovi imaju završen doprinos u agregiranom pregledu."
      : `U agregiranom pregledu je trenutno završeno ${completedMemberCount} od ${includedMemberCount} uključenih članova.`;

  const snapshot: TeamDynamicsExecutiveOverviewSnapshot = {
    reportType: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE,
    reportVersion: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION,
    locale: "bs",
    teamContext: {
      organizationId: input.organizationId,
      teamId: input.teamId,
      teamName,
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    },
    includedMembersSummary: {
      includedMemberCount,
      completedMemberCount,
      note: `${completionNote} Ovaj pregled ostaje timski signal i ne prikazuje pojedinačne odgovore.`,
    },
    executiveSummary: {
      headline: "Početni pregled timske dinamike",
      summary: `${teamName} je trenutno obuhvaćen pregledom za ${includedMemberCount} uključenih članova. Ovaj sažetak koristi postojeći timski input snapshot i agregirane signale da izdvoji početne obrasce saradnje, bez pojedinačnog rangiranja članova. Nalaze treba koristiti kao osnovu za razvojni razgovor i provjeru radnog konteksta.`,
    },
    keyTeamSignals: [
      {
        title: "Timski pregled ostaje razvojni signal",
        summary: `Sažetak se odnosi na ${includedMemberCount} uključenih članova i služi kao početna osnova za razgovor o timskim obrascima.`,
      },
      {
        title: "Agregirani pregled je ograničen na dostupne timske signale",
        summary:
          visibleDimensionCount > 0
            ? `Dostupan je neutralan pregled za ${visibleDimensionCount} agregiranih dimenzija bez uvođenja jedinstvenog ukupnog timskog skora.`
            : "Detaljniji agregirani pregled dimenzija nije dostupan, pa izvještaj ostaje na opreznom narativnom nivou.",
      },
      {
        title: "Zajednički kontekst je važan za tumačenje",
        summary:
          completedMemberCount === includedMemberCount
            ? "Pošto su svi uključeni doprinosi obuhvaćeni, fokus je na tome kako tim zajednički razumije prioritete i saradnju."
            : "Pošto svi uključeni doprinosi još nisu završeni, signale treba čitati još opreznije i provjeriti ih kroz radni kontekst.",
      },
    ],
    dimensionOverview: {
      dimensions: dimensionOverview,
    },
    alignmentAndFriction: {
      alignmentSignals: [
        "Vrijedi zadržati fokus na obrascima saradnje koji timu pomažu da dijeli istu sliku prioriteta i načina rada.",
      ],
      frictionSignals: [
        visibleDimensionCount > 0
          ? "Razlike između agregiranih signala mogu ukazivati na tačke gdje timu treba jasniji dogovor o koordinaciji, očekivanjima ili načinu odlučivanja."
          : "Bez detaljnijih agregiranih dimenzija treba prvo provjeriti gdje se u svakodnevnom radu najčešće javljaju nejasnoće ili trenje.",
      ],
    },
    psychologicalSafetySignal: {
      title: "Psihološka sigurnost se čita odvojeno",
      summary: input.aggregationSummary.psychologicalSafetyAggregationPresent
        ? "Signal psihološke sigurnosti je dostupan kao zaseban timski indikator i vrijedi ga provjeriti kroz način na koji tim otvara neslaganja i traži pomoć."
        : "Za psihološku sigurnost nema zasebnog agregiranog signala u ovom snapshotu, pa temu treba otvoriti kroz razgovor o svakodnevnoj klimi rada.",
    },
    situationalJudgmentSignal: {
      title: "Situacijsko prosuđivanje ostaje kontekstualni signal",
      summary: input.aggregationSummary.sjtAggregationPresent
        ? "Dostupan je odvojeni signal o tome kako tim prepoznaje tipične situacijske dileme, ali bez dijagnostičkih presuda o kvalitetu tima."
        : "Za situacijsko prosuđivanje nema zasebnog agregiranog signala u ovom snapshotu, pa je korisno provjeriti kako tim reaguje u nejasnim ili napetim situacijama.",
    },
    outcomePulseSignal: {
      title: "Outcome pulse se ne koristi kao core skor",
      summary: input.aggregationSummary.outcomePulseAggregationPresent
        ? "Outcome pulse je dostupan kao odvojeni signal percepcije i treba ga čitati uz ostale nalaze, ne kao centralnu ocjenu tima."
        : "Outcome pulse u ovom snapshotu nije dostupan kao zaseban signal, pa se ne izvode dodatni zaključci o ukupnom učinku tima.",
    },
    risksToWatch: [
      "Pratiti da li tim ima dovoljno zajedničkog prostora da rano razjasni prioritete i očekivanja kada se pojave nejasnoće.",
      "Obratiti pažnju na to da li se razlike u doživljaju saradnje pretvaraju u odgađanje otvorenih razgovora o radu.",
      "Provjeriti da li postoje radne situacije u kojima tim predugo ostaje bez jasnog dogovora o narednom koraku.",
    ],
    leadershipRecommendations: [
      "Otvoriti kratak strukturiran razgovor o tome gdje tim najlakše usklađuje prioritete, a gdje traži više eksplicitnog dogovora.",
      "Dogovoriti jedan ili dva jednostavna radna rituala za ranije razjašnjavanje nejasnoća i podjelu odgovornosti.",
      "Koristiti ovaj pregled kao ulaz za timsku refleksiju, uz provjeru stvarnih primjera iz rada umjesto brzih zaključaka o ljudima.",
    ],
    suggestedNextConversation: {
      title: "Predloženi naredni timski razgovor",
      prompts: [
        "U kojim situacijama timu najviše pomaže jasan dogovor o prioritetima, a gdje taj dogovor najčešće izostane?",
        "Kako tim trenutno prepoznaje da postoji neslaganje ili nejasnoća prije nego što to uspori rad?",
        "Koji bi mali radni dogovor već naredne sedmice mogao smanjiti trenje i poboljšati koordinaciju?",
      ],
    },
    interpretationLimits: [
      "Ovaj izvještaj je razvojni timski signal, nije presuda o timu i ne služi za odluke o zapošljavanju.",
      "Izvještaj ne prikazuje individualne odgovore, raw responses ni individualne score vrijednosti.",
      "Nalaze treba čitati zajedno sa stvarnim radnim kontekstom, sastavom tima i promjenama u okruženju.",
    ],
  };

  return {
    ok: true,
    snapshot,
  };
}
