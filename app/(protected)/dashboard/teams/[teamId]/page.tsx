import { notFound } from "next/navigation";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import { HrTeamAssessmentDetail } from "@/components/dashboard/hr-team-assessment-detail";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getTeamAssessmentDetailForOrganization } from "@/lib/b2b/team-assessment-detail";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";

type TeamAssessmentDetailPageProps = {
  params: {
    teamId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function TeamAssessmentDetailPage({
  params,
}: TeamAssessmentDetailPageProps) {
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

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <HrTeamAssessmentDetail detail={detail} />
    </AuthenticatedAppMainContent>
  );
}
