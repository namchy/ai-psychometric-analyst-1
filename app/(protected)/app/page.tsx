import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  CandidateDashboardView,
} from "@/components/dashboard/candidate-dashboard";

export const dynamic = "force-dynamic";

export default async function CandidateAppEntryPage() {
  const user = await requireAuthenticatedUser();
  const context = await getAppContextForUserId(user.id);
  const linkedParticipant = context.linkedParticipant;
  const desktopUserName = linkedParticipant?.full_name?.trim();
  const desktopUserEmail = linkedParticipant?.email ?? user.email ?? user.id;

  return (
    <CandidateDashboardView
      hasLinkedParticipant={Boolean(linkedParticipant)}
      linkedOrganizationId={linkedParticipant?.organization_id ?? null}
      showHrLink={context.recommendedAppArea === "hr"}
      userEmail={desktopUserEmail}
      userName={desktopUserName}
    />
  );
}
