import { TeamFitReportProcessAction } from "@/components/dashboard/team-fit-report-process-action";
import { TeamFitReportRetryAction } from "@/components/dashboard/team-fit-report-retry-action";
import {
  DashboardSectionHeader,
  DpButton,
  DpEmptyState,
  DpMetaGrid,
  DpMetaItem,
  DpReportCard,
  DpReportStateMessage,
  DpStatusBadge,
} from "@/components/dashboard/primitives";
import type { TeamFitReportListEntry } from "@/lib/b2b/team-fit-report-list";
import { formatHrDateTime } from "@/lib/dashboard/hr-ui-format";

type TeamFitReportListProps = {
  entries: TeamFitReportListEntry[];
};

function getStatusTone(
  status: TeamFitReportListEntry["status"],
): "success" | "warning" | "info" | "danger" {
  switch (status) {
    case "ready":
      return "success";
    case "queued":
      return "warning";
    case "processing":
      return "info";
    case "failed":
    default:
      return "danger";
  }
}

export function TeamFitReportList({ entries }: TeamFitReportListProps) {
  return (
    <div className="space-y-6">
      <DashboardSectionHeader
        eyebrow="Team Fit izvještaji"
        eyebrowClassName="text-[#073b4c]"
        title="Team Fit izvještaji"
        description="Pregled odnosa kandidata i izabranog tima, uključujući izvještaje koji čekaju pripremu, nisu uspješno pripremljeni ili su spremni za otvaranje."
        className="gap-2"
        titleClassName="text-[1.35rem]"
        descriptionClassName="max-w-3xl text-sm leading-6 text-slate-600"
      />

      {entries.length === 0 ? (
        <DpEmptyState
          title="Team Fit izvještaji još nisu dostupni"
          body="Još nema dostupnih Team Fit izvještaja za ovog kandidata u trenutnom HR kontekstu."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {entries.map((entry) => (
            <DpReportCard
              key={entry.id}
              reportStatus={entry.status}
              reportType="team-fit"
            >
              <div className="flex-1 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-[1.05rem] font-semibold leading-6 tracking-[-0.02em] text-[#073b4c]">
                      Team Fit izvještaj
                    </h3>
                    <p className="mt-1.5 text-sm leading-5 text-slate-600">
                      {entry.teamName ?? "Tim nije dostupan"}
                    </p>
                  </div>
                  <DpStatusBadge
                    className="shrink-0 self-start"
                    tone={getStatusTone(entry.status)}
                  >
                    {entry.statusLabel}
                  </DpStatusBadge>
                </div>

                <DpReportStateMessage>
                  {entry.safeStatusMessage}
                </DpReportStateMessage>

                <DpMetaGrid className="border-t border-slate-200/80 pt-4" columns={2}>
                  <DpMetaItem
                    className="border-0 bg-transparent px-0 py-0 shadow-none"
                    label="Kreirano"
                    value={formatHrDateTime(entry.createdAt)}
                  />
                  <DpMetaItem
                    className="border-0 bg-transparent px-0 py-0 shadow-none"
                    label="Zadnja promjena"
                    value={formatHrDateTime(entry.updatedAt)}
                  />
                </DpMetaGrid>
              </div>

              <div className="mt-auto pt-5">
                {entry.status === "queued" ? (
                  <TeamFitReportProcessAction
                    teamFitReportId={entry.id}
                    teamId={entry.teamId}
                    participantId={entry.participantId}
                  />
                ) : null}
                {entry.status === "processing" ? (
                  <DpButton disabled size="sm">
                    Priprema u toku
                  </DpButton>
                ) : null}
                {entry.status === "ready" ? (
                  <DpButton href={entry.href} size="sm" variant="primary">
                    Otvori Team Fit izvještaj
                  </DpButton>
                ) : null}
                {entry.status === "failed" ? (
                  <TeamFitReportRetryAction
                    teamFitReportId={entry.id}
                    teamId={entry.teamId}
                    participantId={entry.participantId}
                  />
                ) : null}
              </div>
            </DpReportCard>
          ))}
        </div>
      )}
    </div>
  );
}
