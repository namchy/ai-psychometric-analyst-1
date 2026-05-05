import "server-only";

import type { AssessmentLocale } from "@/lib/assessment/locale";
import type {
  DetailedReportV1,
  DetailedReportDimensionCode,
  DetailedReportScoreBand,
} from "@/lib/assessment/detailed-report-v1";
import {
  detailedReportV1OpenAiSchema,
  validateDetailedReportV1,
} from "@/lib/assessment/detailed-report-v1";
import { isIpipNeo120TestSlug } from "@/lib/assessment/ipip-neo-120-labels";
import {
  IPIP_NEO_120_HR_REPORT_CONTRACT,
  IPIP_NEO_120_PARTICIPANT_REPORT_CONTRACT,
  type IpipNeo120HrReportPromptInput,
  type IpipNeo120ParticipantReportPromptInput,
} from "@/lib/assessment/ipip-neo-120-report-contract";
import {
  formatIpipNeo120ReportValidationErrors,
  validateIpipNeo120HrReportV1,
  validateIpipNeo120ParticipantReportV1,
  type IpipNeo120HrReportV1,
  type IpipNeo120ParticipantReportV1,
} from "@/lib/assessment/ipip-neo-120-report-v1";
import {
  formatIpipNeo120ParticipantReportV2ValidationErrors,
  validateIpipNeo120ParticipantReportV2,
  type IpipNeo120ParticipantReportV2,
} from "@/lib/assessment/ipip-neo-120-participant-report-v2";
import {
  getIpcPromptContract,
  isIpcTestSlug,
  type IpcReportAudience,
  type IpcReportPromptInput,
} from "@/lib/assessment/ipc-report-contract";
import {
  MWMS_PARTICIPANT_REPORT_CONTRACT,
  isMwmsTestSlug,
  type MwmsParticipantReportPromptInput,
} from "@/lib/assessment/mwms-report-contract";
import {
  SAFRAN_PARTICIPANT_AI_REPORT_CONTRACT,
  isSafranTestSlug,
  validateSafranParticipantAiReport,
  type SafranAiReportInput,
  type SafranParticipantAiReport,
} from "@/lib/assessment/safran-participant-ai-report-v1";
import {
  formatMwmsParticipantReportV1ValidationErrors,
  validateMwmsParticipantReportV1,
  type MwmsParticipantReportV1,
} from "@/lib/assessment/mwms-participant-report-v1";
import {
  formatIpcReportValidationErrors,
  validateIpcHrReportV1,
  validateIpcParticipantReportV1,
  type IpcCompletedAssessmentReport,
} from "@/lib/assessment/ipc-report-v1";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import type { ScoringMethod } from "@/lib/assessment/types";
import { getIpipNeo120ParticipantReportVersion } from "@/lib/assessment/report-config";

export type ReportGeneratorType = "mock" | "openai";
export type ReportFamily = "big_five" | "ipc" | "mwms" | "safran";
export type ReportAudience = "participant" | "hr";
export type ReportVersion = "v1" | "v2";
export type ReportRenderFormat =
  | "ipip_neo_120_participant_v1"
  | "ipip_neo_120_participant_v2"
  | "big_five_participant_v1"
  | "big_five_hr_v1"
  | "ipc_participant_v1"
  | "ipc_hr_v1"
  | "mwms_participant_report_v1"
  | "safran_participant_ai_report_v1";
export type AttemptReportStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "unavailable";

export type BigFiveCompletedAssessmentReport = DetailedReportV1;
export type RuntimeCompletedAssessmentReport =
  | BigFiveCompletedAssessmentReport
  | IpipNeo120HrReportV1
  | IpipNeo120ParticipantReportV1
  | IpipNeo120ParticipantReportV2
  | IpcCompletedAssessmentReport
  | MwmsParticipantReportV1
  | SafranParticipantAiReport;
export type CompletedAssessmentReport = RuntimeCompletedAssessmentReport;

export type CompletedAssessmentReportRequest = {
  attemptId: string;
  testId: string;
  testSlug: string;
  audience: ReportAudience;
  locale: AssessmentLocale;
  scoringMethod: ScoringMethod;
  promptVersion: string;
  testName?: string | null;
  results: CompletedAssessmentResults;
};

export type AiReportDimensionInput = {
  dimension_code: DetailedReportDimensionCode;
  dimension_label: string;
  raw_score: number;
  scored_question_count: number;
  average_score: number;
  score_band: DetailedReportScoreBand;
};

export type AiReportPromptInput = {
  attempt_id: string;
  test_id: string;
  test_slug: string;
  audience: "participant" | "hr";
  locale: AssessmentLocale;
  scoring_method: ScoringMethod;
  prompt_version: string;
  scored_response_count: number;
  dimension_scores: AiReportDimensionInput[];
  deterministic_summary: {
    highest_dimension: DetailedReportDimensionCode | null;
    lowest_dimension: DetailedReportDimensionCode | null;
    dimensions_ranked: DetailedReportDimensionCode[];
  };
};

export type ReportPromptInput =
  | AiReportPromptInput
  | IpipNeo120HrReportPromptInput
  | IpipNeo120ParticipantReportPromptInput
  | IpcReportPromptInput
  | MwmsParticipantReportPromptInput
  | SafranAiReportInput;

export type ReportContractDescriptor = {
  family: ReportFamily;
  reportType: string;
  sourceType: string;
  promptKey: string;
  schemaName: string;
  outputSchemaJson: Record<string, unknown>;
};

export type PreparedReportGenerationInput = {
  attemptId: string;
  testSlug: string;
  promptVersion: string;
  promptVersionId: string | null;
  promptTemplate: ActivePromptVersion | null;
  promptInput: ReportPromptInput;
  reportContract: ReportContractDescriptor;
};

export type ReportProviderResult =
  | {
      ok: true;
      report: RuntimeCompletedAssessmentReport;
    }
  | {
      ok: false;
      reason: string;
    };

export type ReportProvider = {
  type: ReportGeneratorType;
  generateReport: (input: PreparedReportGenerationInput) => Promise<ReportProviderResult>;
};

export function isCompletedAssessmentReport(value: unknown): value is CompletedAssessmentReport {
  return (
    validateDetailedReportV1(value).ok ||
    validateIpipNeo120HrReportV1(value).ok ||
    validateIpipNeo120ParticipantReportV1(value).ok ||
    validateIpipNeo120ParticipantReportV2(value).ok ||
    validateIpcParticipantReportV1(value).ok ||
    validateIpcHrReportV1(value).ok ||
    validateMwmsParticipantReportV1(value).ok
    || validateSafranParticipantAiReport(value).ok
  );
}

export function resolveReportContract(
  testSlug: string,
  audience: IpcReportAudience,
): ReportContractDescriptor {
  if (isIpipNeo120TestSlug(testSlug) && audience === "participant") {
    return {
      family: "big_five",
      reportType: IPIP_NEO_120_PARTICIPANT_REPORT_CONTRACT.reportType,
      sourceType: IPIP_NEO_120_PARTICIPANT_REPORT_CONTRACT.sourceType,
      promptKey: IPIP_NEO_120_PARTICIPANT_REPORT_CONTRACT.promptKey,
      schemaName: IPIP_NEO_120_PARTICIPANT_REPORT_CONTRACT.schemaId,
      outputSchemaJson:
        IPIP_NEO_120_PARTICIPANT_REPORT_CONTRACT.outputSchemaJson as Record<string, unknown>,
    };
  }

  if (isIpipNeo120TestSlug(testSlug) && audience === "hr") {
    return {
      family: "big_five",
      reportType: IPIP_NEO_120_HR_REPORT_CONTRACT.reportType,
      sourceType: IPIP_NEO_120_HR_REPORT_CONTRACT.sourceType,
      promptKey: IPIP_NEO_120_HR_REPORT_CONTRACT.promptKey,
      schemaName: IPIP_NEO_120_HR_REPORT_CONTRACT.schemaId,
      outputSchemaJson:
        IPIP_NEO_120_HR_REPORT_CONTRACT.outputSchemaJson as Record<string, unknown>,
    };
  }

  if (isIpcTestSlug(testSlug)) {
    const contract = getIpcPromptContract(audience);

    return {
      family: "ipc",
      reportType: contract.reportType,
      sourceType: contract.sourceType,
      promptKey: contract.promptKey,
      schemaName: contract.schemaId,
      outputSchemaJson: contract.outputSchemaJson as Record<string, unknown>,
    };
  }

  if (isMwmsTestSlug(testSlug) && audience === "participant") {
    return {
      family: "mwms",
      reportType: MWMS_PARTICIPANT_REPORT_CONTRACT.reportType,
      sourceType: MWMS_PARTICIPANT_REPORT_CONTRACT.sourceType,
      promptKey: MWMS_PARTICIPANT_REPORT_CONTRACT.promptKey,
      schemaName: MWMS_PARTICIPANT_REPORT_CONTRACT.schemaId,
      outputSchemaJson:
        MWMS_PARTICIPANT_REPORT_CONTRACT.outputSchemaJson as Record<string, unknown>,
    };
  }

  if (isSafranTestSlug(testSlug) && audience === "participant") {
    return {
      family: "safran",
      reportType: SAFRAN_PARTICIPANT_AI_REPORT_CONTRACT.reportType,
      sourceType: SAFRAN_PARTICIPANT_AI_REPORT_CONTRACT.sourceType,
      promptKey: SAFRAN_PARTICIPANT_AI_REPORT_CONTRACT.promptKey,
      schemaName: SAFRAN_PARTICIPANT_AI_REPORT_CONTRACT.schemaId,
      outputSchemaJson:
        SAFRAN_PARTICIPANT_AI_REPORT_CONTRACT.outputSchemaJson as Record<
          string,
          unknown
        >,
    };
  }

  return {
    family: "big_five",
    reportType: "individual",
    sourceType: "single_test",
    promptKey: "completed_assessment_report",
    schemaName: "detailed_report_v1",
    outputSchemaJson: detailedReportV1OpenAiSchema as Record<string, unknown>,
  };
}

export function resolveReportFamily(testSlug: string): ReportFamily {
  if (isIpcTestSlug(testSlug)) {
    return "ipc";
  }

  if (isMwmsTestSlug(testSlug)) {
    return "mwms";
  }

  if (isSafranTestSlug(testSlug)) {
    return "safran";
  }

  return "big_five";
}

export function resolveReportSignal(context: {
  testSlug: string;
  audience: ReportAudience;
}): {
  reportFamily: ReportFamily;
  reportAudience: ReportAudience;
  reportVersion: ReportVersion;
  reportRenderFormat: ReportRenderFormat | null;
} {
  const reportFamily = resolveReportFamily(context.testSlug);
  const reportAudience = context.audience;
  const reportVersion =
    isIpipNeo120TestSlug(context.testSlug) && context.audience === "participant"
      ? getIpipNeo120ParticipantReportVersion()
      : "v1";
  const reportRenderFormat =
    isIpipNeo120TestSlug(context.testSlug) && context.audience === "participant"
      ? reportVersion === "v2"
        ? "ipip_neo_120_participant_v2"
        : "ipip_neo_120_participant_v1"
      : isMwmsTestSlug(context.testSlug) && context.audience === "participant"
        ? "mwms_participant_report_v1"
      : isSafranTestSlug(context.testSlug) && context.audience === "participant"
        ? "safran_participant_ai_report_v1"
      : resolveReportRenderFormat({
          reportFamily,
          reportAudience,
          reportVersion,
        });

  return {
    reportFamily,
    reportAudience,
    reportVersion,
    reportRenderFormat,
  };
}

export function resolveReportRenderFormat(context: {
  reportFamily: ReportFamily;
  reportAudience: ReportAudience;
  reportVersion: ReportVersion;
}): ReportRenderFormat | null {
  const key = `${context.reportFamily}:${context.reportAudience}:${context.reportVersion}`;

  switch (key) {
    case "big_five:participant:v1":
      return "big_five_participant_v1";
    case "big_five:hr:v1":
      return "big_five_hr_v1";
    case "ipc:participant:v1":
      return "ipc_participant_v1";
    case "ipc:hr:v1":
      return "ipc_hr_v1";
    case "mwms:participant:v1":
      return "mwms_participant_report_v1";
    case "safran:participant:v1":
      return "safran_participant_ai_report_v1";
    default:
      return null;
  }
}

export function validateRuntimeCompletedAssessmentReport(
  value: unknown,
  context: {
    testSlug: string;
    audience: ReportAudience;
  },
): 
  | { ok: true; value: RuntimeCompletedAssessmentReport }
  | { ok: false; reason: string } {
  if (isIpipNeo120TestSlug(context.testSlug) && context.audience === "participant") {
    const v1ValidationResult = validateIpipNeo120ParticipantReportV1(value);

    if (v1ValidationResult.ok) {
      return {
        ok: true,
        value: v1ValidationResult.value,
      };
    }

    const v2ValidationResult = validateIpipNeo120ParticipantReportV2(value);

    if (v2ValidationResult.ok) {
      return {
        ok: true,
        value: v2ValidationResult.value,
      };
    }

    return {
      ok: false,
      reason: [
        "V1:",
        formatIpipNeo120ReportValidationErrors(v1ValidationResult.errors),
        "V2:",
        formatIpipNeo120ParticipantReportV2ValidationErrors(v2ValidationResult.errors),
      ].join(" "),
    };
  }

  if (isIpipNeo120TestSlug(context.testSlug) && context.audience === "hr") {
    const validationResult = validateIpipNeo120HrReportV1(value);

    if (!validationResult.ok) {
      return {
        ok: false,
        reason: formatIpipNeo120ReportValidationErrors(validationResult.errors),
      };
    }

    return {
      ok: true,
      value: validationResult.value,
    };
  }

  if (isIpcTestSlug(context.testSlug)) {
    const validationResult =
      context.audience === "participant"
        ? validateIpcParticipantReportV1(value)
        : validateIpcHrReportV1(value);

    if (!validationResult.ok) {
      return {
        ok: false,
        reason: formatIpcReportValidationErrors(validationResult.errors),
      };
    }

    return {
      ok: true,
      value: validationResult.value,
    };
  }

  if (isMwmsTestSlug(context.testSlug) && context.audience === "participant") {
    const validationResult = validateMwmsParticipantReportV1(value);

    if (!validationResult.ok) {
      return {
        ok: false,
        reason: formatMwmsParticipantReportV1ValidationErrors(validationResult.errors),
      };
    }

    return {
      ok: true,
      value: validationResult.value,
    };
  }

  if (isSafranTestSlug(context.testSlug) && context.audience === "participant") {
    const validationResult = validateSafranParticipantAiReport(value);

    if (!validationResult.ok) {
      return {
        ok: false,
        reason: validationResult.errors.join(" | "),
      };
    }

    return {
      ok: true,
      value: validationResult.value,
    };
  }

  const validationResult = validateDetailedReportV1(value);

  if (!validationResult.ok) {
    return {
      ok: false,
      reason: validationResult.errors.map((error) => `${error.path || "<root>"}: ${error.message}`).join(" | "),
    };
  }

  return {
    ok: true,
    value: validationResult.value,
  };
}

export function isAttemptReportStatus(value: unknown): value is AttemptReportStatus {
  return (
    value === "queued" ||
    value === "processing" ||
    value === "ready" ||
    value === "failed" ||
    value === "unavailable"
  );
}
