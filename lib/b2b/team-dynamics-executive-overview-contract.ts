import "server-only";

import type { ReportLocale } from "@/lib/assessment/locale";
import { TEAM_DYNAMICS_REPORT_VERSION } from "@/lib/b2b/team-dynamics-report-lifecycle";

export const TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE =
  TEAM_DYNAMICS_REPORT_VERSION;
export const TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION = "v1" as const;

export type TeamDynamicsExecutiveOverviewSignal = {
  title: string;
  summary: string;
};

export type TeamDynamicsExecutiveOverviewDimension = {
  key: string;
  label: string;
  summary: string;
};

export type TeamDynamicsExecutiveOverviewSnapshot = {
  reportType: typeof TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE;
  reportVersion: typeof TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION;
  locale: ReportLocale;
  teamContext: {
    organizationId: string;
    teamId: string;
    teamName: string;
    teamAssessmentAssignmentId: string;
  };
  includedMembersSummary: {
    includedMemberCount: number;
    completedMemberCount: number;
    note: string;
  };
  executiveSummary: {
    headline: string;
    summary: string;
  };
  keyTeamSignals: TeamDynamicsExecutiveOverviewSignal[];
  dimensionOverview: {
    dimensions: TeamDynamicsExecutiveOverviewDimension[];
  };
  alignmentAndFriction: {
    alignmentSignals: string[];
    frictionSignals: string[];
  };
  psychologicalSafetySignal: TeamDynamicsExecutiveOverviewSignal;
  situationalJudgmentSignal: TeamDynamicsExecutiveOverviewSignal;
  outcomePulseSignal: TeamDynamicsExecutiveOverviewSignal;
  risksToWatch: string[];
  leadershipRecommendations: string[];
  suggestedNextConversation: {
    title: string;
    prompts: string[];
  };
  interpretationLimits: string[];
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const FORBIDDEN_FIELD_PATH_PATTERNS = [
  /(^|\.)(individualAnswers|individualAnswer|individualResponses|rawResponses|rawResponse)$/i,
  /(^|\.)(individualScores|individualScore|memberScores|participantScores)$/i,
  /(^|\.)(teamFit|teamFitOutput|teamFitReport)$/i,
  /(^|\.)(unifiedOverallTeamScore|overallTeamScore0To100|teamOverallScore0To100)$/i,
];

const FORBIDDEN_TEXT_PATTERNS = [
  /hire\/no-hire/i,
  /\bno-hire\b/i,
  /\bloš tim\b/i,
  /\bdisfunkcionalan tim\b/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateNonEmptyString(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path}: Expected non-empty string.`);
    return false;
  }

  return true;
}

function validateStringArray(
  value: unknown,
  path: string,
  errors: string[],
  options?: { minLength?: number },
): value is string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (options?.minLength && value.length < options.minLength) {
    errors.push(`${path}: Expected at least ${options.minLength} items.`);
  }

  value.forEach((entry, index) => {
    validateNonEmptyString(entry, `${path}[${index}]`, errors);
  });

  return true;
}

function validateSignal(
  value: unknown,
  path: string,
  errors: string[],
): value is TeamDynamicsExecutiveOverviewSignal {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  validateNonEmptyString(value.title, `${path}.title`, errors);
  validateNonEmptyString(value.summary, `${path}.summary`, errors);
  return true;
}

function validateSignalArray(
  value: unknown,
  path: string,
  errors: string[],
): value is TeamDynamicsExecutiveOverviewSignal[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: Expected array.`);
    return false;
  }

  if (value.length === 0) {
    errors.push(`${path}: Expected at least 1 item.`);
  }

  value.forEach((entry, index) => {
    validateSignal(entry, `${path}[${index}]`, errors);
  });

  return true;
}

function validateDimensionOverview(
  value: unknown,
  path: string,
  errors: string[],
): boolean {
  if (!isRecord(value)) {
    errors.push(`${path}: Expected object.`);
    return false;
  }

  if (!Array.isArray(value.dimensions)) {
    errors.push(`${path}.dimensions: Expected array.`);
    return false;
  }

  if (value.dimensions.length === 0) {
    errors.push(`${path}.dimensions: Expected at least 1 item.`);
  }

  value.dimensions.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`${path}.dimensions[${index}]: Expected object.`);
      return;
    }

    validateNonEmptyString(entry.key, `${path}.dimensions[${index}].key`, errors);
    validateNonEmptyString(entry.label, `${path}.dimensions[${index}].label`, errors);
    validateNonEmptyString(entry.summary, `${path}.dimensions[${index}].summary`, errors);
  });

  return true;
}

function validateForbiddenFieldPaths(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      validateForbiddenFieldPaths(entry, `${path}[${index}]`, errors),
    );
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;

    if (FORBIDDEN_FIELD_PATH_PATTERNS.some((pattern) => pattern.test(nextPath))) {
      errors.push(`${nextPath}: Forbidden field in Team Dynamics Executive Overview snapshot.`);
    }

    validateForbiddenFieldPaths(nestedValue, nextPath, errors);
  }
}

function collectStringLeaves(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringLeaves(entry, output));
    return output;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((entry) => collectStringLeaves(entry, output));
  }

  return output;
}

function validateForbiddenText(value: TeamDynamicsExecutiveOverviewSnapshot, errors: string[]): void {
  const text = collectStringLeaves(value);

  text.forEach((entry) => {
    FORBIDDEN_TEXT_PATTERNS.forEach((pattern) => {
      if (pattern.test(entry)) {
        errors.push(`forbiddenText: Found forbidden phrase matching ${pattern}.`);
      }
    });
  });
}

export function validateTeamDynamicsExecutiveOverviewSnapshot(
  value: unknown,
): ValidationResult<TeamDynamicsExecutiveOverviewSnapshot> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["<root>: Expected object."] };
  }

  validateForbiddenFieldPaths(value, "", errors);

  if (value.reportType !== TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE) {
    errors.push(`reportType: Expected ${TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE}.`);
  }

  if (value.reportVersion !== TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION) {
    errors.push(`reportVersion: Expected ${TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION}.`);
  }

  validateNonEmptyString(value.locale, "locale", errors);

  if (!isRecord(value.teamContext)) {
    errors.push("teamContext: Expected object.");
  } else {
    validateNonEmptyString(value.teamContext.organizationId, "teamContext.organizationId", errors);
    validateNonEmptyString(value.teamContext.teamId, "teamContext.teamId", errors);
    validateNonEmptyString(value.teamContext.teamName, "teamContext.teamName", errors);
    validateNonEmptyString(
      value.teamContext.teamAssessmentAssignmentId,
      "teamContext.teamAssessmentAssignmentId",
      errors,
    );
  }

  if (!isRecord(value.includedMembersSummary)) {
    errors.push("includedMembersSummary: Expected object.");
  } else {
    if (
      typeof value.includedMembersSummary.includedMemberCount !== "number" ||
      value.includedMembersSummary.includedMemberCount < 1
    ) {
      errors.push("includedMembersSummary.includedMemberCount: Expected positive number.");
    }

    if (
      typeof value.includedMembersSummary.completedMemberCount !== "number" ||
      value.includedMembersSummary.completedMemberCount < 0
    ) {
      errors.push("includedMembersSummary.completedMemberCount: Expected non-negative number.");
    }

    validateNonEmptyString(value.includedMembersSummary.note, "includedMembersSummary.note", errors);
  }

  if (!isRecord(value.executiveSummary)) {
    errors.push("executiveSummary: Expected object.");
  } else {
    validateNonEmptyString(value.executiveSummary.headline, "executiveSummary.headline", errors);
    validateNonEmptyString(value.executiveSummary.summary, "executiveSummary.summary", errors);
  }

  validateSignalArray(value.keyTeamSignals, "keyTeamSignals", errors);
  validateDimensionOverview(value.dimensionOverview, "dimensionOverview", errors);

  if (!isRecord(value.alignmentAndFriction)) {
    errors.push("alignmentAndFriction: Expected object.");
  } else {
    validateStringArray(
      value.alignmentAndFriction.alignmentSignals,
      "alignmentAndFriction.alignmentSignals",
      errors,
      { minLength: 1 },
    );
    validateStringArray(
      value.alignmentAndFriction.frictionSignals,
      "alignmentAndFriction.frictionSignals",
      errors,
      { minLength: 1 },
    );
  }

  validateSignal(value.psychologicalSafetySignal, "psychologicalSafetySignal", errors);
  validateSignal(value.situationalJudgmentSignal, "situationalJudgmentSignal", errors);
  validateSignal(value.outcomePulseSignal, "outcomePulseSignal", errors);
  validateStringArray(value.risksToWatch, "risksToWatch", errors, { minLength: 1 });
  validateStringArray(
    value.leadershipRecommendations,
    "leadershipRecommendations",
    errors,
    { minLength: 1 },
  );

  if (!isRecord(value.suggestedNextConversation)) {
    errors.push("suggestedNextConversation: Expected object.");
  } else {
    validateNonEmptyString(
      value.suggestedNextConversation.title,
      "suggestedNextConversation.title",
      errors,
    );
    validateStringArray(
      value.suggestedNextConversation.prompts,
      "suggestedNextConversation.prompts",
      errors,
      { minLength: 1 },
    );
  }

  validateStringArray(value.interpretationLimits, "interpretationLimits", errors, {
    minLength: 1,
  });

  if (errors.length === 0) {
    validateForbiddenText(value as TeamDynamicsExecutiveOverviewSnapshot, errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: value as TeamDynamicsExecutiveOverviewSnapshot,
  };
}

export function buildMockTeamDynamicsExecutiveOverviewSnapshot(): TeamDynamicsExecutiveOverviewSnapshot {
  const snapshot: TeamDynamicsExecutiveOverviewSnapshot = {
    reportType: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE,
    reportVersion: TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION,
    locale: "bs",
    teamContext: {
      organizationId: "org-1",
      teamId: "team-1",
      teamName: "Product Team",
      teamAssessmentAssignmentId: "assignment-1",
    },
    includedMembersSummary: {
      includedMemberCount: 6,
      completedMemberCount: 6,
      note: "Pregled se odnosi samo na uključene članove i služi kao timski signal za razgovor.",
    },
    executiveSummary: {
      headline: "Pregled timskih signala za lidera",
      summary:
        "Ovaj pregled daje oprezan sažetak timskih obrazaca koje vrijedi provjeriti kroz razgovor i radni kontekst. Fokus je na usklađenosti, trenju i razvojnim signalima na nivou tima, bez izdvajanja pojedinaca kao problema.",
    },
    keyTeamSignals: [
      {
        title: "Stabilniji operativni ritam",
        summary: "Tim pokazuje konzistentniji ritam u osnovnim obrascima saradnje nego u složenijim situacijama pritiska.",
      },
    ],
    dimensionOverview: {
      dimensions: [
        {
          key: "tdm_collaboration",
          label: "Saradnja i koordinacija",
          summary: "Signal sugeriše stabilniju koordinaciju u planiranim nego u nejasnim situacijama.",
        },
      ],
    },
    alignmentAndFriction: {
      alignmentSignals: [
        "Članovi uglavnom dijele slična očekivanja o osnovnim pravilima saradnje.",
      ],
      frictionSignals: [
        "Veće razlike se pojavljuju kada tim procjenjuje kako reagovati pod pritiskom ili nejasnim prioritetima.",
      ],
    },
    psychologicalSafetySignal: {
      title: "Psihološka sigurnost kao odvojen signal",
      summary: "Signal psihološke sigurnosti treba čitati zasebno od ostalih razvojnih indikatora i koristiti kao ulaz za razgovor o klimi tima.",
    },
    situationalJudgmentSignal: {
      title: "Situacijsko timsko prosuđivanje",
      summary: "SJT signal pokazuje kako tim u prosjeku rezonuje o tipičnim timskim dilemama, bez donošenja dijagnostičkih presuda.",
    },
    outcomePulseSignal: {
      title: "Outcome pulse",
      summary: "Outcome pulse ostaje odvojen signal percepcije, ne centralni dijagnostički skor tima.",
    },
    risksToWatch: [
      "Vrijedi pratiti da li se razlike u procjeni prioriteta pretvaraju u odlaganje otvorenih razgovora.",
    ],
    leadershipRecommendations: [
      "Otvoriti kratak strukturiran razgovor o tome kako tim usaglašava prioritete kada su očekivanja nejasna.",
    ],
    suggestedNextConversation: {
      title: "Pitanja za naredni timski razgovor",
      prompts: [
        "U kojim situacijama tim najlakše izgubi zajedničku sliku prioriteta i kako to najranije prepoznajemo?",
      ],
    },
    interpretationLimits: [
      "Ovaj pregled ne prikazuje individualne odgovore ni individualne score vrijednosti i ne treba ga koristiti za imenovanje pojedinaca kao problema.",
      "Nalaze treba čitati kao timske signale za razgovor, zajedno sa kontekstom rada, sastavom tima i promjenama u okruženju.",
    ],
  };

  const validation = validateTeamDynamicsExecutiveOverviewSnapshot(snapshot);

  if (!validation.ok) {
    throw new Error(
      `Mock Team Dynamics Executive Overview snapshot failed validation: ${validation.errors.join(" | ")}`,
    );
  }

  return validation.value;
}
