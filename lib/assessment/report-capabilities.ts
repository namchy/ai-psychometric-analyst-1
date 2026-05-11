import { isIpipNeo120TestSlug } from "@/lib/assessment/ipip-neo-120-labels";
import { isMwmsTestSlug } from "@/lib/assessment/mwms-report-contract";
import { isSafranTestSlug } from "@/lib/assessment/safran-participant-ai-report-v1";
import type { AttemptReportStatus, ReportAudience } from "@/lib/assessment/report-providers";

export type ReportCapabilityStatus = "active" | "planned" | "inactive";
export type ReportCapabilityReason = "not_implemented" | "unsupported" | "unknown_test";
export type ReportCapabilityReportType = "individual";
export type ReportCapabilitySourceType = "single_test";

export type ReportGenerationCapability = {
  active: boolean;
  status: ReportCapabilityStatus;
  reason?: ReportCapabilityReason;
};

export type ReportCapabilitySelector = {
  testSlug: string;
  audience: ReportAudience;
  reportType: ReportCapabilityReportType;
  sourceType: ReportCapabilitySourceType;
};

export type ExistingAttemptReportArtifact = {
  audience: ReportAudience;
  report_type: string;
  source_type: string;
  report_status: AttemptReportStatus;
  test_slug?: string | null;
};

export type PlannedPostCompletionReportJob = {
  audience: ReportAudience;
  reportType: ReportCapabilityReportType;
  sourceType: ReportCapabilitySourceType;
};

export type PostCompletionReportLanePlan = {
  audience: ReportAudience;
  capability: ReportGenerationCapability;
  existingStatus: AttemptReportStatus | null;
  shouldEnqueue: boolean;
};

export type PostCompletionReportPlan = {
  testSlug: string;
  lanes: PostCompletionReportLanePlan[];
  jobsToEnqueue: PlannedPostCompletionReportJob[];
};

const INDIVIDUAL_SINGLE_TEST_LANE = {
  reportType: "individual",
  sourceType: "single_test",
} as const;

function resolveKnownTestCapability(testSlug: string, audience: ReportAudience): ReportGenerationCapability {
  if (isIpipNeo120TestSlug(testSlug)) {
    return { active: true, status: "active" };
  }

  if (isSafranTestSlug(testSlug)) {
    return { active: true, status: "active" };
  }

  if (isMwmsTestSlug(testSlug)) {
    return audience === "participant"
      ? { active: true, status: "active" }
      : { active: false, status: "planned", reason: "not_implemented" };
  }

  return { active: false, status: "inactive", reason: "unknown_test" };
}

export function getReportGenerationCapability(
  selector: ReportCapabilitySelector,
): ReportGenerationCapability {
  if (
    selector.reportType !== INDIVIDUAL_SINGLE_TEST_LANE.reportType ||
    selector.sourceType !== INDIVIDUAL_SINGLE_TEST_LANE.sourceType
  ) {
    return {
      active: false,
      status: "inactive",
      reason: "unsupported",
    };
  }

  return resolveKnownTestCapability(selector.testSlug, selector.audience);
}

function findExistingLaneStatus(
  existingReports: ExistingAttemptReportArtifact[],
  audience: ReportAudience,
): AttemptReportStatus | null {
  const report = existingReports.find(
    (candidate) =>
      candidate.audience === audience &&
      candidate.report_type === INDIVIDUAL_SINGLE_TEST_LANE.reportType &&
      candidate.source_type === INDIVIDUAL_SINGLE_TEST_LANE.sourceType,
  );

  return report?.report_status ?? null;
}

export function planPostCompletionReportJobs(input: {
  testSlug: string;
  existingReports: ExistingAttemptReportArtifact[];
}): PostCompletionReportPlan {
  const audiences: ReportAudience[] = ["participant", "hr"];
  const lanes = audiences.map((audience) => {
    const capability = getReportGenerationCapability({
      testSlug: input.testSlug,
      audience,
      reportType: INDIVIDUAL_SINGLE_TEST_LANE.reportType,
      sourceType: INDIVIDUAL_SINGLE_TEST_LANE.sourceType,
    });
    const existingStatus = findExistingLaneStatus(input.existingReports, audience);

    return {
      audience,
      capability,
      existingStatus,
      shouldEnqueue: capability.active && existingStatus === null,
    } satisfies PostCompletionReportLanePlan;
  });

  return {
    testSlug: input.testSlug,
    lanes,
    jobsToEnqueue: lanes
      .filter((lane) => lane.shouldEnqueue)
      .map((lane) => ({
        audience: lane.audience,
        reportType: INDIVIDUAL_SINGLE_TEST_LANE.reportType,
        sourceType: INDIVIDUAL_SINGLE_TEST_LANE.sourceType,
      })),
  };
}
