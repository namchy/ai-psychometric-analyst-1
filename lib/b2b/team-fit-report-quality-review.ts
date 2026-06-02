import "server-only";

import {
  TEAM_FIT_RELATIONSHIP_PATTERNS,
  validateTeamFitReportSnapshot,
  type TeamFitReportV1,
} from "@/lib/b2b/team-fit-report-contract";
import type { TeamFitReportDisplayRecord } from "@/lib/b2b/team-fit-report-display";

export type TeamFitQualityReviewSeverity = "blocking" | "warning";

export type TeamFitQualityReviewStatus = "passed" | "warning" | "failed";

export type TeamFitQualityReviewFindingCode =
  | "MISSING_REPORT_SNAPSHOT"
  | "INVALID_REPORT_SNAPSHOT"
  | "FORBIDDEN_NUMERIC_SCORE_FIELD"
  | "FORBIDDEN_NUMERIC_SCORE_LANGUAGE"
  | "FORBIDDEN_HIRING_LANGUAGE"
  | "FORBIDDEN_LABELING_LANGUAGE"
  | "FORBIDDEN_CANDIDATE_OR_TEAM_BLAME"
  | "FORBIDDEN_PRIVACY_FIELD"
  | "FORBIDDEN_PRIVACY_NARRATIVE"
  | "CANDIDATE_FACING_LANGUAGE"
  | "MISSING_REQUIRED_SECTION"
  | "EMPTY_REQUIRED_SECTION"
  | "NON_ACTIONABLE_GUIDANCE"
  | "INVALID_RELATIONSHIP_PATTERN"
  | "RELATIONSHIP_PATTERN_DECISION_LANGUAGE";

export type TeamFitQualityReviewFinding = {
  severity: TeamFitQualityReviewSeverity;
  code: TeamFitQualityReviewFindingCode;
  message: string;
  path?: string;
};

export type TeamFitQualityReviewResult = {
  reviewStatus: TeamFitQualityReviewStatus;
  findings: TeamFitQualityReviewFinding[];
  summary: string;
};

type StringLeaf = {
  path: string;
  value: string;
};

const FORBIDDEN_NUMERIC_SCORE_KEYS = [
  "fitScore",
  "score0To100",
  "overallFitScore",
] as const;

const FORBIDDEN_NUMERIC_SCORE_PATTERNS = [
  /\bfit score\b/i,
  /\bocjena fita\b/i,
  /\bprocenat uklapanja\b/i,
  /\bpostotak uklapanja\b/i,
] as const;

const FORBIDDEN_HIRING_PATTERNS = [
  /\bdo not hire\b/i,
  /\bhire\b/i,
  /\bzaposliti\b/i,
  /\bne zaposliti\b/i,
  /\bpreporučuje se zapošljavanje\b/i,
  /\bpreporucuje se zaposljavanje\b/i,
  /\bne preporučuje se zapošljavanje\b/i,
  /\bne preporucuje se zaposljavanje\b/i,
];

const FORBIDDEN_LABELING_PATTERNS = [
  /\bloš fit\b/i,
  /\blos fit\b/i,
  /\bbad fit\b/i,
  /\bloš tim\b/i,
  /\blos tim\b/i,
  /\bdisfunkcionalan tim\b/i,
];

const FORBIDDEN_BLAME_PATTERNS = [
  /\bkandidat je problem\b/i,
  /\btim je problem\b/i,
  /\bkandidat predstavlja problem\b/i,
  /\btim predstavlja problem\b/i,
];

const FORBIDDEN_PRIVACY_KEYS = [
  "individualAnswers",
  "rawResponses",
  "individualScores",
  "memberScores",
] as const;

const FORBIDDEN_PRIVACY_NARRATIVE_PATTERNS = [
  /\bindividualn(?:e|ih)? score vrijednost/i,
  /\bpojedinačn(?:e|ih)? score vrijednost/i,
  /\bpojedinacn(?:e|ih)? score vrijednost/i,
  /\bscore članova tima\b/i,
  /\bscore clanova tima\b/i,
  /\bodgovor(?:i)? članova tima\b/i,
  /\bodgovor(?:i)? clanova tima\b/i,
];

const SAFE_PRIVACY_NEGATION_PATTERN =
  /\bne\s+(?:prikazuje|otkriva|iznosi|sadrži|sadrzi|navodi)\b/i;

const CANDIDATE_FACING_PATTERNS = [
  /\bti\b/iu,
  /\btvoj(?:a|e|i|ih|im)?\b/iu,
  /\btebi\b/iu,
  /\btvoje\b/iu,
  /\bmožeš\b/iu,
  /\bmozes\b/iu,
  /\brazmisli\b/iu,
  /\bpripremi se\b/iu,
  /\bza tebe\b/iu,
  /\btebi će\b/iu,
  /\btebi ce\b/iu,
];

const RELATIONSHIP_PATTERN_DECISION_PATTERNS = [
  /\bodluka\b/i,
  /\brang\b/i,
  /\bscore\b/i,
  /\bocjena\b/i,
];

const REQUIRED_SECTIONS = [
  "fitOverview",
  "teamContextSummary",
  "candidateSignals",
  "complementaritySignals",
  "frictionRisks",
  "interviewFocus",
  "onboardingGuidance",
  "managerGuidance",
  "watchouts",
  "interpretationLimits",
] as const;

const ACTIONABLE_PATTERNS = [
  /\bprovjer/i,
  /\bdogovor/i,
  /\bpostav/i,
  /\bkorist/i,
  /\busklad/i,
  /\brazjasn/i,
  /\bprat/i,
  /\bdefini/i,
  /\bpitaj/i,
  /\btraž/i,
  /\btraz/i,
  /\brazgovaraj/i,
  /\buvodi/i,
  /\borganiz/i,
  /\bplanir/i,
  /\bprati/i,
  /\bcheck-?in\b/i,
  /\bfeedback\b/i,
  /\?/,
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSnapshotFromInput(input: unknown): TeamFitReportV1 | null {
  if (isPlainRecord(input) && "reportSnapshot" in input) {
    const candidate = input as TeamFitReportDisplayRecord;
    return candidate.reportSnapshot ?? null;
  }

  return isPlainRecord(input) ? (input as TeamFitReportV1) : null;
}

function collectStringLeaves(value: unknown, path = "", output: StringLeaf[] = []): StringLeaf[] {
  if (typeof value === "string") {
    output.push({ path, value });
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectStringLeaves(entry, `${path}[${index}]`, output);
    });
    return output;
  }

  if (isPlainRecord(value)) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      const nextPath = path ? `${path}.${key}` : key;
      collectStringLeaves(nestedValue, nextPath, output);
    });
  }

  return output;
}

function getAtPath(value: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isPlainRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, value);
}

function hasActionableText(values: string[]): boolean {
  return values.some((value) =>
    ACTIONABLE_PATTERNS.some((pattern) => pattern.test(value)),
  );
}

function pushFinding(
  findings: TeamFitQualityReviewFinding[],
  severity: TeamFitQualityReviewSeverity,
  code: TeamFitQualityReviewFindingCode,
  message: string,
  path?: string,
): void {
  findings.push(
    path
      ? { severity, code, message, path }
      : { severity, code, message },
  );
}

function scanForbiddenKeys(
  value: unknown,
  findings: TeamFitQualityReviewFinding[],
  path = "",
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      scanForbiddenKeys(entry, findings, `${path}[${index}]`);
    });
    return;
  }

  if (!isPlainRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    const nextPath = path ? `${path}.${key}` : key;

    if (FORBIDDEN_NUMERIC_SCORE_KEYS.includes(key as (typeof FORBIDDEN_NUMERIC_SCORE_KEYS)[number])) {
      pushFinding(
        findings,
        "blocking",
        "FORBIDDEN_NUMERIC_SCORE_FIELD",
        "Team Fit report must not expose numeric fit score fields.",
        nextPath,
      );
    }

    if (FORBIDDEN_PRIVACY_KEYS.includes(key as (typeof FORBIDDEN_PRIVACY_KEYS)[number])) {
      pushFinding(
        findings,
        "blocking",
        "FORBIDDEN_PRIVACY_FIELD",
        "Team Fit report must not expose raw or individual team-member data fields.",
        nextPath,
      );
    }

    scanForbiddenKeys(nestedValue, findings, nextPath);
  });
}

function reviewRequiredSections(
  snapshot: TeamFitReportV1,
  findings: TeamFitQualityReviewFinding[],
): void {
  const record = snapshot as unknown as Record<string, unknown>;

  REQUIRED_SECTIONS.forEach((path) => {
    const value = getAtPath(record, path);

    if (value === undefined || value === null) {
      pushFinding(
        findings,
        "blocking",
        "MISSING_REQUIRED_SECTION",
        `Required Team Fit section is missing: ${path}.`,
        path,
      );
      return;
    }

    if (Array.isArray(value) && value.length === 0) {
      pushFinding(
        findings,
        "blocking",
        "EMPTY_REQUIRED_SECTION",
        `Required Team Fit section must not be empty: ${path}.`,
        path,
      );
    }
  });
}

function reviewGuidanceUsefulness(
  snapshot: TeamFitReportV1,
  findings: TeamFitQualityReviewFinding[],
): void {
  const interviewPrompts = snapshot.interviewFocus?.areas.flatMap((area) => area.prompts) ?? [];
  const onboardingItems = [
    ...(snapshot.onboardingGuidance?.priorities ?? []),
    ...(snapshot.onboardingGuidance?.supportNeeds ?? []),
  ];
  const managerItems = [
    ...(snapshot.managerGuidance?.workingStyleGuidance ?? []),
    ...(snapshot.managerGuidance?.communicationGuidance ?? []),
  ];

  if (interviewPrompts.length === 0) {
    pushFinding(
      findings,
      "blocking",
      "EMPTY_REQUIRED_SECTION",
      "Interview guidance must contain at least one prompt.",
      "interviewFocus.areas",
    );
  } else if (!hasActionableText(interviewPrompts)) {
    pushFinding(
      findings,
      "warning",
      "NON_ACTIONABLE_GUIDANCE",
      "Interview guidance should contain at least one concrete question or actionable prompt.",
      "interviewFocus.areas",
    );
  }

  if (onboardingItems.length === 0) {
    pushFinding(
      findings,
      "blocking",
      "EMPTY_REQUIRED_SECTION",
      "Onboarding guidance must contain at least one actionable item.",
      "onboardingGuidance",
    );
  } else if (!hasActionableText(onboardingItems)) {
    pushFinding(
      findings,
      "warning",
      "NON_ACTIONABLE_GUIDANCE",
      "Onboarding guidance should contain at least one concrete actionable item.",
      "onboardingGuidance",
    );
  }

  if (managerItems.length === 0) {
    pushFinding(
      findings,
      "blocking",
      "EMPTY_REQUIRED_SECTION",
      "Manager guidance must contain at least one actionable item.",
      "managerGuidance",
    );
  } else if (!hasActionableText(managerItems)) {
    pushFinding(
      findings,
      "warning",
      "NON_ACTIONABLE_GUIDANCE",
      "Manager guidance should contain at least one concrete actionable item.",
      "managerGuidance",
    );
  }
}

export function reviewTeamFitReportQuality(input: unknown): TeamFitQualityReviewResult {
  const findings: TeamFitQualityReviewFinding[] = [];
  const snapshotCandidate = getSnapshotFromInput(input);

  if (!snapshotCandidate) {
    pushFinding(
      findings,
      "blocking",
      "MISSING_REPORT_SNAPSHOT",
      "Team Fit quality review requires a ready report snapshot.",
      "reportSnapshot",
    );

    return {
      reviewStatus: "failed",
      findings,
      summary: "Team Fit QA failed because no report snapshot was available.",
    };
  }

  const validation = validateTeamFitReportSnapshot(snapshotCandidate);

  if (!validation.ok) {
    validation.errors.forEach((error) => {
      pushFinding(
        findings,
        "blocking",
        "INVALID_REPORT_SNAPSHOT",
        error,
      );
    });

    return {
      reviewStatus: "failed",
      findings,
      summary: `Team Fit QA failed with ${findings.length} contract validation finding(s).`,
    };
  }

  const snapshot = validation.snapshot;
  scanForbiddenKeys(snapshot, findings);
  reviewRequiredSections(snapshot, findings);
  reviewGuidanceUsefulness(snapshot, findings);

  if (!TEAM_FIT_RELATIONSHIP_PATTERNS.includes(snapshot.fitOverview.relationshipPattern)) {
    pushFinding(
      findings,
      "blocking",
      "INVALID_RELATIONSHIP_PATTERN",
      "Team Fit relationshipPattern must use an allowed canonical value.",
      "fitOverview.relationshipPattern",
    );
  }

  const relationshipPatternNarrative = [
    snapshot.fitOverview.headline,
    snapshot.fitOverview.summary,
  ];

  if (
    relationshipPatternNarrative.some((value) =>
      RELATIONSHIP_PATTERN_DECISION_PATTERNS.some((pattern) => pattern.test(value)),
    )
  ) {
    pushFinding(
      findings,
      "warning",
      "RELATIONSHIP_PATTERN_DECISION_LANGUAGE",
      "relationshipPattern narrative should stay descriptive and must not read like a rank, score or decision.",
      "fitOverview",
    );
  }

  const stringLeaves = collectStringLeaves(snapshot);

  stringLeaves.forEach(({ path, value }) => {
    FORBIDDEN_NUMERIC_SCORE_PATTERNS.forEach((pattern) => {
      if (pattern.test(value)) {
        pushFinding(
          findings,
          "blocking",
          "FORBIDDEN_NUMERIC_SCORE_LANGUAGE",
          "Team Fit report must not use numeric fit-score wording.",
          path,
        );
      }
    });

    FORBIDDEN_HIRING_PATTERNS.forEach((pattern) => {
      if (pattern.test(value)) {
        pushFinding(
          findings,
          "blocking",
          "FORBIDDEN_HIRING_LANGUAGE",
          "Team Fit report must not use hire/no-hire language.",
          path,
        );
      }
    });

    FORBIDDEN_LABELING_PATTERNS.forEach((pattern) => {
      if (pattern.test(value)) {
        pushFinding(
          findings,
          "blocking",
          "FORBIDDEN_LABELING_LANGUAGE",
          "Team Fit report must not label the candidate or team as a bad fit/problematic team.",
          path,
        );
      }
    });

    FORBIDDEN_BLAME_PATTERNS.forEach((pattern) => {
      if (pattern.test(value)) {
        pushFinding(
          findings,
          "blocking",
          "FORBIDDEN_CANDIDATE_OR_TEAM_BLAME",
          "Team Fit report must not frame the candidate or the team as the problem.",
          path,
        );
      }
    });

    FORBIDDEN_PRIVACY_NARRATIVE_PATTERNS.forEach((pattern) => {
      if (pattern.test(value) && !SAFE_PRIVACY_NEGATION_PATTERN.test(value)) {
        pushFinding(
          findings,
          "blocking",
          "FORBIDDEN_PRIVACY_NARRATIVE",
          "Team Fit report narrative must not disclose individual team-member answers or score values.",
          path,
        );
      }
    });
  });

  const hrFacingPaths = [
    ...stringLeaves.filter(({ path }) => path.startsWith("fitOverview.")),
    ...stringLeaves.filter(({ path }) => path.startsWith("candidateSignals[")),
    ...stringLeaves.filter(({ path }) => path.startsWith("complementaritySignals[")),
    ...stringLeaves.filter(({ path }) => path.startsWith("frictionRisks[")),
    ...stringLeaves.filter(({ path }) => path.startsWith("interviewFocus.")),
    ...stringLeaves.filter(({ path }) => path.startsWith("onboardingGuidance.")),
    ...stringLeaves.filter(({ path }) => path.startsWith("managerGuidance.")),
    ...stringLeaves.filter(({ path }) => path.startsWith("watchouts[")),
  ];

  hrFacingPaths.forEach(({ path, value }) => {
    CANDIDATE_FACING_PATTERNS.forEach((pattern) => {
      if (pattern.test(value)) {
        pushFinding(
          findings,
          "blocking",
          "CANDIDATE_FACING_LANGUAGE",
          "HR-only Team Fit report must not address the candidate directly in second person.",
          path,
        );
      }
    });
  });

  const blockingCount = findings.filter((finding) => finding.severity === "blocking").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const reviewStatus: TeamFitQualityReviewStatus =
    blockingCount > 0 ? "failed" : warningCount > 0 ? "warning" : "passed";

  const summary =
    reviewStatus === "passed"
      ? "Team Fit QA passed without blocking or warning findings."
      : reviewStatus === "warning"
        ? `Team Fit QA passed with ${warningCount} warning finding(s).`
        : `Team Fit QA failed with ${blockingCount} blocking and ${warningCount} warning finding(s).`;

  return {
    reviewStatus,
    findings,
    summary,
  };
}
