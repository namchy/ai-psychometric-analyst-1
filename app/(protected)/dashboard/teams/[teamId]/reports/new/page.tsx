import { notFound } from "next/navigation";
import { AuthenticatedAppMainContent } from "@/components/app/authenticated-app-chrome";
import {
  DashboardSectionHeader,
  DashboardSectionShell,
  DashboardStatusBadge,
  PageNavigation,
} from "@/components/dashboard/primitives";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getTeamAssessmentDetailForOrganization } from "@/lib/b2b/team-assessment-detail";
import { getTeamDynamicsReportSelectionReadModelForOrganization } from "@/lib/b2b/team-dynamics-report-selection";
import { getActiveOrganizationForUser } from "@/lib/b2b/organizations";

type TeamReportPreparationPageProps = {
  params: {
    teamId: string;
  };
};

function getTeamSizeStatusLabel(status: string | null): string {
  switch (status) {
    case "ideal":
      return "Idealan obuhvat";
    case "warning":
      return "Povećan obuhvat";
    case "too_many":
      return "Preširok obuhvat";
    case "too_few":
      return "Premalo članova";
    default:
      return "Nije dostupno";
  }
}

function getDisabledReasonLabel(reason: string): string {
  switch (reason) {
    case "minimum_selected_members_not_met":
      return "Minimalni broj uključenih članova još nije ispunjen.";
    case "maximum_selected_members_exceeded":
      return "Premašen je maksimalni broj uključenih članova.";
    case "included_members_not_completed":
      return "Neki uključeni članovi još nisu završili procjenu.";
    case "included_members_missing_score_snapshots":
      return "Nedostaju score snapshoti za neke uključene članove.";
    case "included_members_invalid_score_snapshots":
      return "Neki score snapshoti nisu validni za timski izvještaj.";
    case "final_assignment_not_available":
      return "Finalna Team Dynamics procjena još nije dostupna za pripremu izvještaja.";
    default:
      return reason;
  }
}

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

  const selectedCount = selection?.selectedCount ?? 0;
  const teamSizeStatus = selection?.teamSizeStatus ?? null;
  const disabledReasons =
    selection?.disabledReasons ?? ["final_assignment_not_available"];

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
          <div className="space-y-5">
            <div className="rounded-[1.2rem] border border-slate-200 bg-white/85 px-4 py-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    selectedCount
                  </p>
                  <p className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    {selectedCount}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    teamSizeStatus
                  </p>
                  <DashboardStatusBadge className="w-fit border-slate-200 bg-slate-100 text-slate-700">
                    {getTeamSizeStatusLabel(teamSizeStatus)}
                  </DashboardStatusBadge>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    disabledReasons
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {disabledReasons.map((reason) => (
                      <DashboardStatusBadge
                        key={reason}
                        className="border-slate-200 bg-slate-100 text-slate-700"
                      >
                        {getDisabledReasonLabel(reason)}
                      </DashboardStatusBadge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-sm leading-6 text-slate-600">
              Placeholder za budući left/right selection UI. U ovom slice-u još nema interaktivnog izbora članova, čuvanja izbora ni kreiranja timskog izvještaja.
            </div>
          </div>
        </DashboardSectionShell>
      </div>
    </AuthenticatedAppMainContent>
  );
}
