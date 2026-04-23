export type CandidateAssessmentCatalogKey = "ipip-neo-120" | "safran" | "riasec";

export type CandidateAssessmentAvailabilityKind =
  | "core"
  | "add_on"
  | "disabled"
  | "not_ready";

export type CandidateAssessmentAvailabilityInput = {
  slug: string | null | undefined;
  name?: string | null;
  status?: string | null;
  isActive?: boolean | null;
  hasOrganizationAccess?: boolean;
  activeQuestionCount?: number | null;
};

export type CandidateAssessmentAvailability = {
  catalogKey: CandidateAssessmentCatalogKey | null;
  kind: CandidateAssessmentAvailabilityKind;
  canStart: boolean;
  requiresOrganizationAccess: boolean;
  reason:
    | "core_available"
    | "add_on_available"
    | "disabled_candidate_card"
    | "inactive_test"
    | "missing_questions"
    | "missing_organization_access";
};

const CORE_BATTERY_KEYS = new Set<CandidateAssessmentCatalogKey>([
  "ipip-neo-120",
  "safran",
]);

function normalizeValue(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function getCandidateAssessmentCatalogKey(
  input: Pick<CandidateAssessmentAvailabilityInput, "slug" | "name">,
): CandidateAssessmentCatalogKey | null {
  const normalizedSlug = normalizeValue(input.slug);
  const normalizedName = normalizeValue(input.name);

  if (normalizedSlug.includes("ipip-neo-120") || normalizedName.includes("ipip-neo-120")) {
    return "ipip-neo-120";
  }

  if (normalizedSlug.includes("safran") || normalizedName.includes("safran")) {
    return "safran";
  }

  if (normalizedSlug.includes("riasec") || normalizedName.includes("riasec")) {
    return "riasec";
  }

  return null;
}

export function isCoreBatteryAssessment(
  input: Pick<CandidateAssessmentAvailabilityInput, "slug" | "name">,
): boolean {
  const catalogKey = getCandidateAssessmentCatalogKey(input);

  return Boolean(catalogKey && CORE_BATTERY_KEYS.has(catalogKey));
}

export function getCandidateAssessmentAvailability(
  input: CandidateAssessmentAvailabilityInput,
): CandidateAssessmentAvailability {
  const catalogKey = getCandidateAssessmentCatalogKey(input);

  if (catalogKey === "riasec") {
    return {
      catalogKey,
      kind: "disabled",
      canStart: false,
      requiresOrganizationAccess: false,
      reason: "disabled_candidate_card",
    };
  }

  if (!input.isActive || input.status !== "active") {
    return {
      catalogKey,
      kind: "not_ready",
      canStart: false,
      requiresOrganizationAccess: false,
      reason: "inactive_test",
    };
  }

  if ((input.activeQuestionCount ?? 0) <= 0) {
    return {
      catalogKey,
      kind: "not_ready",
      canStart: false,
      requiresOrganizationAccess: false,
      reason: "missing_questions",
    };
  }

  if (catalogKey && CORE_BATTERY_KEYS.has(catalogKey)) {
    return {
      catalogKey,
      kind: "core",
      canStart: true,
      requiresOrganizationAccess: false,
      reason: "core_available",
    };
  }

  if (input.hasOrganizationAccess) {
    return {
      catalogKey,
      kind: "add_on",
      canStart: true,
      requiresOrganizationAccess: true,
      reason: "add_on_available",
    };
  }

  return {
    catalogKey,
    kind: "add_on",
    canStart: false,
    requiresOrganizationAccess: true,
    reason: "missing_organization_access",
  };
}
