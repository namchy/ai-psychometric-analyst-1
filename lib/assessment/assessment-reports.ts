import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { STANDARD_ASSESSMENT_BATTERY_SLUGS } from "@/lib/assessment/standard-battery";

export const ASSESSMENT_REPORT_TYPES = ["composite"] as const;
export const ASSESSMENT_REPORT_AUDIENCES = ["hr"] as const;
export const ASSESSMENT_REPORT_SOURCE_TYPES = ["assessment"] as const;
export const ASSESSMENT_REPORT_STATUSES = ["queued", "processing", "ready", "failed"] as const;

export type AssessmentReportType = (typeof ASSESSMENT_REPORT_TYPES)[number];
export type AssessmentReportAudience = (typeof ASSESSMENT_REPORT_AUDIENCES)[number];
export type AssessmentReportSourceType = (typeof ASSESSMENT_REPORT_SOURCE_TYPES)[number];
export type AssessmentReportStatus = (typeof ASSESSMENT_REPORT_STATUSES)[number];

export type ActiveStandardAssessmentAssignment = {
  id: string;
  organization_id: string;
  participant_id: string;
  assignment_type: "standard_battery";
  status: "active";
  locale: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
};

type AssessmentAssignmentType = "standard_battery";

export type AssessmentReportRecord = {
  id: string;
  assessment_assignment_id: string;
  organization_id: string;
  participant_id: string;
  report_type: AssessmentReportType;
  audience: AssessmentReportAudience;
  source_type: AssessmentReportSourceType;
  report_status: AssessmentReportStatus;
  generator_type: string | null;
  contract_version: string | null;
  prompt_version_id: string | null;
  model_name: string | null;
  generator_version: string | null;
  input_snapshot: unknown;
  report_snapshot: unknown;
  failure_code: string | null;
  failure_reason: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type CompositeComponentState = {
  test_slug: string;
  attempt_id: string | null;
  required_for_composite: boolean;
  attempt_status: "in_progress" | "completed" | "abandoned" | "missing";
  completed_at: string | null;
  position: number | null;
};

export type CompositeReadinessState = {
  status: "ready" | "incomplete" | "no_required_components";
  requiredCount: number;
  completedCount: number;
  components: CompositeComponentState[];
  incompleteComponents: CompositeComponentState[];
};

export type CompositeAssessmentReportQueueAction =
  | "generate"
  | "retry";

export type CompositeAssessmentReportQueueDecision =
  | {
      allowed: true;
      operation: "create" | "retry_failed";
    }
  | {
      allowed: false;
      operation:
        | "not_ready"
        | "already_queued"
        | "already_processing"
        | "already_ready"
        | "retry_requires_failed";
    };

export type CompositeAssessmentReportInsert = {
  assessment_assignment_id: string;
  organization_id: string;
  participant_id: string;
  report_type: "composite";
  audience: "hr";
  source_type: "assessment";
  report_status: "queued";
  generator_type: null;
  contract_version: null;
  prompt_version_id: null;
  model_name: null;
  generator_version: null;
  input_snapshot: null;
  report_snapshot: null;
  failure_code: null;
  failure_reason: null;
  queued_at: string;
  started_at: null;
  completed_at: null;
  generated_at: null;
  metadata: Record<string, unknown>;
};

export type CompositeAssessmentReportRetryPatch = {
  report_status: "queued";
  queued_at: string;
  started_at: null;
  completed_at: null;
  generated_at: null;
  input_snapshot: null;
  report_snapshot: null;
  failure_code: null;
  failure_reason: null;
  metadata: Record<string, unknown>;
};

export type CompositeAssessmentReportQueueEligibility = {
  assignment: ActiveStandardAssessmentAssignment;
  readiness: CompositeReadinessState;
  report: AssessmentReportRecord | null;
};

export type CompositeAssessmentReportQueueResult = {
  action: "queued" | "noop_active_job" | "noop_ready" | "noop_failed" | "noop_not_ready";
  assignment: ActiveStandardAssessmentAssignment;
  readiness: CompositeReadinessState;
  report: AssessmentReportRecord | null;
};

type AssessmentAssignmentIdentityRow = {
  id: string;
  assignment_type: AssessmentAssignmentType;
};

type AssessmentAssignmentAttemptReadRow = {
  assessment_assignment_id: string;
  attempt_id: string;
  test_slug: string;
  required_for_composite: boolean;
  position: number | null;
  attempts:
    | {
        status: "in_progress" | "completed" | "abandoned";
        completed_at: string | null;
      }
    | Array<{
        status: "in_progress" | "completed" | "abandoned";
        completed_at: string | null;
      }>
    | null;
};

function normalizeAttemptRelation(
  value: AssessmentAssignmentAttemptReadRow["attempts"],
): { status: "in_progress" | "completed" | "abandoned"; completed_at: string | null } | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function sortCompositeComponents(
  left: CompositeComponentState,
  right: CompositeComponentState,
): number {
  const leftPosition = left.position ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = right.position ?? Number.MAX_SAFE_INTEGER;

  if (leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }

  return left.test_slug.localeCompare(right.test_slug);
}

export function buildCompositeReadinessFromLinkedAttempts(
  linkedAttempts: AssessmentAssignmentAttemptReadRow[],
  options?: {
    expectedRequiredTestSlugs?: readonly string[];
  },
): CompositeReadinessState {
  const linkedComponents = linkedAttempts
    .map((row) => {
      const attempt = normalizeAttemptRelation(row.attempts);

      return {
        test_slug: row.test_slug,
        attempt_id: row.attempt_id,
        required_for_composite: row.required_for_composite,
        attempt_status: attempt?.status ?? "missing",
        completed_at: attempt?.completed_at ?? null,
        position: row.position,
      } satisfies CompositeComponentState;
    })
    .sort(sortCompositeComponents);
  const linkedComponentsBySlug = new Map(
    linkedComponents.map((component) => [component.test_slug, component]),
  );
  const expectedRequiredComponents = (options?.expectedRequiredTestSlugs ?? []).map(
    (testSlug, index) =>
      linkedComponentsBySlug.get(testSlug) ?? {
        test_slug: testSlug,
        attempt_id: null,
        required_for_composite: true,
        attempt_status: "missing" as const,
        completed_at: null,
        position: index,
      } satisfies CompositeComponentState,
  );
  const optionalLinkedComponents = linkedComponents.filter(
    (component) => !expectedRequiredComponents.some((expected) => expected.test_slug === component.test_slug),
  );
  const components = [...expectedRequiredComponents, ...optionalLinkedComponents].sort(sortCompositeComponents);
  const requiredComponents =
    expectedRequiredComponents.length > 0
      ? expectedRequiredComponents
      : components.filter((component) => component.required_for_composite);
  const completedComponents = requiredComponents.filter(
    (component) =>
      component.attempt_status === "completed" && typeof component.completed_at === "string",
  );
  const incompleteComponents = requiredComponents.filter(
    (component) =>
      component.attempt_status !== "completed" || typeof component.completed_at !== "string",
  );

  if (requiredComponents.length === 0) {
    return {
      status: "no_required_components",
      requiredCount: 0,
      completedCount: 0,
      components,
      incompleteComponents: [],
    };
  }

  if (incompleteComponents.length > 0) {
    return {
      status: "incomplete",
      requiredCount: requiredComponents.length,
      completedCount: completedComponents.length,
      components,
      incompleteComponents,
    };
  }

  return {
    status: "ready",
    requiredCount: requiredComponents.length,
    completedCount: completedComponents.length,
    components,
    incompleteComponents: [],
  };
}

export async function loadLatestActiveStandardAssessmentAssignment(input: {
  organizationId: string;
  participantId: string;
}): Promise<ActiveStandardAssessmentAssignment | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select(
      "id, organization_id, participant_id, assignment_type, status, locale, created_by_user_id, created_at, updated_at, completed_at, metadata",
    )
    .eq("organization_id", input.organizationId)
    .eq("participant_id", input.participantId)
    .eq("assignment_type", "standard_battery")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load latest active standard assessment assignment: ${error.message}`);
  }

  return ((data ?? []) as ActiveStandardAssessmentAssignment[])[0] ?? null;
}

export async function buildCompositeReadinessForAssignment(input: {
  assessmentAssignmentId: string;
}): Promise<CompositeReadinessState> {
  const supabase = createSupabaseAdminClient();
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("assessment_assignments")
    .select("id, assignment_type")
    .eq("id", input.assessmentAssignmentId)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(`Failed to load assessment assignment for composite readiness: ${assignmentError.message}`);
  }

  const assignment = assignmentData as AssessmentAssignmentIdentityRow | null;

  if (!assignment) {
    throw new Error(`Assessment assignment ${input.assessmentAssignmentId} was not found.`);
  }

  const { data, error } = await supabase
    .from("assessment_assignment_attempts")
    .select("assessment_assignment_id, attempt_id, test_slug, required_for_composite, position, attempts(status, completed_at)")
    .eq("assessment_assignment_id", input.assessmentAssignmentId)
    .order("position", { ascending: true })
    .order("linked_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load composite readiness links: ${error.message}`);
  }

  return buildCompositeReadinessFromLinkedAttempts(
    (data ?? []) as AssessmentAssignmentAttemptReadRow[],
    {
      expectedRequiredTestSlugs:
        assignment.assignment_type === "standard_battery"
          ? STANDARD_ASSESSMENT_BATTERY_SLUGS
          : [],
    },
  );
}

export async function loadLatestCompositeHrAssessmentReport(input: {
  assessmentAssignmentId: string;
}): Promise<AssessmentReportRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .select(
      "id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_status, generator_type, contract_version, prompt_version_id, model_name, generator_version, input_snapshot, report_snapshot, failure_code, failure_reason, queued_at, started_at, completed_at, generated_at, created_at, updated_at, metadata",
    )
    .eq("assessment_assignment_id", input.assessmentAssignmentId)
    .eq("report_type", "composite")
    .eq("audience", "hr")
    .eq("source_type", "assessment")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load latest composite assessment report: ${error.message}`);
  }

  return ((data ?? []) as AssessmentReportRecord[])[0] ?? null;
}

export function resolveCompositeReportQueueDecision(input: {
  action: CompositeAssessmentReportQueueAction;
  readiness: CompositeReadinessState;
  existingReport: AssessmentReportRecord | null;
}): CompositeAssessmentReportQueueDecision {
  if (input.readiness.status !== "ready") {
    return {
      allowed: false,
      operation: "not_ready",
    };
  }

  if (!input.existingReport) {
    if (input.action === "retry") {
      return {
        allowed: false,
        operation: "retry_requires_failed",
      };
    }

    return {
      allowed: true,
      operation: "create",
    };
  }

  if (input.action === "retry") {
    if (input.existingReport.report_status === "failed") {
      return {
        allowed: true,
        operation: "retry_failed",
      };
    }

    return {
      allowed: false,
      operation: "retry_requires_failed",
    };
  }

  if (input.existingReport.report_status === "queued") {
    return {
      allowed: false,
      operation: "already_queued",
    };
  }

  if (input.existingReport.report_status === "processing") {
    return {
      allowed: false,
      operation: "already_processing",
    };
  }

  if (input.existingReport.report_status === "ready") {
    return {
      allowed: false,
      operation: "already_ready",
    };
  }

  return {
    allowed: false,
    operation: "retry_requires_failed",
  };
}

function buildQueueMetadata(input: {
  existingMetadata?: Record<string, unknown> | null;
  requestedByUserId?: string | null;
}): Record<string, unknown> {
  const metadata = {
    ...(input.existingMetadata ?? {}),
  };

  if (input.requestedByUserId) {
    metadata.requested_by_user_id = input.requestedByUserId;
    metadata.last_queued_by_user_id = input.requestedByUserId;
  }

  return metadata;
}

export function buildQueuedCompositeAssessmentReportInsert(input: {
  assessmentAssignmentId: string;
  organizationId: string;
  participantId: string;
  requestedByUserId?: string | null;
  queuedAt?: string;
}): CompositeAssessmentReportInsert {
  const queuedAt = input.queuedAt ?? new Date().toISOString();

  return {
    assessment_assignment_id: input.assessmentAssignmentId,
    organization_id: input.organizationId,
    participant_id: input.participantId,
    report_type: "composite",
    audience: "hr",
    source_type: "assessment",
    report_status: "queued",
    generator_type: null,
    contract_version: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    report_snapshot: null,
    failure_code: null,
    failure_reason: null,
    queued_at: queuedAt,
    started_at: null,
    completed_at: null,
    generated_at: null,
    metadata: buildQueueMetadata({
      requestedByUserId: input.requestedByUserId,
    }),
  };
}

export function buildRetryFailedCompositeAssessmentReportPatch(input: {
  existingReport: AssessmentReportRecord;
  requestedByUserId?: string | null;
  queuedAt?: string;
}): CompositeAssessmentReportRetryPatch | null {
  if (input.existingReport.report_status !== "failed") {
    return null;
  }

  const queuedAt = input.queuedAt ?? new Date().toISOString();

  return {
    report_status: "queued",
    queued_at: queuedAt,
    started_at: null,
    completed_at: null,
    generated_at: null,
    input_snapshot: null,
    report_snapshot: null,
    failure_code: null,
    failure_reason: null,
    metadata: buildQueueMetadata({
      existingMetadata: input.existingReport.metadata,
      requestedByUserId: input.requestedByUserId,
    }),
  };
}

export async function ensureCompositeReportCanBeQueued(input: {
  organizationId: string;
  participantId: string;
  assessmentAssignmentId: string;
}): Promise<CompositeAssessmentReportQueueEligibility> {
  const assignment = await loadLatestActiveStandardAssessmentAssignment({
    organizationId: input.organizationId,
    participantId: input.participantId,
  });

  if (!assignment || assignment.id !== input.assessmentAssignmentId) {
    throw new Error("Composite report queueing requires the latest active standard assessment assignment.");
  }

  const [readiness, report] = await Promise.all([
    buildCompositeReadinessForAssignment({
      assessmentAssignmentId: assignment.id,
    }),
    loadLatestCompositeHrAssessmentReport({
      assessmentAssignmentId: assignment.id,
    }),
  ]);

  return {
    assignment,
    readiness,
    report,
  };
}

export async function createQueuedCompositeAssessmentReport(input: {
  organizationId: string;
  participantId: string;
  assessmentAssignmentId: string;
  requestedByUserId?: string | null;
}): Promise<CompositeAssessmentReportQueueResult> {
  const eligibility = await ensureCompositeReportCanBeQueued(input);
  const decision = resolveCompositeReportQueueDecision({
    action: "generate",
    readiness: eligibility.readiness,
    existingReport: eligibility.report,
  });

  if (!decision.allowed) {
    return {
      action:
        decision.operation === "not_ready"
          ? "noop_not_ready"
          : decision.operation === "already_ready"
            ? "noop_ready"
            : decision.operation === "retry_requires_failed"
              ? "noop_failed"
              : "noop_active_job",
      assignment: eligibility.assignment,
      readiness: eligibility.readiness,
      report: eligibility.report,
    };
  }

  const supabase = createSupabaseAdminClient();
  const insertPayload = buildQueuedCompositeAssessmentReportInsert({
    assessmentAssignmentId: eligibility.assignment.id,
    organizationId: eligibility.assignment.organization_id,
    participantId: eligibility.assignment.participant_id,
    requestedByUserId: input.requestedByUserId,
  });
  const { data, error } = await supabase
    .from("assessment_reports")
    .insert(insertPayload)
    .select(
      "id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_status, generator_type, contract_version, prompt_version_id, model_name, generator_version, input_snapshot, report_snapshot, failure_code, failure_reason, queued_at, started_at, completed_at, generated_at, created_at, updated_at, metadata",
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to create queued composite assessment report: ${error?.message ?? "Unknown error"}`);
  }

  return {
    action: "queued",
    assignment: eligibility.assignment,
    readiness: eligibility.readiness,
    report: data as AssessmentReportRecord,
  };
}

export async function retryFailedCompositeAssessmentReport(input: {
  organizationId: string;
  participantId: string;
  assessmentAssignmentId: string;
  assessmentReportId?: string | null;
  requestedByUserId?: string | null;
}): Promise<CompositeAssessmentReportQueueResult> {
  const eligibility = await ensureCompositeReportCanBeQueued(input);
  const existingReport =
    input.assessmentReportId && eligibility.report?.id !== input.assessmentReportId
      ? null
      : eligibility.report;
  const decision = resolveCompositeReportQueueDecision({
    action: "retry",
    readiness: eligibility.readiness,
    existingReport,
  });

  if (!decision.allowed) {
    return {
      action:
        decision.operation === "not_ready"
          ? "noop_not_ready"
          : decision.operation === "already_ready"
            ? "noop_ready"
            : "noop_active_job",
      assignment: eligibility.assignment,
      readiness: eligibility.readiness,
      report: existingReport,
    };
  }

  if (!existingReport) {
    return {
      action: "noop_active_job",
      assignment: eligibility.assignment,
      readiness: eligibility.readiness,
      report: null,
    };
  }

  const updatePayload = buildRetryFailedCompositeAssessmentReportPatch({
    existingReport,
    requestedByUserId: input.requestedByUserId,
  });

  if (!updatePayload) {
    return {
      action: "noop_active_job",
      assignment: eligibility.assignment,
      readiness: eligibility.readiness,
      report: existingReport,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("assessment_reports")
    .update(updatePayload)
    .eq("id", existingReport.id)
    .select(
      "id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_status, generator_type, contract_version, prompt_version_id, model_name, generator_version, input_snapshot, report_snapshot, failure_code, failure_reason, queued_at, started_at, completed_at, generated_at, created_at, updated_at, metadata",
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to retry composite assessment report: ${error?.message ?? "Unknown error"}`);
  }

  return {
    action: "queued",
    assignment: eligibility.assignment,
    readiness: eligibility.readiness,
    report: data as AssessmentReportRecord,
  };
}
