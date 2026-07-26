import type { TeamFitReportInputSnapshot } from "@/lib/b2b/team-fit-report-input";
import type {
  TeamFitReportV2,
  TeamFitReportV2EvidenceReference,
  TeamFitReportV2EvidenceSource,
} from "@/lib/b2b/team-fit-report-v2-contract";

type EvidenceScalar = string | number | boolean | null;

export type TeamFitReportV2EvidenceCatalogEntry = {
  key: string;
  label: string;
  value: Record<string, EvidenceScalar>;
};

export type TeamFitReportV2EvidenceCatalog = {
  candidate: TeamFitReportV2EvidenceCatalogEntry[];
  team: TeamFitReportV2EvidenceCatalogEntry[];
};

export type TeamFitReportV2EvidenceCatalogSide = "candidate" | "team";

export class TeamFitReportV2EvidenceCatalogCollisionError extends Error {
  readonly side: TeamFitReportV2EvidenceCatalogSide;
  readonly key: string;
  readonly path: string;
  readonly sourceGroups: string[];

  constructor(input: {
    side: TeamFitReportV2EvidenceCatalogSide;
    key: string;
    path: string;
    sourceGroups: string[];
  }) {
    super(`Conflicting ${input.side} evidence shares canonical key ${input.key}.`);
    this.name = "TeamFitReportV2EvidenceCatalogCollisionError";
    this.side = input.side;
    this.key = input.key;
    this.path = input.path;
    this.sourceGroups = [...input.sourceGroups].sort(binaryCompare);
  }
}

export type TeamFitReportV2EvidenceValidationIssue = {
  path: string;
  code: "unknown_evidence_key" | "evidence_source_mismatch";
  message: string;
};

export type TeamFitReportV2EvidenceValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: TeamFitReportV2EvidenceValidationIssue[] };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function binaryCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortByKey(
  entries: TeamFitReportV2EvidenceCatalogEntry[],
): TeamFitReportV2EvidenceCatalogEntry[] {
  return entries.sort((left, right) => binaryCompare(left.key, right.key));
}

function sameEvidenceValue(
  left: Record<string, EvidenceScalar>,
  right: Record<string, EvidenceScalar>,
): boolean {
  const leftKeys = Object.keys(left).sort(binaryCompare);
  const rightKeys = Object.keys(right).sort(binaryCompare);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key])
  );
}

function sameCatalogEntry(
  left: TeamFitReportV2EvidenceCatalogEntry,
  right: TeamFitReportV2EvidenceCatalogEntry,
): boolean {
  return (
    left.key === right.key &&
    left.label === right.label &&
    sameEvidenceValue(left.value, right.value)
  );
}

const CANDIDATE_FACT_KEYS = [
  "sourceTestSlug",
  "dimensionCode",
  "rawScore",
  "averageScore",
  "maxScore",
  "scaleMin",
  "scaleMax",
  "band",
] as const;

function sameCandidateFacts(
  left: TeamFitReportV2EvidenceCatalogEntry,
  right: TeamFitReportV2EvidenceCatalogEntry,
): boolean {
  return CANDIDATE_FACT_KEYS.every((key) => left.value[key] === right.value[key]);
}

function candidatePresentationKey(entry: TeamFitReportV2EvidenceCatalogEntry): string {
  return [entry.label, entry.value.scoreLabel ?? "", entry.value.bandLabel ?? ""].join("\u0000");
}

function groupByKey<T extends { entry: TeamFitReportV2EvidenceCatalogEntry }>(
  sources: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  sources.forEach((source) => {
    const group = grouped.get(source.entry.key) ?? [];
    group.push(source);
    grouped.set(source.entry.key, group);
  });

  return grouped;
}

function buildCandidateCatalog(
  inputSnapshot: TeamFitReportInputSnapshot,
): TeamFitReportV2EvidenceCatalogEntry[] {
  const sources = (inputSnapshot.candidateSignals.candidateEvidence ?? [])
    .filter(
      (entry) =>
        isNonEmptyString(entry.sourceTestSlug) &&
        isNonEmptyString(entry.dimensionCode),
    )
    .map((entry) => {
      const sourceTestSlug = entry.sourceTestSlug.trim();
      const dimensionCode = entry.dimensionCode.trim();

      return {
        entry: {
          key: `candidate:${sourceTestSlug}:${dimensionCode}`,
          label: entry.dimensionLabel,
          value: {
            sourceTestSlug,
            dimensionCode,
            rawScore: entry.rawScore ?? null,
            averageScore: entry.averageScore ?? null,
            maxScore: entry.maxScore ?? null,
            scoreLabel: entry.scoreLabel ?? null,
            scaleMin: entry.scaleMin ?? null,
            scaleMax: entry.scaleMax ?? null,
            band: entry.band ?? null,
            bandLabel: entry.bandLabel ?? null,
          },
        } satisfies TeamFitReportV2EvidenceCatalogEntry,
      };
    });

  const entries = [...groupByKey(sources).entries()].map(([key, group]) => {
    const canonicalEntry = group[0].entry;

    if (!group.every((source) => sameCandidateFacts(source.entry, canonicalEntry))) {
      throw new TeamFitReportV2EvidenceCatalogCollisionError({
        side: "candidate",
        key,
        path: "candidateSignals.candidateEvidence",
        sourceGroups: ["candidateEvidence"],
      });
    }

    return [...group]
      .sort((left, right) =>
        binaryCompare(candidatePresentationKey(left.entry), candidatePresentationKey(right.entry)),
      )[0].entry;
  });

  return sortByKey(entries);
}

type TeamSignalSourceGroup =
  | "coreSignals"
  | "communicationAndCoordinationSignals"
  | "psychologicalSafetySignal"
  | "situationalJudgmentSignal"
  | "outcomePulseSignal";

type TeamCatalogSource = {
  sourceGroup: TeamSignalSourceGroup;
  entry: TeamFitReportV2EvidenceCatalogEntry;
};

// The input builder derives both groups from the same scoreEntryAggregation.
// coreSignals owns the canonical projection; communicationAndCoordinationSignals
// differs only by its presentation prefix for the same tdm_domain_* result.
const TEAM_DOMAIN_PRESENTATION_SOURCE_PRIORITY = [
  "coreSignals",
  "communicationAndCoordinationSignals",
] as const satisfies readonly TeamSignalSourceGroup[];
const TEAM_DOMAIN_CODE_PREFIX = "tdm_domain_";
const TEAM_PATTERN_PREFIX = "Team pattern signal appears ";
const COMMUNICATION_PATTERN_PREFIX = "Communication or coordination signal appears ";

function isCanonicalTeamDomainCode(code: EvidenceScalar | undefined): code is string {
  return (
    typeof code === "string" &&
    code.startsWith(TEAM_DOMAIN_CODE_PREFIX) &&
    code.length > TEAM_DOMAIN_CODE_PREFIX.length
  );
}

function presentationIndependentTeamSignal(source: TeamCatalogSource): string | null {
  const signal = source.entry.value.signal;

  if (typeof signal !== "string") {
    return null;
  }

  if (source.sourceGroup === "coreSignals" && signal.startsWith(TEAM_PATTERN_PREFIX)) {
    return signal.slice(TEAM_PATTERN_PREFIX.length);
  }

  if (
    source.sourceGroup === "communicationAndCoordinationSignals" &&
    signal.startsWith(COMMUNICATION_PATTERN_PREFIX)
  ) {
    return signal.slice(COMMUNICATION_PATTERN_PREFIX.length);
  }

  return null;
}

function collapseTeamCatalogGroup(key: string, group: TeamCatalogSource[]) {
  if (group.every((source) => sameCatalogEntry(source.entry, group[0].entry))) {
    return group[0].entry;
  }

  const sourceGroups = new Set(group.map((source) => source.sourceGroup));
  const knownPresentationPair =
    sourceGroups.size === 2 &&
    TEAM_DOMAIN_PRESENTATION_SOURCE_PRIORITY.every((sourceGroup) =>
      sourceGroups.has(sourceGroup),
    );
  const canonicalSignal = presentationIndependentTeamSignal(group[0]);
  const presentationOnlyDifference =
    knownPresentationPair &&
    isCanonicalTeamDomainCode(group[0].entry.value.code) &&
    canonicalSignal !== null &&
    group.every(
      (source) =>
        source.entry.label === group[0].entry.label &&
        source.entry.value.code === group[0].entry.value.code &&
        presentationIndependentTeamSignal(source) === canonicalSignal,
    );

  if (presentationOnlyDifference) {
    const canonicalOwner = group.find(
      (source) => source.sourceGroup === TEAM_DOMAIN_PRESENTATION_SOURCE_PRIORITY[0],
    );

    if (canonicalOwner) {
      return canonicalOwner.entry;
    }
  }

  throw new TeamFitReportV2EvidenceCatalogCollisionError({
    side: "team",
    key,
    path: "teamSignals",
    sourceGroups: [...sourceGroups],
  });
}

function buildTeamCatalog(
  inputSnapshot: TeamFitReportInputSnapshot,
): TeamFitReportV2EvidenceCatalogEntry[] {
  const groupedSignals: Array<{
    sourceGroup: TeamSignalSourceGroup;
    signals: Array<{ code: string; label: string; signal: string } | null>;
  }> = [
    { sourceGroup: "coreSignals", signals: inputSnapshot.teamSignals.coreSignals ?? [] },
    {
      sourceGroup: "communicationAndCoordinationSignals",
      signals: inputSnapshot.teamSignals.communicationAndCoordinationSignals ?? [],
    },
    {
      sourceGroup: "psychologicalSafetySignal",
      signals: [inputSnapshot.teamSignals.psychologicalSafetySignal ?? null],
    },
    {
      sourceGroup: "situationalJudgmentSignal",
      signals: [inputSnapshot.teamSignals.situationalJudgmentSignal ?? null],
    },
    {
      sourceGroup: "outcomePulseSignal",
      signals: [inputSnapshot.teamSignals.outcomePulseSignal ?? null],
    },
  ];
  const sources = groupedSignals.flatMap(({ sourceGroup, signals }) =>
    signals.filter(
      (entry): entry is { code: string; label: string; signal: string } =>
        entry !== null &&
        isNonEmptyString(entry.code) &&
        isNonEmptyString(entry.label) &&
        isNonEmptyString(entry.signal),
    ).map((entry) => {
      const code = entry.code.trim();

      return {
        sourceGroup,
        entry: {
          key: `team:${code}`,
          label: entry.label,
          value: {
            code,
            signal: entry.signal,
          },
        },
      };
    }),
  );

  return sortByKey(
    [...groupByKey(sources).entries()].map(([key, group]) =>
      collapseTeamCatalogGroup(key, group),
    ),
  );
}

export function buildTeamFitReportV2EvidenceCatalog(
  inputSnapshot: TeamFitReportInputSnapshot,
): TeamFitReportV2EvidenceCatalog {
  return {
    candidate: buildCandidateCatalog(inputSnapshot),
    team: buildTeamCatalog(inputSnapshot),
  };
}

function evidenceGroups(report: TeamFitReportV2): Array<{
  path: string;
  evidenceRefs: TeamFitReportV2EvidenceReference[];
}> {
  return [
    ...report.executiveAssessment.mainReasons.map((item, index) => ({
      path: `executiveAssessment.mainReasons[${index}].evidenceRefs`,
      evidenceRefs: item.evidenceRefs,
    })),
    ...report.keySignals.map((item, index) => ({
      path: `keySignals[${index}].evidenceRefs`,
      evidenceRefs: item.evidenceRefs,
    })),
    ...report.likelyContributions.map((item, index) => ({
      path: `likelyContributions[${index}].evidenceRefs`,
      evidenceRefs: item.evidenceRefs,
    })),
    ...report.frictionRisks.map((item, index) => ({
      path: `frictionRisks[${index}].evidenceRefs`,
      evidenceRefs: item.evidenceRefs,
    })),
    ...report.interviewPlan.map((item, index) => ({
      path: `interviewPlan[${index}].evidenceRefs`,
      evidenceRefs: item.evidenceRefs,
    })),
  ];
}

export function validateTeamFitReportV2EvidenceReferences(
  report: TeamFitReportV2,
  catalog: TeamFitReportV2EvidenceCatalog,
): TeamFitReportV2EvidenceValidationResult {
  const allowed = {
    candidate: new Set(catalog.candidate.map((entry) => entry.key)),
    team: new Set(catalog.team.map((entry) => entry.key)),
  } satisfies Record<TeamFitReportV2EvidenceSource, Set<string>>;
  const issues: TeamFitReportV2EvidenceValidationIssue[] = [];

  evidenceGroups(report).forEach((group) => {
    group.evidenceRefs.forEach((reference, index) => {
      if (allowed[reference.source].has(reference.key)) {
        return;
      }

      const oppositeSource = reference.source === "candidate" ? "team" : "candidate";
      const path = `${group.path}[${index}].key`;

      if (allowed[oppositeSource].has(reference.key)) {
        issues.push({
          path,
          code: "evidence_source_mismatch",
          message: `Evidence key belongs to ${oppositeSource}, not ${reference.source}.`,
        });
        return;
      }

      issues.push({
        path,
        code: "unknown_evidence_key",
        message: `Evidence key is not present in the allowed ${reference.source} catalog.`,
      });
    });
  });

  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}
