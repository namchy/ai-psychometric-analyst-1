import { notFound } from "next/navigation";
import Link from "next/link";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import { CompositeHrReportView } from "@/components/dashboard/composite-hr-report-view";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
} from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
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
    <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-6 sm:p-7">
      <div className="space-y-4">
        <DashboardSectionHeader
          eyebrow="Kompozitni HR izvjestaj"
          eyebrowClassName="text-teal-800/90"
          title={input.title}
          description={input.body}
          className="gap-2"
          titleClassName="text-2xl font-bold tracking-[-0.04em]"
          descriptionClassName="text-base text-slate-600"
        />

        <Link
          className="inline-flex min-h-0 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
          href={`/dashboard/participants/${input.participantId}/reports`}
        >
          Nazad na pregled kandidata
        </Link>
      </div>
    </DashboardInfoCardShell>
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

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="pb-12">
        {result.status === "ready" ? (
          <CompositeHrReportView report={result.report} snapshot={result.snapshot} />
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
