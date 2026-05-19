import {
  AuthenticatedAppMainContent,
} from "@/components/app/authenticated-app-chrome";
import { HrTeamsTable } from "@/components/dashboard/hr-teams-table";
import {
  DashboardSectionHeader,
  DashboardSectionShell,
  PageNavigation,
} from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";
import { getTeamsForOrganization } from "@/lib/b2b/teams";

export const dynamic = "force-dynamic";

export default async function TeamsDashboardPage() {
  const user = await requireAuthenticatedUser();
  const organization = await getActiveOrganizationForUser(user.id);
  const teams = organization ? await getTeamsForOrganization(organization.id) : [];

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="space-y-8 pb-12">
        <DashboardSectionShell className="shadow-[0_24px_54px_rgba(15,23,42,0.1)] lg:p-7">
          <div className="relative space-y-5">
            <PageNavigation
              backHref="/dashboard"
              backLabel="Nazad na dashboard"
              contextLabel={organization?.name ?? "HR pregled"}
            />

            <DashboardSectionHeader
              eyebrow="Team Dynamics"
              eyebrowClassName="text-teal-800/90"
              title="Timovi"
              titleClassName="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
              description="Timski modul daje agregirani uvid u dinamiku konkretnog tima. Ovaj surface ne prikazuje individualne rezultate članova niti služi za individualno targetiranje."
              descriptionClassName="max-w-3xl"
            />
          </div>
        </DashboardSectionShell>

        {!organization ? (
          <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
            <div className="px-6 py-8 text-sm leading-6 text-slate-600">
              Ovaj korisnik još nema aktivnu organizaciju, pa teams dashboard trenutno nema dostupne timove.
            </div>
          </DashboardSectionShell>
        ) : teams.length === 0 ? (
          <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
            <div className="px-6 py-8 text-sm leading-6 text-slate-600">
              Nema timova u aktivnoj organizaciji.
            </div>
          </DashboardSectionShell>
        ) : (
          <HrTeamsTable teams={teams} />
        )}
      </div>
    </AuthenticatedAppMainContent>
  );
}
