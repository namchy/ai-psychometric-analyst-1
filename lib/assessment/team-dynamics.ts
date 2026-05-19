export const TEAM_DYNAMICS_TEST_SLUG = "team_dynamics_v1_strong";

export function isTeamDynamicsTestSlug(testSlug: string | null | undefined): boolean {
  return typeof testSlug === "string" && testSlug.trim().toLowerCase() === TEAM_DYNAMICS_TEST_SLUG;
}

export function shouldHideTeamDynamicsAttemptFromHrIndividualFlow(
  testSlug: string | null | undefined,
): boolean {
  return isTeamDynamicsTestSlug(testSlug);
}

export function canUseGenericCandidateAttemptCreation(
  testSlug: string | null | undefined,
): boolean {
  return !isTeamDynamicsTestSlug(testSlug);
}

export function isTeamDynamicsAttemptRecord(input: {
  test_slug?: string | null;
  slug?: string | null;
  tests?: {
    slug?: string | null;
  } | null;
} | null | undefined): boolean {
  if (!input) {
    return false;
  }

  return isTeamDynamicsTestSlug(input.test_slug ?? input.slug ?? input.tests?.slug);
}
