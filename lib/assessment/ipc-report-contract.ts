import type { AssessmentLocale } from "@/lib/assessment/locale";
import ipcHrReportV1SchemaJson from "@/lib/assessment/schemas/ipc-hr-report-v1.json";
import ipcParticipantReportV1SchemaJson from "@/lib/assessment/schemas/ipc-participant-report-v1.json";
import type {
  IpcDerivedResults,
  IpcOctantCode,
  IpcPrimaryDisc,
} from "@/lib/assessment/scoring";
import type { ScoringMethod } from "@/lib/assessment/types";

export const IPC_REPORT_TYPE = "individual";
export const IPC_REPORT_SOURCE_TYPE = "single_test";
export const IPC_TEST_FAMILY = "ipip_ipc";
export const IPC_PARTICIPANT_PROMPT_KEY = "ipc_participant_report_v1";
export const IPC_HR_PROMPT_KEY = "ipc_hr_report_v1";

export type IpcReportAudience = "participant" | "hr";
export type IpcTestFamily = typeof IPC_TEST_FAMILY;
export type IpcReportType = typeof IPC_REPORT_TYPE;
export type IpcReportSourceType = typeof IPC_REPORT_SOURCE_TYPE;
export type IpcPromptKey =
  | typeof IPC_PARTICIPANT_PROMPT_KEY
  | typeof IPC_HR_PROMPT_KEY;

export type IpcRawOctantScores = Record<IpcOctantCode, number>;

export type IpcDerivedPromptBlock = Pick<
  IpcDerivedResults,
  "dominance" | "warmth" | "primaryDisc" | "dominantOctant" | "secondaryOctant"
>;

export type IpcReportPromptInput = {
  attemptId: string;
  testId: string;
  testSlug: string;
  testFamily: IpcTestFamily;
  audience: IpcReportAudience;
  locale: AssessmentLocale;
  scoringMethod: ScoringMethod;
  rawOctants: IpcRawOctantScores;
  derived: IpcDerivedPromptBlock;
};

export type IpcStyleSnapshot = {
  primaryDisc: IpcPrimaryDisc;
  dominantOctant: IpcOctantCode;
  secondaryOctant: IpcOctantCode;
};

export type IpcParticipantSchemaReference = {
  audience: "participant";
  schemaId: "ipc-participant-report-v1";
  schemaPath: "@/lib/assessment/schemas/ipc-participant-report-v1.json";
  outputSchemaJson: typeof ipcParticipantReportV1SchemaJson;
  promptKey: typeof IPC_PARTICIPANT_PROMPT_KEY;
};

export type IpcHrSchemaReference = {
  audience: "hr";
  schemaId: "ipc-hr-report-v1";
  schemaPath: "@/lib/assessment/schemas/ipc-hr-report-v1.json";
  outputSchemaJson: typeof ipcHrReportV1SchemaJson;
  promptKey: typeof IPC_HR_PROMPT_KEY;
};

export type IpcPromptContractDefinition =
  | (IpcParticipantSchemaReference & {
      reportType: IpcReportType;
      sourceType: IpcReportSourceType;
      testFamily: IpcTestFamily;
      audienceGuidance:
        "Focus on interpersonal style, collaboration, communication, and developmental guidance without heavy HR language.";
    })
  | (IpcHrSchemaReference & {
      reportType: IpcReportType;
      sourceType: IpcReportSourceType;
      testFamily: IpcTestFamily;
      audienceGuidance:
        "Focus on communication style, collaboration, leadership and influence, team watchouts, and onboarding or management recommendations without hiring judgments or clinical claims.";
    });

export const IPC_PARTICIPANT_REPORT_CONTRACT: IpcPromptContractDefinition = {
  audience: "participant",
  reportType: IPC_REPORT_TYPE,
  sourceType: IPC_REPORT_SOURCE_TYPE,
  testFamily: IPC_TEST_FAMILY,
  promptKey: IPC_PARTICIPANT_PROMPT_KEY,
  schemaId: "ipc-participant-report-v1",
  schemaPath: "@/lib/assessment/schemas/ipc-participant-report-v1.json",
  outputSchemaJson: ipcParticipantReportV1SchemaJson,
  audienceGuidance:
    "Focus on interpersonal style, collaboration, communication, and developmental guidance without heavy HR language.",
};

export const IPC_HR_REPORT_CONTRACT: IpcPromptContractDefinition = {
  audience: "hr",
  reportType: IPC_REPORT_TYPE,
  sourceType: IPC_REPORT_SOURCE_TYPE,
  testFamily: IPC_TEST_FAMILY,
  promptKey: IPC_HR_PROMPT_KEY,
  schemaId: "ipc-hr-report-v1",
  schemaPath: "@/lib/assessment/schemas/ipc-hr-report-v1.json",
  outputSchemaJson: ipcHrReportV1SchemaJson,
  audienceGuidance:
    "Focus on communication style, collaboration, leadership and influence, team watchouts, and onboarding or management recommendations without hiring judgments or clinical claims.",
};

export const IPC_REPORT_CONTRACTS: Record<IpcReportAudience, IpcPromptContractDefinition> = {
  participant: IPC_PARTICIPANT_REPORT_CONTRACT,
  hr: IPC_HR_REPORT_CONTRACT,
};

export function getIpcPromptContract(
  audience: IpcReportAudience,
): IpcPromptContractDefinition {
  return IPC_REPORT_CONTRACTS[audience];
}
