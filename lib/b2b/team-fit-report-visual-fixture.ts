import "server-only";

import type { TeamFitReportDisplayRecord } from "@/lib/b2b/team-fit-report-display";
import { buildMockTeamFitReportSnapshot } from "@/lib/b2b/team-fit-report-mock";
import {
  TEAM_FIT_REPORT_INPUT_TYPE,
  TEAM_FIT_REPORT_INPUT_VERSION,
  type TeamFitReportInputSnapshot,
} from "@/lib/b2b/team-fit-report-input";

function buildInputSnapshot(): TeamFitReportInputSnapshot {
  return {
    inputType: TEAM_FIT_REPORT_INPUT_TYPE,
    inputVersion: TEAM_FIT_REPORT_INPUT_VERSION,
    reportType: "team_fit_report_v1" as const,
    reportVersion: "v1" as const,
    locale: "bs",
    generatedAt: "2026-05-30T12:00:00.000Z",
    organizationContext: {
      organizationId: "fixture-org",
      organizationName: "Deep Profile Dev Fixture",
    },
    teamContext: {
      teamId: "fixture-team",
      teamName: "Product Delivery Pod",
      teamSourceType: "team_dynamics_aggregation_input_snapshot" as const,
      teamSourceId: "fixture-team-source",
    },
    candidateContext: {
      participantId: "fixture-participant",
      displayName: "Lejla Candidate",
      candidateSourceType: "composite_deterministic_input_snapshot" as const,
      candidateSourceId: "fixture-candidate-source",
    },
    sourceReferences: {
      teamFitReportId: "fixture-team-fit-report",
      candidateSourceType: "composite_deterministic_input_snapshot" as const,
      candidateSourceId: "fixture-candidate-source",
      teamSourceType: "team_dynamics_aggregation_input_snapshot" as const,
      teamSourceId: "fixture-team-source",
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: {
      sourceStatus: "placeholder_pending_composite_input" as const,
      summary: null,
    },
    teamSignals: {
      sourceStatus: "placeholder_pending_team_aggregation_input" as const,
      summary: null,
    },
    interpretationGuardrails: {
      noNumericFitScore: true,
      noHireNoHire: true,
      noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true,
      noCandidateFacingOutput: true,
    },
  };
}

export function buildTeamFitVisualFixtureRecord(
  status: TeamFitReportDisplayRecord["status"],
): TeamFitReportDisplayRecord {
  const reportSnapshot = buildMockTeamFitReportSnapshot(buildInputSnapshot());

  return {
    id: `fixture-${status}`,
    organizationId: "fixture-org",
    teamId: "fixture-team",
    participantId: "fixture-participant",
    reportType: "team_fit_report_v1",
    reportVersion: "v1",
    status,
    team: {
      id: "fixture-team",
      name: "Product Delivery Pod",
    },
    candidate: {
      participantId: "fixture-participant",
      displayName: "Lejla Candidate",
    },
    createdAt: "2026-05-30T12:00:00.000Z",
    queuedAt: "2026-05-30T12:01:00.000Z",
    startedAt: status === "queued" ? null : "2026-05-30T12:03:00.000Z",
    completedAt: status === "ready" ? "2026-05-30T12:12:00.000Z" : null,
    failedAt: status === "failed" ? "2026-05-30T12:12:00.000Z" : null,
    hasInputSnapshot: true,
    hasReportSnapshot: status === "ready",
    safeStatusMessage:
      status === "queued"
        ? "Izvještaj je pripremljen za obradu."
        : status === "processing"
          ? "Izvještaj je trenutno u obradi."
          : status === "failed"
            ? "Izvještaj trenutno nije uspješno kreiran."
            : "Izvještaj je spreman za pregled.",
    reportSnapshot: status === "ready" ? reportSnapshot : null,
  };
}
