import { notFound } from "next/navigation";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import { IndividualDevelopmentProfileReportView } from "@/components/dashboard/individual-development-profile-report-view";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  PageNavigation,
} from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { loadIndividualDevelopmentProfileDisplay } from "@/lib/assessment/individual-development-profile-display";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";

type IndividualDevelopmentProfileReportPageProps = {
  params: {
    assessmentReportId: string;
  };
};

export const dynamic = "force-dynamic";

function buildBackHref(participantId: string | null): string {
  return participantId ? `/dashboard/participants/${participantId}/reports` : "/dashboard";
}

function buildStateCardCopy(
  status: "missing" | "queued" | "processing" | "failed" | "invalid",
): {
  title: string;
  body: string;
} {
  switch (status) {
    case "queued":
      return {
        title: "Izvještaj čeka obradu",
        body: "Individualni razvojni profil je evidentiran, ali još nije spreman za pregled.",
      };
    case "processing":
      return {
        title: "Izvještaj se priprema",
        body: "Individualni razvojni profil je trenutno u obradi i još nije spreman za prikaz.",
      };
    case "failed":
      return {
        title: "Izvještaj trenutno nije dostupan",
        body: "Posljednja priprema nije završila uspješno, pa pregled trenutno nije dostupan.",
      };
    case "invalid":
      return {
        title: "Izvještaj trenutno nije dostupan",
        body: "Postojeći artefakt trenutno nije dostupan za stabilan prikaz.",
      };
    case "missing":
    default:
      return {
        title: "Izvještaj nije dostupan",
        body: "Traženi Individualni razvojni profil nije dostupan u aktivnoj organizaciji.",
      };
  }
}

function IndividualDevelopmentProfileStateCard(input: {
  participantId: string | null;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-6">
      <PageNavigation
        backHref={buildBackHref(input.participantId)}
        backLabel={
          input.participantId ? "Nazad na pregled kandidata" : "Nazad na dashboard"
        }
        contextLabel="Individualni razvojni profil"
        backLinkVariant="subtle"
      />
      <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-6 sm:p-7">
        <DashboardSectionHeader
          eyebrow="Razvojni HR izvještaj"
          eyebrowClassName="text-[#073b4c]"
          title={input.title}
          description={input.body}
          className="gap-2"
          titleClassName="max-w-3xl text-2xl font-bold tracking-[-0.04em] text-[#073b4c]"
          descriptionClassName="max-w-3xl text-base text-slate-600"
        />
      </DashboardInfoCardShell>
    </div>
  );
}

export default async function IndividualDevelopmentProfileReportPage({
  params,
}: IndividualDevelopmentProfileReportPageProps) {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);

  if (!organization) {
    notFound();
  }

  const result = await loadIndividualDevelopmentProfileDisplay({
    assessmentReportId: params.assessmentReportId,
    organizationId: organization.id,
  });

  if (!result.ok) {
    throw new Error(result.details);
  }

  const stateCardCopy =
    result.status === "ready" ? null : buildStateCardCopy(result.status);

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="pb-12">
        {result.status === "ready" ? (
          <div className="space-y-6">
            <PageNavigation
              backHref={buildBackHref(result.participantId)}
              backLabel="Nazad na pregled kandidata"
              contextLabel="Individualni razvojni profil"
              backLinkVariant="subtle"
            />
            <IndividualDevelopmentProfileReportView
              record={{
                participantDisplayName: null,
                generatedAt: result.generatedAt,
                completedAt: result.completedAt,
                safeStatusMessage: result.safeStatusMessage,
                metadata: result.metadata,
                reportSnapshot: result.reportSnapshot,
              }}
            />
          </div>
        ) : (
          <IndividualDevelopmentProfileStateCard
            participantId={result.participantId}
            title={stateCardCopy!.title}
            body={stateCardCopy!.body}
          />
        )}
      </div>
    </AuthenticatedAppMainContent>
  );
}
