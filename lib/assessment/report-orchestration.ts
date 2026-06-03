import "server-only";

import {
  buildCompositeReadinessForAssignment,
  createQueuedCompositeAssessmentReport,
  loadLatestActiveStandardAssessmentAssignment,
  type CompositeAssessmentReportQueueResult,
  type CompositeReadinessState,
} from "@/lib/assessment/assessment-reports";
import {
  claimNextAssessmentReportJob,
  processClaimedAssessmentReportJob,
  type ProcessClaimedAssessmentReportJobResult,
} from "@/lib/assessment/assessment-report-worker";
import {
  claimNextReportJob,
  processClaimedReportJob,
  type ClaimedReportJob,
  type ProcessClaimedReportJobResult,
} from "@/lib/assessment/report-job-worker";
import { enqueueCompletedAssessmentReports } from "@/lib/assessment/reports";
import type { ReportAudience } from "@/lib/assessment/report-providers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CompletionAttemptContext = {
  attemptId: string;
  participantId: string | null;
  organizationId: string | null;
  status: "in_progress" | "completed" | "abandoned";
  completedAt: string | null;
  testSlug: string;
};

type AssignmentAttemptLink = {
  assessmentAssignmentId: string;
  attemptId: string;
  requiredForComposite: boolean;
};

type ReportOrchestrationDependencies = {
  loadAttemptContext?: (attemptId: string) => Promise<CompletionAttemptContext | null>;
  enqueueAttemptReports?: typeof enqueueCompletedAssessmentReports;
  claimAttemptReportJob?: (selector: {
    attemptId: string;
    audience: ReportAudience;
  }) => Promise<ClaimedReportJob | null>;
  processAttemptReportJob?: (
    job: ClaimedReportJob,
  ) => Promise<ProcessClaimedReportJobResult>;
  loadLatestActiveAssignment?: typeof loadLatestActiveStandardAssessmentAssignment;
  loadAssignmentLinkForAttempt?: (input: {
    assessmentAssignmentId: string;
    attemptId: string;
  }) => Promise<AssignmentAttemptLink | null>;
  buildCompositeReadiness?: (input: {
    assessmentAssignmentId: string;
  }) => Promise<CompositeReadinessState>;
  createQueuedCompositeReport?: typeof createQueuedCompositeAssessmentReport;
  claimCompositeReportJob?: (options: {
    assessmentAssignmentId: string;
  }) => Promise<Awaited<ReturnType<typeof claimNextAssessmentReportJob>>>;
  processCompositeReportJob?: (
    job: NonNullable<Awaited<ReturnType<typeof claimNextAssessmentReportJob>>>,
  ) => Promise<ProcessClaimedAssessmentReportJobResult>;
  logger?: Pick<Console, "error" | "warn" | "info">;
};

type AttemptReportProcessingOutcome = {
  audience: ReportAudience;
  claimedReportId: string | null;
  result: ProcessClaimedReportJobResult["status"] | "not_found";
};

type CompositeProcessingOutcome = {
  assignmentId: string | null;
  linkedAttempt: boolean;
  readinessStatus: CompositeReadinessState["status"] | null;
  queueAction: CompositeAssessmentReportQueueResult["action"] | "skipped" | "error";
  claimedReportId: string | null;
  result: ProcessClaimedAssessmentReportJobResult["status"] | "not_found" | "skipped";
};

export type AttemptCompletionReportOrchestrationResult = {
  attemptId: string;
  enqueueSummary: Awaited<ReturnType<typeof enqueueCompletedAssessmentReports>> | null;
  attemptReportProcessing: AttemptReportProcessingOutcome[];
  compositeProcessing: CompositeProcessingOutcome;
  errors: string[];
};

function getLogger(deps?: ReportOrchestrationDependencies): Pick<Console, "error" | "warn" | "info"> {
  return deps?.logger ?? console;
}

async function loadCompletionAttemptContext(attemptId: string): Promise<CompletionAttemptContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attempts")
    .select("id, participant_id, organization_id, status, completed_at, tests!inner(slug)")
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load attempt completion context: ${error.message}`);
  }

  const attempt = data as
    | {
        id: string;
        participant_id: string | null;
        organization_id: string | null;
        status: "in_progress" | "completed" | "abandoned";
        completed_at: string | null;
        tests: { slug: string } | { slug: string }[] | null;
      }
    | null;

  const testsRelation = attempt?.tests;
  const test = Array.isArray(testsRelation) ? testsRelation[0] ?? null : testsRelation;

  if (!attempt || !test?.slug) {
    return null;
  }

  return {
    attemptId: attempt.id,
    participantId: attempt.participant_id,
    organizationId: attempt.organization_id,
    status: attempt.status,
    completedAt: attempt.completed_at,
    testSlug: test.slug,
  };
}

async function loadAssignmentLinkForAttempt(input: {
  assessmentAssignmentId: string;
  attemptId: string;
}): Promise<AssignmentAttemptLink | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_assignment_attempts")
    .select("assessment_assignment_id, attempt_id, required_for_composite")
    .eq("assessment_assignment_id", input.assessmentAssignmentId)
    .eq("attempt_id", input.attemptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load assessment assignment link for attempt: ${error.message}`);
  }

  const row = data as
    | {
        assessment_assignment_id: string;
        attempt_id: string;
        required_for_composite: boolean;
      }
    | null;

  if (!row) {
    return null;
  }

  return {
    assessmentAssignmentId: row.assessment_assignment_id,
    attemptId: row.attempt_id,
    requiredForComposite: row.required_for_composite,
  };
}

async function processAttemptLevelReports(
  attemptId: string,
  deps?: ReportOrchestrationDependencies,
): Promise<{
  outcomes: AttemptReportProcessingOutcome[];
  errors: string[];
}> {
  const claimJob = deps?.claimAttemptReportJob ?? claimNextReportJob;
  const processJob = deps?.processAttemptReportJob ?? processClaimedReportJob;
  const outcomes: AttemptReportProcessingOutcome[] = [];
  const errors: string[] = [];

  for (const audience of ["participant", "hr"] as const) {
    try {
      const job = await claimJob({
        attemptId,
        audience,
      });

      if (!job) {
        outcomes.push({
          audience,
          claimedReportId: null,
          result: "not_found",
        });
        continue;
      }

      const result = await processJob(job);
      outcomes.push({
        audience,
        claimedReportId: job.id,
        result: result.status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${audience} attempt worker failed: ${message}`);
      outcomes.push({
        audience,
        claimedReportId: null,
        result: "not_found",
      });
    }
  }

  return {
    outcomes,
    errors,
  };
}

async function processCompositeReportIfQueued(input: {
  assessmentAssignmentId: string;
  readiness: CompositeReadinessState;
  deps?: ReportOrchestrationDependencies;
}): Promise<Pick<CompositeProcessingOutcome, "claimedReportId" | "result">> {
  if (input.readiness.status !== "ready") {
    return {
      claimedReportId: null,
      result: "skipped",
    };
  }

  const claimJob = input.deps?.claimCompositeReportJob ?? claimNextAssessmentReportJob;
  const processJob = input.deps?.processCompositeReportJob ?? processClaimedAssessmentReportJob;
  const job = await claimJob({
    assessmentAssignmentId: input.assessmentAssignmentId,
  });

  if (!job) {
    return {
      claimedReportId: null,
      result: "not_found",
    };
  }

  const result = await processJob(job);

  return {
    claimedReportId: job.id,
    result: result.status,
  };
}

export async function orchestrateReportsAfterAttemptCompletion(
  input: {
    attemptId: string;
    participantId?: string | null;
    organizationId?: string | null;
  },
  deps?: ReportOrchestrationDependencies,
): Promise<AttemptCompletionReportOrchestrationResult> {
  const logger = getLogger(deps);
  const loadAttempt = deps?.loadAttemptContext ?? loadCompletionAttemptContext;
  const enqueueAttemptReports = deps?.enqueueAttemptReports ?? enqueueCompletedAssessmentReports;
  const loadLatestActiveAssignment =
    deps?.loadLatestActiveAssignment ?? loadLatestActiveStandardAssessmentAssignment;
  const loadAssignmentLink =
    deps?.loadAssignmentLinkForAttempt ?? loadAssignmentLinkForAttempt;
  const buildReadiness = deps?.buildCompositeReadiness ?? buildCompositeReadinessForAssignment;
  const queueCompositeReport =
    deps?.createQueuedCompositeReport ?? createQueuedCompositeAssessmentReport;
  const errors: string[] = [];
  let enqueueSummary: Awaited<ReturnType<typeof enqueueCompletedAssessmentReports>> | null = null;

  const attempt = await loadAttempt(input.attemptId);

  const compositeProcessing: CompositeProcessingOutcome = {
    assignmentId: null,
    linkedAttempt: false,
    readinessStatus: null,
    queueAction: "skipped",
    claimedReportId: null,
    result: "skipped",
  };

  if (!attempt || attempt.status !== "completed") {
    return {
      attemptId: input.attemptId,
      enqueueSummary: null,
      attemptReportProcessing: [],
      compositeProcessing,
      errors,
    };
  }

  try {
    enqueueSummary = await enqueueAttemptReports(input.attemptId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`attempt enqueue failed: ${message}`);
    logger.error("Report orchestration single-test enqueue failed", {
      attemptId: input.attemptId,
      errorMessage: message,
    });
  }

  let attemptReportProcessing: AttemptReportProcessingOutcome[] = [];

  try {
    const attemptProcessing = await processAttemptLevelReports(input.attemptId, deps);
    attemptReportProcessing = attemptProcessing.outcomes;
    errors.push(...attemptProcessing.errors);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`attempt processing failed: ${message}`);
    logger.error("Report orchestration scoped attempt worker failed", {
      attemptId: input.attemptId,
      errorMessage: message,
    });
  }

  const participantId = input.participantId ?? attempt.participantId;
  const organizationId = input.organizationId ?? attempt.organizationId;

  if (!participantId || !organizationId) {
    return {
      attemptId: input.attemptId,
      enqueueSummary,
      attemptReportProcessing,
      compositeProcessing,
      errors,
    };
  }

  try {
    const assignment = await loadLatestActiveAssignment({
      organizationId,
      participantId,
    });

    if (!assignment) {
      return {
        attemptId: input.attemptId,
        enqueueSummary,
        attemptReportProcessing,
        compositeProcessing,
        errors,
      };
    }

    compositeProcessing.assignmentId = assignment.id;
    const link = await loadAssignmentLink({
      assessmentAssignmentId: assignment.id,
      attemptId: input.attemptId,
    });

    if (!link) {
      return {
        attemptId: input.attemptId,
        enqueueSummary,
        attemptReportProcessing,
        compositeProcessing,
        errors,
      };
    }

    compositeProcessing.linkedAttempt = true;

    const readiness = await buildReadiness({
      assessmentAssignmentId: assignment.id,
    });
    compositeProcessing.readinessStatus = readiness.status;

    let queueResult: CompositeAssessmentReportQueueResult | null = null;

    if (readiness.status === "ready") {
      queueResult = await queueCompositeReport({
        organizationId,
        participantId,
        assessmentAssignmentId: assignment.id,
      });
      compositeProcessing.queueAction = queueResult.action;
    } else {
      compositeProcessing.queueAction = "skipped";
    }

    const processedComposite = await processCompositeReportIfQueued({
      assessmentAssignmentId: assignment.id,
      readiness,
      deps,
    });

    compositeProcessing.claimedReportId = processedComposite.claimedReportId;
    compositeProcessing.result = processedComposite.result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`composite orchestration failed: ${message}`);
    compositeProcessing.queueAction = "error";
    logger.error("Report orchestration composite stage failed", {
      attemptId: input.attemptId,
      participantId,
      organizationId,
      errorMessage: message,
    });
  }

  return {
    attemptId: input.attemptId,
    enqueueSummary,
    attemptReportProcessing,
    compositeProcessing,
    errors,
  };
}
