import { notFound } from "next/navigation";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import { TeamFitReportView } from "@/components/dashboard/team-fit-report-view";
import { PageNavigation } from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { loadTeamFitReportDisplayRecord } from "@/lib/b2b/team-fit-report-display";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";

type TeamFitReportPageProps = {
  params: {
    teamId: string;
    participantId: string;
    teamFitReportId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function TeamFitReportPage({
  params,
}: TeamFitReportPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const record = await loadTeamFitReportDisplayRecord({
    organizationId: organization.id,
    teamId: params.teamId,
    participantId: params.participantId,
    teamFitReportId: params.teamFitReportId,
  });

  if (!record) {
    notFound();
  }

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="space-y-6 pb-12">
        <PageNavigation
          backHref={`/dashboard/participants/${params.participantId}/reports`}
          backLabel="Nazad na pregled kandidata"
          contextLabel="Team Fit izvještaj"
          backLinkVariant="subtle"
        />
        <TeamFitReportView record={record} />
      </div>
    </AuthenticatedAppMainContent>
  );
}
