import "server-only";

import {
  getActiveOrganizationForUser,
  getLinkedParticipantForUser,
  getMembershipsForUser,
  type ParticipantSummary,
} from "@/lib/b2b/organizations";

export type RecommendedAppArea = "hr" | "app" | null;

export type CurrentUserAppContext = {
  authUserId: string;
  activeOrganizationId: string | null;
  hasOrganizationMembership: boolean;
  linkedParticipantId: string | null;
  linkedParticipant: ParticipantSummary | null;
  recommendedAppArea: RecommendedAppArea;
};

export type DashboardWorkspaceAccess =
  | {
      kind: "hr";
      action: "allow";
    }
  | {
      kind: "candidate";
      redirectPath: "/app";
    }
  | {
      kind: "none";
    };

export function getRecommendedAppAreaRedirectPath(
  context: Pick<CurrentUserAppContext, "recommendedAppArea">,
): "/hr" | "/app" | "/dashboard" {
  switch (context.recommendedAppArea) {
    case "hr":
      return "/dashboard";
    case "app":
      return "/app";
    default:
      // Transitional fallback until every authenticated user has a clearer area mapping.
      return "/dashboard";
  }
}

export function resolveDashboardWorkspaceAccess(
  context: Pick<
    CurrentUserAppContext,
    "hasOrganizationMembership" | "linkedParticipantId"
  >,
): DashboardWorkspaceAccess {
  if (context.hasOrganizationMembership) {
    return {
      kind: "hr",
      action: "allow",
    };
  }

  if (context.linkedParticipantId) {
    return {
      kind: "candidate",
      redirectPath: "/app",
    };
  }

  return {
    kind: "none",
  };
}

async function buildAppContextForUserId(userId: string): Promise<CurrentUserAppContext> {
  const [activeOrganization, linkedParticipant, memberships] = await Promise.all([
    getActiveOrganizationForUser(userId),
    getLinkedParticipantForUser(userId),
    getMembershipsForUser(userId),
  ]);

  const hasOrganizationMembership = memberships.length > 0;

  let recommendedAppArea: RecommendedAppArea = null;

  if (hasOrganizationMembership) {
    recommendedAppArea = "hr";
  } else if (linkedParticipant) {
    recommendedAppArea = "app";
  }

  return {
    authUserId: userId,
    activeOrganizationId: activeOrganization?.id ?? null,
    hasOrganizationMembership,
    linkedParticipantId: linkedParticipant?.id ?? null,
    linkedParticipant,
    recommendedAppArea,
  };
}

export async function getAppContextForUserId(
  userId: string,
): Promise<CurrentUserAppContext> {
  return buildAppContextForUserId(userId);
}

export async function getPostLoginRedirectPathForUserId(
  userId: string,
): Promise<
  "/hr" | "/app" | "/dashboard"
> {
  const context = await getAppContextForUserId(userId);
  return getRecommendedAppAreaRedirectPath(context);
}
