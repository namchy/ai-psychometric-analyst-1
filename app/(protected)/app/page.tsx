import { getAppContextForUserId } from "@/lib/auth/app-context";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptLookupForUser } from "@/lib/candidate/attempts";
import {
  CandidateDashboardView,
} from "@/components/dashboard/candidate-dashboard";

export const dynamic = "force-dynamic";

export default async function CandidateAppEntryPage() {
  const user = await requireAuthenticatedUser();
  const [context, attemptLookup] = await Promise.all([
    getAppContextForUserId(user.id),
    getCandidateAttemptLookupForUser(user.id),
  ]);
  const linkedParticipant = context.linkedParticipant;
  const desktopUserName = linkedParticipant?.full_name?.trim();
  const desktopUserEmail = linkedParticipant?.email ?? user.email ?? user.id;
  const initialAttempts = attemptLookup.attempts.map((attempt) => ({
    id: attempt.id,
    test_id: attempt.test_id,
    status: attempt.status,
    created_at: attempt.started_at,
    updated_at: attempt.completed_at ?? attempt.started_at,
    completed_at: attempt.completed_at,
    total_time_seconds: attempt.total_time_seconds,
  }));

  return (
    <CandidateDashboardView
      hasLinkedParticipant={Boolean(linkedParticipant)}
      initialAttempts={initialAttempts}
      linkedOrganizationId={linkedParticipant?.organization_id ?? null}
      showHrLink={context.recommendedAppArea === "hr"}
      userEmail={desktopUserEmail}
      userName={desktopUserName}
    />
  );
}
