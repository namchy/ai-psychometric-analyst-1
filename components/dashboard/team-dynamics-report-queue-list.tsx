import Link from "next/link";
import { TeamDynamicsReportProcessAction } from "@/components/dashboard/team-dynamics-report-process-action";
import { TeamDynamicsReportRetryAction } from "@/components/dashboard/team-dynamics-report-retry-action";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardStatusBadge,
  getDashboardCtaClassName,
} from "@/components/dashboard/primitives";
import type {
  TeamDynamicsReportRowSummary,
  TeamDynamicsReportStatus,
} from "@/lib/b2b/team-dynamics-report-lifecycle";

type TeamDynamicsReportQueueListProps = {
  teamId: string;
  reportRows: TeamDynamicsReportRowSummary[];
};

function getReportStatusLabel(status: TeamDynamicsReportStatus): string {
  switch (status) {
    case "queued":
      return "U redu za pripremu";
    case "processing":
      return "U obradi";
    case "ready":
      return "Spreman za otvaranje";
    case "failed":
      return "Greška";
    default:
      return "Nepoznat status";
  }
}

function getReportStatusToneClassName(status: TeamDynamicsReportStatus): string {
  switch (status) {
    case "queued":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getReportTimestampLabel(reportRow: TeamDynamicsReportRowSummary): string {
  return reportRow.queuedAt ?? reportRow.createdAt;
}

export function TeamDynamicsReportQueueList({
  teamId,
  reportRows,
}: TeamDynamicsReportQueueListProps) {
  return (
    <DashboardInfoCardShell className="rounded-[1.25rem] border-slate-200 bg-white/85 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="space-y-4">
        <DashboardSectionHeader
          eyebrow="Queue"
          eyebrowClassName="text-teal-800/90"
          title="Timski izvještaji"
          titleClassName="text-[1.2rem]"
          description="Prati status izvještaja i otvori one koji su spremni."
          descriptionClassName="max-w-3xl text-sm text-slate-600"
        />

        {reportRows.length > 0 ? (
          <div className="space-y-3">
            {reportRows.map((reportRow) => (
              <div
                key={reportRow.id}
                className="rounded-[1.1rem] border border-slate-200 bg-white/80 px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.035)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <DashboardStatusBadge
                      className={`w-fit ${getReportStatusToneClassName(reportRow.reportStatus)}`}
                    >
                      {getReportStatusLabel(reportRow.reportStatus)}
                    </DashboardStatusBadge>
                    <p className="text-sm leading-6 text-slate-600">
                      Vrijeme zapisa: {getReportTimestampLabel(reportRow)}
                    </p>
                  </div>

                  <div className="space-y-1 text-sm leading-6 text-slate-600 sm:text-right">
                    <p>Uključeno članova: {reportRow.includedMemberIdsSnapshot.length}</p>
                    <p>Verzija izvještaja: {reportRow.reportVersion}</p>
                    {reportRow.reportStatus === "queued" ? (
                      <TeamDynamicsReportProcessAction
                        teamAssessmentReportId={reportRow.id}
                        teamId={teamId}
                      />
                    ) : null}
                    {reportRow.reportStatus === "processing" ? (
                      <div className="pt-1">
                        <span
                          className={getDashboardCtaClassName({ variant: "disabled", size: "sm" })}
                        >
                          Obrada u toku
                        </span>
                      </div>
                    ) : null}
                    {reportRow.reportStatus === "ready" ? (
                      <div className="pt-1">
                        <Link
                          className={getDashboardCtaClassName({ variant: "secondary", size: "sm" })}
                          href={`/dashboard/teams/${teamId}/reports/${reportRow.id}`}
                        >
                          Otvori izvještaj
                        </Link>
                      </div>
                    ) : null}
                    {reportRow.reportStatus === "failed" ? (
                      <div className="space-y-2 pt-1">
                        <span className="text-sm font-medium text-slate-500">
                          Nije uspješno kreiran
                        </span>
                        <TeamDynamicsReportRetryAction
                          teamAssessmentReportId={reportRow.id}
                          teamId={teamId}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.1rem] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm leading-6 text-slate-600">
            Još nema pripremljenih timskih izvještaja.
          </div>
        )}
      </div>
    </DashboardInfoCardShell>
  );
}
