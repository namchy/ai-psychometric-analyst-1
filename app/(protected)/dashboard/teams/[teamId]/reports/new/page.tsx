import { notFound } from "next/navigation";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import {
  DashboardSectionHeader,
  DashboardSectionShell,
  PageNavigation,
} from "@/components/dashboard/primitives";
import { TeamDynamicsReportMemberSelection } from "@/components/dashboard/team-dynamics-report-member-selection";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getTeamAssessmentDetailForOrganization } from "@/lib/b2b/team-assessment-detail";
import { getTeamDynamicsReportSelectionReadModelForOrganization } from "@/lib/b2b/team-dynamics-report-selection";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";

type TeamReportPreparationPageProps = {
  params: {
    teamId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function TeamReportPreparationPage({
  params,
}: TeamReportPreparationPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const detail = await getTeamAssessmentDetailForOrganization({
    organizationId: organization.id,
    teamId: params.teamId,
  });

  if (!detail) {
    notFound();
  }

  const finalAssignment = detail.latestFinalAssignment;
  const selection =
    finalAssignment
      ? await getTeamDynamicsReportSelectionReadModelForOrganization({
          organizationId: organization.id,
          teamId: detail.teamId,
          teamAssessmentAssignmentId: finalAssignment.assignmentId,
        })
      : null;

  if (finalAssignment && !selection) {
    notFound();
  }

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="space-y-8 pb-12">
        <DashboardSectionShell className="shadow-[0_24px_54px_rgba(15,23,42,0.1)] lg:p-7">
          <div className="relative space-y-5">
            <PageNavigation
              backHref={`/dashboard/teams/${detail.teamId}`}
              backLabel="Nazad na tim"
              contextLabel={detail.name}
            />

            <DashboardSectionHeader
              eyebrow="Team Dynamics"
              eyebrowClassName="text-teal-800/90"
              title="Priprema timskog izvještaja"
              titleClassName="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
              description="Odaberi članove koji će biti uključeni u konkretni timski izvještaj."
              descriptionClassName="max-w-3xl"
            />
          </div>
        </DashboardSectionShell>

        <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-5 py-5 shadow-[0_30px_70px_rgba(15,23,42,0.1)] sm:px-6">
          <TeamDynamicsReportMemberSelection
            initialSelection={selection}
            teamAssessmentAssignmentId={finalAssignment?.assignmentId ?? null}
          />
        </DashboardSectionShell>
      </div>
    </AuthenticatedAppMainContent>
  );
}
