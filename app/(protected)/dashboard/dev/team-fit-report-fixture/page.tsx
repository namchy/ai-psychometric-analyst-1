import { notFound } from "next/navigation";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import { TeamFitReportView } from "@/components/dashboard/team-fit-report-view";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  PageNavigation,
} from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { buildTeamFitVisualFixtureRecord } from "@/lib/b2b/team-fit-report-visual-fixture";

export const dynamic = "force-dynamic";

const FIXTURE_STATUSES = ["ready", "queued", "processing", "failed"] as const;

export default async function TeamFitReportFixturePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  await requireAuthenticatedUser();

  return (
    <AuthenticatedAppMainContent
      className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-10"
      topPaddingClassName="pt-0"
    >
      <div className="space-y-6 pb-12">
        <PageNavigation
          backHref="/dashboard"
          backLabel="Nazad na HR dashboard"
          contextLabel="Dev fixture"
          backLinkVariant="subtle"
        />

        <DashboardInfoCardShell className="rounded-[1.5rem] border-slate-200/80 p-6 sm:p-7">
          <DashboardSectionHeader
            eyebrow="TEAM FIT DEV FIXTURE"
            eyebrowClassName="text-[#073b4c]"
            title="Vizuelni pregled Team Fit read-only renderera"
            description="Development-only fixture za browser review postojećeg HR renderera bez DB write-a, providera ili generation flow-a."
            className="gap-2"
            titleClassName="text-2xl font-bold tracking-[-0.04em] text-[#073b4c]"
            descriptionClassName="max-w-3xl text-base text-slate-600"
          />
        </DashboardInfoCardShell>

        {FIXTURE_STATUSES.map((status) => {
          const record = buildTeamFitVisualFixtureRecord(status);

          return (
            <section key={status} className="space-y-3">
              <DashboardSectionHeader
                eyebrow="Fixture state"
                eyebrowClassName="text-slate-500"
                title={status === "ready" ? "Ready" : status === "queued" ? "Queued" : status === "processing" ? "Processing" : "Failed"}
                description="Static browser fixture za vizuelni review istog read-only prikaza."
                className="gap-1"
                titleClassName="text-[1.25rem] font-bold tracking-[-0.03em] text-[#073b4c]"
                descriptionClassName="text-sm text-slate-600"
              />
              <TeamFitReportView record={record} />
            </section>
          );
        })}
      </div>
    </AuthenticatedAppMainContent>
  );
}
