export const TEAM_FIT_REPORT_V1_TYPE = "team_fit_report_v1" as const;
export const TEAM_FIT_REPORT_V1_VERSION = "v1" as const;
export const TEAM_FIT_REPORT_V2_TYPE = "team_fit_report_v2" as const;
export const TEAM_FIT_REPORT_V2_VERSION = "v2" as const;

export const TEAM_FIT_REPORT_V1_IDENTITY = Object.freeze({
  reportType: TEAM_FIT_REPORT_V1_TYPE,
  reportVersion: TEAM_FIT_REPORT_V1_VERSION,
} as const);

export const TEAM_FIT_REPORT_V2_IDENTITY = Object.freeze({
  reportType: TEAM_FIT_REPORT_V2_TYPE,
  reportVersion: TEAM_FIT_REPORT_V2_VERSION,
} as const);

export type TeamFitReportIdentity =
  | typeof TEAM_FIT_REPORT_V1_IDENTITY
  | typeof TEAM_FIT_REPORT_V2_IDENTITY;

export type TeamFitReportType = TeamFitReportIdentity["reportType"];
export type TeamFitReportVersion = TeamFitReportIdentity["reportVersion"];

export function resolveTeamFitReportIdentity(
  reportType: unknown,
  reportVersion: unknown,
): TeamFitReportIdentity | null {
  if (
    reportType === TEAM_FIT_REPORT_V1_TYPE &&
    reportVersion === TEAM_FIT_REPORT_V1_VERSION
  ) {
    return TEAM_FIT_REPORT_V1_IDENTITY;
  }

  if (
    reportType === TEAM_FIT_REPORT_V2_TYPE &&
    reportVersion === TEAM_FIT_REPORT_V2_VERSION
  ) {
    return TEAM_FIT_REPORT_V2_IDENTITY;
  }

  return null;
}

export function isTeamFitReportIdentity(
  value: unknown,
): value is TeamFitReportIdentity {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as {
    reportType?: unknown;
    reportVersion?: unknown;
  };

  return resolveTeamFitReportIdentity(
    candidate.reportType,
    candidate.reportVersion,
  ) !== null;
}
