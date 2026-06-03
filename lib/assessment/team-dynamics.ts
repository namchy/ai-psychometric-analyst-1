export const TEAM_DYNAMICS_TEST_SLUG = "team_dynamics_v1_strong";
export const TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG = "team_dynamics_assessment_v1";
export const TEAM_DYNAMICS_TEST_SLUGS = [
  TEAM_DYNAMICS_TEST_SLUG,
  TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG,
] as const;

export function isTeamDynamicsTestSlug(testSlug: string | null | undefined): boolean {
  return (
    typeof testSlug === "string" &&
    TEAM_DYNAMICS_TEST_SLUGS.includes(
      testSlug.trim().toLowerCase() as (typeof TEAM_DYNAMICS_TEST_SLUGS)[number],
    )
  );
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

export function shouldBypassIndividualPostCompletionArtifacts(
  testSlug: string | null | undefined,
): boolean {
  return isTeamDynamicsTestSlug(testSlug);
}

export function shouldUseDefaultIndividualPostCompletionFlow(
  testSlug: string | null | undefined,
): boolean {
  return !shouldBypassIndividualPostCompletionArtifacts(testSlug);
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
