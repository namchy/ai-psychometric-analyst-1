import Link from "next/link";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  getDashboardCtaClassName,
} from "@/components/dashboard/primitives";
import type { TeamFitReportListEntry } from "@/lib/b2b/team-fit-report-list";
import { formatHrDateTime } from "@/lib/dashboard/hr-ui-format";

type TeamFitReportListProps = {
  entries: TeamFitReportListEntry[];
};

function getStatusClassName(status: TeamFitReportListEntry["status"]): string {
  switch (status) {
    case "ready":
      return "border-[rgba(6,214,160,0.22)] bg-[rgba(6,214,160,0.14)] text-[#073b4c]";
    case "queued":
      return "border-[rgba(255,209,102,0.32)] bg-[rgba(255,209,102,0.16)] text-[#073b4c]";
    case "processing":
      return "border-[rgba(17,138,178,0.18)] bg-[rgba(17,138,178,0.1)] text-[#073b4c]";
    case "failed":
    default:
      return "border-[rgba(239,71,111,0.24)] bg-[rgba(239,71,111,0.14)] text-[#073b4c]";
  }
}

export function TeamFitReportList({ entries }: TeamFitReportListProps) {
  return (
    <div className="space-y-6">
      <DashboardSectionHeader
        eyebrow="Team Fit izvještaji"
        eyebrowClassName="text-[#073b4c]"
        title="Persistirani Team Fit artefakti"
        description="Read-only pregled postojećih Team Fit izvještaja za ovog kandidata, sa sigurnim statusima i direktnim otvaranjem spremnih izvještaja."
        className="gap-2"
        titleClassName="text-[1.35rem]"
        descriptionClassName="max-w-3xl text-sm leading-6 text-slate-600"
      />

      {entries.length === 0 ? (
        <DashboardInfoCardShell className="rounded-[1.4rem] border-slate-200/80 p-5">
          <p className="text-sm leading-6 text-slate-600">
            Još nema dostupnih Team Fit izvještaja za ovog kandidata u trenutnom HR kontekstu.
          </p>
        </DashboardInfoCardShell>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {entries.map((entry) => (
            <DashboardInfoCardShell
              key={entry.id}
              className="flex h-full flex-col rounded-[1.4rem] border-slate-200/80 p-5"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                      Team Fit izvještaj
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {entry.teamName ?? "Tim nije dostupan"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getStatusClassName(entry.status)}`}
                  >
                    {entry.statusLabel}
                  </span>
                </div>

                <p className="min-h-[3rem] text-sm leading-6 text-slate-600">
                  {entry.safeStatusMessage}
                </p>

                <div className="space-y-1.5 text-xs leading-5 text-slate-500">
                  <p>
                    <span className="font-semibold text-slate-700">Vrsta:</span> Team Fit report
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Verzija:</span>{" "}
                    {entry.reportVersion}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Kreirano:</span>{" "}
                    {formatHrDateTime(entry.createdAt)}
                  </p>
                  {entry.queuedAt ? (
                    <p>
                      <span className="font-semibold text-slate-700">Queued:</span>{" "}
                      {formatHrDateTime(entry.queuedAt)}
                    </p>
                  ) : null}
                  {entry.completedAt ? (
                    <p>
                      <span className="font-semibold text-slate-700">Spremno:</span>{" "}
                      {formatHrDateTime(entry.completedAt)}
                    </p>
                  ) : null}
                  {!entry.completedAt ? (
                    <p>
                      <span className="font-semibold text-slate-700">Zadnje ažuriranje:</span>{" "}
                      {formatHrDateTime(entry.updatedAt)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6">
                {entry.status === "ready" ? (
                  <Link
                    className={getDashboardCtaClassName({ variant: "primary" })}
                    href={entry.href}
                  >
                    Otvori Team Fit izvještaj
                  </Link>
                ) : (
                  <span className={getDashboardCtaClassName({ variant: "disabled" })}>
                    {entry.statusLabel}
                  </span>
                )}
              </div>
            </DashboardInfoCardShell>
          ))}
        </div>
      )}
    </div>
  );
}
