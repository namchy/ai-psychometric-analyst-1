import "server-only";

import {
  type TeamFitReportV1,
  validateTeamFitReportSnapshot,
} from "@/lib/b2b/team-fit-report-contract";
import { type TeamFitReportInputSnapshot } from "@/lib/b2b/team-fit-report-input";
import { buildMockTeamFitReportSnapshot } from "@/lib/b2b/team-fit-report-mock";

export type TeamFitReportProviderFailureReason =
  | "provider_config_error"
  | "provider_request_failed"
  | "provider_parse_failure"
  | "provider_validation_failure"
  | "provider_unknown_error";

export type TeamFitReportProviderResult =
  | {
      ok: true;
      snapshot: TeamFitReportV1;
      providerMetadata?: {
        provider?: string;
        providerVersion?: string;
        model?: string;
      };
    }
  | {
      ok: false;
      reason: TeamFitReportProviderFailureReason;
      message: string;
      retryable?: boolean;
    };

export type TeamFitReportProvider = {
  generate(inputSnapshot: TeamFitReportInputSnapshot): Promise<TeamFitReportProviderResult>;
};

export type ValidateTeamFitProviderSnapshotResult = TeamFitReportProviderResult;

export type TeamFitFakeProviderFailureMode =
  | "config_error"
  | "request_failed"
  | "parse_failure"
  | "validation_failure";

export type CreateTeamFitFakeProviderOptions = {
  providerMetadata?: {
    provider?: string;
    providerVersion?: string;
    model?: string;
  };
  buildSnapshot?: (inputSnapshot: TeamFitReportInputSnapshot) => TeamFitReportV1;
  invalidSnapshot?:
    | TeamFitReportV1
    | ((inputSnapshot: TeamFitReportInputSnapshot) => TeamFitReportV1);
  failureMode?: TeamFitFakeProviderFailureMode;
};

function mapFakeFailureReason(
  failureMode: TeamFitFakeProviderFailureMode,
): TeamFitReportProviderFailureReason {
  switch (failureMode) {
    case "config_error":
      return "provider_config_error";
    case "request_failed":
      return "provider_request_failed";
    case "parse_failure":
      return "provider_parse_failure";
    case "validation_failure":
    default:
      return "provider_validation_failure";
  }
}

function buildFakeFailureMessage(failureMode: TeamFitFakeProviderFailureMode): string {
  switch (failureMode) {
    case "config_error":
      return "Team Fit fake provider configuration error.";
    case "request_failed":
      return "Team Fit fake provider request failed.";
    case "parse_failure":
      return "Team Fit fake provider parse failed.";
    case "validation_failure":
    default:
      return "Team Fit fake provider validation failed.";
  }
}

export function validateTeamFitProviderSnapshotResult(snapshot: TeamFitReportV1): ValidateTeamFitProviderSnapshotResult {
  const validation = validateTeamFitReportSnapshot(snapshot);

  if (!validation.ok) {
    return {
      ok: false,
      reason: "provider_validation_failure",
      message: validation.errors.join(" | "),
      retryable: false,
    };
  }

  return {
    ok: true,
    snapshot: validation.snapshot,
  };
}

export function createTeamFitFakeProvider(
  options: CreateTeamFitFakeProviderOptions = {},
): TeamFitReportProvider {
  return {
    async generate(inputSnapshot: TeamFitReportInputSnapshot): Promise<TeamFitReportProviderResult> {
      if (options.failureMode) {
        return {
          ok: false,
          reason: mapFakeFailureReason(options.failureMode),
          message: buildFakeFailureMessage(options.failureMode),
          retryable: options.failureMode === "request_failed",
        };
      }

      const baseSnapshot =
        options.buildSnapshot?.(inputSnapshot) ?? buildMockTeamFitReportSnapshot(inputSnapshot);
      const candidateSnapshot =
        typeof options.invalidSnapshot === "function"
          ? options.invalidSnapshot(inputSnapshot)
          : options.invalidSnapshot ?? baseSnapshot;
      const validated = validateTeamFitProviderSnapshotResult(candidateSnapshot);

      if (!validated.ok) {
        return validated;
      }

      return {
        ok: true,
        snapshot: validated.snapshot,
        providerMetadata: options.providerMetadata,
      };
    },
  };
}
