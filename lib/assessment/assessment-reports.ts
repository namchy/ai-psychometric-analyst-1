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
