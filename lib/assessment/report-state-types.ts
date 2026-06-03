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
  | "mwms_hr_report_v1"
  | "safran_participant_ai_report_v1"
  | "safran_hr_report_v1";

export type CompletedAssessmentReportSnapshot = unknown;

type AttemptReportLifecycleState = {
  generatorType: ReportGeneratorType | null;
  generatedAt: string;
  completedAt: string | null;
};

export type CompletedAssessmentReportState =
  | {
      status: "queued" | "processing";
    } & AttemptReportLifecycleState
  | {
      status: "ready";
      reportFamily: ReportFamily;
      reportAudience: ReportAudience;
      reportVersion: ReportVersion;
      reportRenderFormat: ReportRenderFormat | null;
      report: CompletedAssessmentReportSnapshot;
    }
  | {
      status: "failed" | "unavailable";
    } & AttemptReportLifecycleState & {
      failureCode: string | null;
      failureReason: string | null;
    };
