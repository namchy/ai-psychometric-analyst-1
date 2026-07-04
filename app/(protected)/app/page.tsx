import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptLookupForUser } from "@/lib/candidate/attempts";
import { CandidateDashboardView } from "@/components/dashboard/candidate-dashboard";
import {
  getCandidateDashboardData,
  getEmptyCandidateDashboardData,
} from "@/lib/dashboard/candidate-dashboard-data";

export const dynamic = "force-dynamic";

export default async function CandidateAppEntryPage() {
  const user = await requireAuthenticatedUser();
  const [context, attemptLookup] = await Promise.all([
    getAppContextForUserId(user.id),
    getCandidateAttemptLookupForUser(user.id),
  ]);
  const linkedParticipant = context.linkedParticipant;
  let dashboardLoadError = false;
  const preparedDashboardData =
    linkedParticipant?.organization_id
      ? await getCandidateDashboardData({
          attempts: attemptLookup.attempts,
          organizationId: linkedParticipant.organization_id,
        }).catch((error) => {
          console.error("Failed to prepare candidate dashboard data.", error);
          dashboardLoadError = true;
          return getEmptyCandidateDashboardData();
        })
      : linkedParticipant
        ? (() => {
            dashboardLoadError = true;
            return getEmptyCandidateDashboardData();
          })()
        : getEmptyCandidateDashboardData();

  return (
    <CandidateDashboardView
      dashboardLoadError={dashboardLoadError}
      hasLinkedParticipant={Boolean(linkedParticipant)}
      linkedOrganizationId={linkedParticipant?.organization_id ?? null}
      needsAddressingFormSelection={Boolean(linkedParticipant && !linkedParticipant.addressing_form)}
      preparedDashboardData={preparedDashboardData}
    />
  );
}
