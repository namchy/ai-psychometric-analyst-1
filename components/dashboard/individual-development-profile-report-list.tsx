import Link from "next/link";
import {
  DashboardInfoCardShell,
  DashboardSectionHeader,
  getDashboardCtaClassName,
} from "@/components/dashboard/primitives";
import type { IndividualDevelopmentProfileReportListEntry } from "@/lib/assessment/individual-development-profile-report-list";
import { formatHrDateTime, formatHrShortId } from "@/lib/dashboard/hr-ui-format";

type IndividualDevelopmentProfileReportListProps = {
  entries: IndividualDevelopmentProfileReportListEntry[];
};

function getStatusClassName(status: IndividualDevelopmentProfileReportListEntry["status"]): string {
  switch (status) {
    case "ready":
      return "border-[rgba(6,214,160,0.22)] bg-[rgba(6,214,160,0.14)] text-[#073b4c]";
    case "queued":
      return "border-[rgba(255,209,102,0.32)] bg-[rgba(255,209,102,0.16)] text-[#073b4c]";
    case "processing":
      return "border-[rgba(17,138,178,0.18)] bg-[rgba(17,138,178,0.1)] text-[#073b4c]";
    case "failed":
    case "invalid":
    default:
      return "border-[rgba(239,71,111,0.18)] bg-[rgba(239,71,111,0.08)] text-[#073b4c]";
  }
}

function getCardTitle(status: IndividualDevelopmentProfileReportListEntry["status"]): string {
  switch (status) {
    case "ready":
      return "Razvojni profil — spreman za pregled";
    case "queued":
      return "Razvojni profil — čeka obradu";
    case "processing":
      return "Razvojni profil — u obradi";
    case "failed":
    case "invalid":
    default:
      return "Razvojni profil — nije dostupan";
  }
}

export function IndividualDevelopmentProfileReportList({
  entries,
}: IndividualDevelopmentProfileReportListProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <DashboardSectionHeader
        eyebrow="Individualni razvojni profili"
        eyebrowClassName="text-[#073b4c]"
        title="Individualni razvojni profili"
        description="Razvojni HR artefakti za onboarding, feedback i menadžerski rad koji su već evidentirani za ovog kandidata."
        className="gap-2"
        titleClassName="text-[1.35rem]"
        descriptionClassName="max-w-3xl text-sm leading-6 text-slate-600"
      />

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
                    {getCardTitle(entry.status)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Razvojni HR pregled za postojeći procjenski ciklus.
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
                  <span className="font-semibold text-slate-700">Ciklus procjene:</span>{" "}
                  {formatHrShortId(entry.assessmentAssignmentId)}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Kreirano:</span>{" "}
                  {formatHrDateTime(entry.createdAt)}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Zadnja promjena:</span>{" "}
                  {formatHrDateTime(entry.updatedAt)}
                </p>
              </div>
            </div>

            <div className="mt-6">
              {entry.status === "ready" ? (
                <Link
                  className={getDashboardCtaClassName({ variant: "primary", size: "sm" })}
                  href={entry.href}
                >
                  Otvori individualni razvojni profil
                </Link>
              ) : null}
            </div>
          </DashboardInfoCardShell>
        ))}
      </div>
    </div>
  );
}
