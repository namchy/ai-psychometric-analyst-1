import { notFound } from "next/navigation";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import { CompositeHrReportView } from "@/components/dashboard/composite-hr-report-view";
import {
  DashboardInfoCardShell,
  PageNavigation,
  DashboardSectionHeader,
} from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  getActiveOrganizationForUser,
  getParticipantForOrganization,
} from "@/lib/b2b/organizations";
import { getReadyCompositeHrAssessmentReportForOrganization } from "@/lib/assessment/assessment-reports";

type CompositeAssessmentReportPageProps = {
  params: {
    reportId: string;
  };
};

export const dynamic = "force-dynamic";

function CompositeReportStateCard(input: {
  title: string;
  body: string;
  participantId: string;
}) {
  return (
    <div className="space-y-6">
      <PageNavigation
        backHref={`/dashboard/participants/${input.participantId}/reports`}
        backLabel="Nazad na pregled kandidata"
        contextLabel="Kompozitni HR izvještaj"
      />
      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-6 sm:p-7">
        <DashboardSectionHeader
          eyebrow="Kompozitni HR izvjestaj"
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

export default async function CompositeAssessmentReportPage({
  params,
}: CompositeAssessmentReportPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const result = await getReadyCompositeHrAssessmentReportForOrganization({
    reportId: params.reportId,
    organizationId: organization.id,
  });

  if (!result) {
    notFound();
  }

  const participant =
    result.status === "ready"
      ? await getParticipantForOrganization(organization.id, result.report.participant_id)
      : null;

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="pb-12">
        {result.status === "ready" ? (
          <CompositeHrReportView
            report={result.report}
            snapshot={result.snapshot}
            participant={{
              fullName: participant?.full_name ?? null,
              email: participant?.email ?? null,
            }}
          />
        ) : result.status === "not_ready" ? (
          <CompositeReportStateCard
            title="Izvjestaj jos nije spreman za pregled"
            body={result.message}
            participantId={result.report.participant_id}
          />
        ) : (
          <CompositeReportStateCard
            title="Izvjestaj trenutno nije moguce prikazati"
            body="Kompozitni HR izvjestaj trenutno nije moguce prikazati jer podaci ne prolaze validaciju."
            participantId={result.report.participant_id}
          />
        )}
      </div>
    </AuthenticatedAppMainContent>
  );
}
