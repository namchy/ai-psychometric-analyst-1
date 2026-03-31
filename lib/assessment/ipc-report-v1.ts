import ipcHrReportV1SchemaJson from "@/lib/assessment/schemas/ipc-hr-report-v1.json";
import ipcParticipantReportV1SchemaJson from "@/lib/assessment/schemas/ipc-participant-report-v1.json";
import type { IpcOctantCode, IpcPrimaryDisc } from "@/lib/assessment/scoring";

type ValidationError = {
  path: string;
  message: string;
};

type IpcTitleDescriptionItem = {
  title: string;
  description: string;
};

type IpcDevelopmentRecommendationItem = {
  title: string;
  description: string;
  action: string;
};

type IpcSummary = {
  headline: string;
  overview: string;
};

type IpcStyleSnapshotBase = {
  primary_disc: IpcPrimaryDisc;
  dominant_octant: IpcOctantCode;
  secondary_octant: IpcOctantCode;
};

export type IpcParticipantReportV1 = {
  report_title: string;
  report_subtitle: string;
  summary: IpcSummary;
  style_snapshot: IpcStyleSnapshotBase;
  strengths_in_collaboration: IpcTitleDescriptionItem[];
  watchouts: IpcTitleDescriptionItem[];
  development_recommendations: IpcDevelopmentRecommendationItem[];
  disclaimer: string;
};

type IpcManagerSection = {
  summary: string;
  manager_notes: string;
};

export type IpcHrReportV1 = {
  report_title: string;
  report_subtitle: string;
  summary: IpcSummary;
  style_snapshot: IpcStyleSnapshotBase & {
    dominance: number;
    warmth: number;
  };
  communication_style: IpcManagerSection;
  collaboration_style: IpcManagerSection;
  leadership_and_influence: IpcManagerSection;
  team_watchouts: IpcTitleDescriptionItem[];
  onboarding_or_management_recommendations: IpcDevelopmentRecommendationItem[];
  disclaimer: string;
};

export type IpcCompletedAssessmentReport = IpcParticipantReportV1 | IpcHrReportV1;

export const ipcParticipantReportV1Schema = ipcParticipantReportV1SchemaJson;
export const ipcHrReportV1Schema = ipcHrReportV1SchemaJson;

const IPC_OCTANTS: IpcOctantCode[] = ["PA", "BC", "DE", "FG", "HI", "JK", "LM", "NO"];

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeTextField(value: unknown): string {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function validateExactKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  path: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push({
        path,
        message: `Unexpected property "${key}".`,
      });
    }
  }

  return errors;
}

function validateNonEmptyString(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is string {
  if (typeof value !== "string" || normalizeWhitespace(value).length === 0) {
    errors.push({
      path,
      message: "Expected a non-empty string.",
    });
    return false;
  }

  return true;
}

function validateTitleDescriptionItem(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is IpcTitleDescriptionItem {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["title", "description"], path));
  const titleOk = validateNonEmptyString(value.title, `${path}.title`, errors);
  const descriptionOk = validateNonEmptyString(value.description, `${path}.description`, errors);

  return titleOk && descriptionOk;
}

function validateDevelopmentRecommendationItem(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is IpcDevelopmentRecommendationItem {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["title", "description", "action"], path));
  const titleOk = validateNonEmptyString(value.title, `${path}.title`, errors);
  const descriptionOk = validateNonEmptyString(value.description, `${path}.description`, errors);
  const actionOk = validateNonEmptyString(value.action, `${path}.action`, errors);

  return titleOk && descriptionOk && actionOk;
}

function validateSummary(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is IpcSummary {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["headline", "overview"], path));
  const headlineOk = validateNonEmptyString(value.headline, `${path}.headline`, errors);
  const overviewOk = validateNonEmptyString(value.overview, `${path}.overview`, errors);

  return headlineOk && overviewOk;
}

function validateOctant(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is IpcOctantCode {
  if (!IPC_OCTANTS.includes(value as IpcOctantCode)) {
    errors.push({
      path,
      message: `Expected one of ${IPC_OCTANTS.join(", ")}.`,
    });
    return false;
  }

  return true;
}

function validatePrimaryDisc(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is IpcPrimaryDisc {
  if (value === null || value === "D" || value === "I" || value === "S" || value === "C") {
    return true;
  }

  errors.push({
    path,
    message: 'Expected one of "D", "I", "S", "C", or null.',
  });
  return false;
}

function normalizeTitleDescriptionItem(item: IpcTitleDescriptionItem): IpcTitleDescriptionItem {
  return {
    title: normalizeWhitespace(item.title),
    description: normalizeWhitespace(item.description),
  };
}

function normalizeDevelopmentRecommendationItem(
  item: IpcDevelopmentRecommendationItem,
): IpcDevelopmentRecommendationItem {
  return {
    title: normalizeWhitespace(item.title),
    description: normalizeWhitespace(item.description),
    action: normalizeWhitespace(item.action),
  };
}

function normalizeManagerSection(section: IpcManagerSection): IpcManagerSection {
  return {
    summary: normalizeWhitespace(section.summary),
    manager_notes: normalizeWhitespace(section.manager_notes),
  };
}

export function normalizeIpcParticipantReportV1(value: unknown): IpcParticipantReportV1 {
  const report = value as IpcParticipantReportV1;

  return {
    report_title: normalizeTextField(report.report_title),
    report_subtitle: normalizeTextField(report.report_subtitle),
    summary: {
      headline: normalizeTextField(report.summary?.headline),
      overview: normalizeTextField(report.summary?.overview),
    },
    style_snapshot: {
      primary_disc: report.style_snapshot?.primary_disc ?? null,
      dominant_octant: report.style_snapshot?.dominant_octant as IpcOctantCode,
      secondary_octant: report.style_snapshot?.secondary_octant as IpcOctantCode,
    },
    strengths_in_collaboration: Array.isArray(report.strengths_in_collaboration)
      ? report.strengths_in_collaboration.map(normalizeTitleDescriptionItem)
      : [],
    watchouts: Array.isArray(report.watchouts)
      ? report.watchouts.map(normalizeTitleDescriptionItem)
      : [],
    development_recommendations: Array.isArray(report.development_recommendations)
      ? report.development_recommendations.map(normalizeDevelopmentRecommendationItem)
      : [],
    disclaimer: normalizeTextField(report.disclaimer),
  };
}

export function normalizeIpcHrReportV1(value: unknown): IpcHrReportV1 {
  const report = value as IpcHrReportV1;

  return {
    report_title: normalizeTextField(report.report_title),
    report_subtitle: normalizeTextField(report.report_subtitle),
    summary: {
      headline: normalizeTextField(report.summary?.headline),
      overview: normalizeTextField(report.summary?.overview),
    },
    style_snapshot: {
      primary_disc: report.style_snapshot?.primary_disc ?? null,
      dominant_octant: report.style_snapshot?.dominant_octant as IpcOctantCode,
      secondary_octant: report.style_snapshot?.secondary_octant as IpcOctantCode,
      dominance:
        typeof report.style_snapshot?.dominance === "number" ? report.style_snapshot.dominance : 0,
      warmth: typeof report.style_snapshot?.warmth === "number" ? report.style_snapshot.warmth : 0,
    },
    communication_style: normalizeManagerSection(report.communication_style ?? {
      summary: "",
      manager_notes: "",
    }),
    collaboration_style: normalizeManagerSection(report.collaboration_style ?? {
      summary: "",
      manager_notes: "",
    }),
    leadership_and_influence: normalizeManagerSection(report.leadership_and_influence ?? {
      summary: "",
      manager_notes: "",
    }),
    team_watchouts: Array.isArray(report.team_watchouts)
      ? report.team_watchouts.map(normalizeTitleDescriptionItem)
      : [],
    onboarding_or_management_recommendations: Array.isArray(
      report.onboarding_or_management_recommendations,
    )
      ? report.onboarding_or_management_recommendations.map(normalizeDevelopmentRecommendationItem)
      : [],
    disclaimer: normalizeTextField(report.disclaimer),
  };
}

function validateParticipantStyleSnapshot(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is IpcParticipantReportV1["style_snapshot"] {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      ["primary_disc", "dominant_octant", "secondary_octant"],
      path,
    ),
  );

  const primaryDiscOk = validatePrimaryDisc(value.primary_disc, `${path}.primary_disc`, errors);
  const dominantOctantOk = validateOctant(
    value.dominant_octant,
    `${path}.dominant_octant`,
    errors,
  );
  const secondaryOctantOk = validateOctant(
    value.secondary_octant,
    `${path}.secondary_octant`,
    errors,
  );

  return primaryDiscOk && dominantOctantOk && secondaryOctantOk;
}

function validateHrStyleSnapshot(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is IpcHrReportV1["style_snapshot"] {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(
    ...validateExactKeys(
      value,
      ["primary_disc", "dominant_octant", "secondary_octant", "dominance", "warmth"],
      path,
    ),
  );

  validateParticipantStyleSnapshot(value, path, errors);

  if (typeof value.dominance !== "number") {
    errors.push({ path: `${path}.dominance`, message: "Expected a number." });
  }

  if (typeof value.warmth !== "number") {
    errors.push({ path: `${path}.warmth`, message: "Expected a number." });
  }

  return true;
}

function validateManagerSection(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is IpcManagerSection {
  if (!isNonArrayObject(value)) {
    errors.push({ path, message: "Expected an object." });
    return false;
  }

  errors.push(...validateExactKeys(value, ["summary", "manager_notes"], path));
  const summaryOk = validateNonEmptyString(value.summary, `${path}.summary`, errors);
  const managerNotesOk = validateNonEmptyString(
    value.manager_notes,
    `${path}.manager_notes`,
    errors,
  );

  return summaryOk && managerNotesOk;
}

export function validateIpcParticipantReportV1(value: unknown):
  | { ok: true; value: IpcParticipantReportV1 }
  | { ok: false; errors: ValidationError[] } {
  const normalized = normalizeIpcParticipantReportV1(value);
  const errors: ValidationError[] = [];

  if (!isNonArrayObject(value)) {
    return {
      ok: false,
      errors: [{ path: "", message: "Expected a report object." }],
    };
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "report_title",
        "report_subtitle",
        "summary",
        "style_snapshot",
        "strengths_in_collaboration",
        "watchouts",
        "development_recommendations",
        "disclaimer",
      ],
      "",
    ),
  );

  validateNonEmptyString(normalized.report_title, "report_title", errors);
  validateNonEmptyString(normalized.report_subtitle, "report_subtitle", errors);
  validateSummary(value.summary, "summary", errors);
  validateParticipantStyleSnapshot(value.style_snapshot, "style_snapshot", errors);
  validateNonEmptyString(normalized.disclaimer, "disclaimer", errors);

  if (
    !Array.isArray(value.strengths_in_collaboration) ||
    value.strengths_in_collaboration.length !== 3
  ) {
    errors.push({
      path: "strengths_in_collaboration",
      message: "Expected exactly 3 strengths_in_collaboration items.",
    });
  } else {
    value.strengths_in_collaboration.forEach((item, index) => {
      validateTitleDescriptionItem(item, `strengths_in_collaboration[${index}]`, errors);
    });
  }

  if (!Array.isArray(value.watchouts) || value.watchouts.length !== 2) {
    errors.push({
      path: "watchouts",
      message: "Expected exactly 2 watchouts items.",
    });
  } else {
    value.watchouts.forEach((item, index) => {
      validateTitleDescriptionItem(item, `watchouts[${index}]`, errors);
    });
  }

  if (
    !Array.isArray(value.development_recommendations) ||
    value.development_recommendations.length !== 3
  ) {
    errors.push({
      path: "development_recommendations",
      message: "Expected exactly 3 development_recommendations.",
    });
  } else {
    value.development_recommendations.forEach((item, index) => {
      validateDevelopmentRecommendationItem(
        item,
        `development_recommendations[${index}]`,
        errors,
      );
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

export function validateIpcHrReportV1(value: unknown):
  | { ok: true; value: IpcHrReportV1 }
  | { ok: false; errors: ValidationError[] } {
  const normalized = normalizeIpcHrReportV1(value);
  const errors: ValidationError[] = [];

  if (!isNonArrayObject(value)) {
    return {
      ok: false,
      errors: [{ path: "", message: "Expected a report object." }],
    };
  }

  errors.push(
    ...validateExactKeys(
      value,
      [
        "report_title",
        "report_subtitle",
        "summary",
        "style_snapshot",
        "communication_style",
        "collaboration_style",
        "leadership_and_influence",
        "team_watchouts",
        "onboarding_or_management_recommendations",
        "disclaimer",
      ],
      "",
    ),
  );

  validateNonEmptyString(normalized.report_title, "report_title", errors);
  validateNonEmptyString(normalized.report_subtitle, "report_subtitle", errors);
  validateSummary(value.summary, "summary", errors);
  validateHrStyleSnapshot(value.style_snapshot, "style_snapshot", errors);
  validateManagerSection(value.communication_style, "communication_style", errors);
  validateManagerSection(value.collaboration_style, "collaboration_style", errors);
  validateManagerSection(value.leadership_and_influence, "leadership_and_influence", errors);
  validateNonEmptyString(normalized.disclaimer, "disclaimer", errors);

  if (!Array.isArray(value.team_watchouts) || value.team_watchouts.length !== 2) {
    errors.push({
      path: "team_watchouts",
      message: "Expected exactly 2 team_watchouts items.",
    });
  } else {
    value.team_watchouts.forEach((item, index) => {
      validateTitleDescriptionItem(item, `team_watchouts[${index}]`, errors);
    });
  }

  if (
    !Array.isArray(value.onboarding_or_management_recommendations) ||
    value.onboarding_or_management_recommendations.length !== 3
  ) {
    errors.push({
      path: "onboarding_or_management_recommendations",
      message: "Expected exactly 3 onboarding_or_management_recommendations.",
    });
  } else {
    value.onboarding_or_management_recommendations.forEach((item, index) => {
      validateDevelopmentRecommendationItem(
        item,
        `onboarding_or_management_recommendations[${index}]`,
        errors,
      );
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

export function formatIpcReportValidationErrors(errors: ValidationError[]): string {
  return errors.map((error) => `${error.path || "<root>"}: ${error.message}`).join(" | ");
}
