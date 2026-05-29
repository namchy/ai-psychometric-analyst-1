import { notFound } from "next/navigation";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import { TeamDynamicsExecutiveOverviewReportView } from "@/components/dashboard/team-dynamics-executive-overview-report-view";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  PageNavigation,
} from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { loadTeamDynamicsExecutiveOverviewReportForDisplay } from "@/lib/b2b/team-dynamics-executive-overview-display";

type TeamDynamicsExecutiveOverviewReportPageProps = {
  params: {
    teamId: string;
    teamAssessmentReportId: string;
  };
};

export const dynamic = "force-dynamic";

function TeamDynamicsReportStateCard(input: {
  teamId: string;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-6">
      <PageNavigation
        backHref={`/dashboard/teams/${input.teamId}`}
        backLabel="Nazad na tim"
        contextLabel="Team Dynamics izvještaj"
        backLinkVariant="subtle"
      />
      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-6 sm:p-7">
        <DashboardSectionHeader
          eyebrow="Team Dynamics Executive Overview"
          eyebrowClassName="text-teal-800/90"
          title={input.title}
          description={input.body}
          className="gap-2"
          titleClassName="text-2xl font-bold tracking-[-0.04em]"
          descriptionClassName="text-base text-slate-600"
        />
      </DashboardInfoCardShell>
    </div>
  );
}

function getStateCardCopy(status: "queued" | "processing" | "failed" | "invalid_snapshot"): {
  title: string;
  body: string;
} {
  switch (status) {
    case "queued":
      return {
        title: "Izvještaj čeka obradu",
        body: "Team Dynamics Executive Overview je pripremljen, ali još nije ušao u ready stanje za pregled.",
      };
    case "processing":
      return {
        title: "Izvještaj se obrađuje",
        body: "Team Dynamics Executive Overview je trenutno u obradi i još nije spreman za prikaz.",
      };
    case "failed":
      return {
        title: "Izvještaj nije uspješno kreiran",
        body: "Posljednji pokušaj kreiranja nije završio uspješno, pa pregled trenutno nije dostupan.",
      };
    case "invalid_snapshot":
    default:
      return {
        title: "Izvještaj trenutno nije dostupan",
        body: "Ready snapshot trenutno nije dostupan za stabilan prikaz ili ne prolazi validaciju.",
      };
  }
}

export default async function TeamDynamicsExecutiveOverviewReportPage({
  params,
}: TeamDynamicsExecutiveOverviewReportPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const result = await loadTeamDynamicsExecutiveOverviewReportForDisplay({
    organizationId: organization.id,
    teamId: params.teamId,
    teamAssessmentReportId: params.teamAssessmentReportId,
  });

  if (!result) {
    notFound();
  }

  const backHref = `/dashboard/teams/${params.teamId}`;

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="pb-12">
        {result.status === "ready" ? (
          <TeamDynamicsExecutiveOverviewReportView
            report={result.report}
            snapshot={result.snapshot}
            backHref={backHref}
          />
        ) : (
          <TeamDynamicsReportStateCard
            teamId={params.teamId}
            title={getStateCardCopy(result.status).title}
            body={getStateCardCopy(result.status).body}
          />
        )}
      </div>
    </AuthenticatedAppMainContent>
  );
}
