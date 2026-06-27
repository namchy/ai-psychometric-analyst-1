import {
  prepareIndividualDevelopmentProfileReportFormAction,
  processIndividualDevelopmentProfileReportFormAction,
  resetIndividualDevelopmentProfileReportFormAction,
} from "@/app/actions/individual-development-profile";
import {
  DashboardSectionHeader,
  DpButton,
  DpMetaGrid,
  DpMetaItem,
  DpReportCard,
  DpReportStateMessage,
  DpStatusBadge,
} from "@/components/dashboard/primitives";
import type { IndividualDevelopmentProfileReportListEntry } from "@/lib/assessment/individual-development-profile-report-list";
import { formatHrDateTime } from "@/lib/dashboard/hr-ui-format";

type IndividualDevelopmentProfileReportListProps = {
  entries: IndividualDevelopmentProfileReportListEntry[];
};

function getStatusTone(
  status: IndividualDevelopmentProfileReportListEntry["status"],
): "success" | "warning" | "info" | "danger" {
  switch (status) {
    case "ready":
      return "success";
    case "missing_eligible":
    case "queued":
      return "warning";
    case "processing":
      return "info";
    case "failed":
    case "invalid":
    default:
      return "danger";
  }
}

function getCardTitle(status: IndividualDevelopmentProfileReportListEntry["status"]): string {
  switch (status) {
    case "missing_eligible":
      return "Razvojni profil — nije pripremljen";
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
          <DpReportCard
            key={entry.id}
            reportStatus={entry.status}
            reportType="idp"
          >
            <div className="flex-1 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-[1.05rem] font-semibold leading-6 tracking-[-0.02em] text-[#073b4c]">
                    {getCardTitle(entry.status)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-5 text-slate-600">
                    Razvojni HR pregled za postojeći procjenski ciklus.
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
              {entry.status === "missing_eligible" ? (
                <form
                  action={prepareIndividualDevelopmentProfileReportFormAction.bind(null, {
                    assessmentAssignmentId: entry.assessmentAssignmentId,
                    participantId: entry.participantId,
                  })}
                >
                  <DpButton size="sm" type="submit" variant="primary">
                    Pripremi individualni razvojni profil
                  </DpButton>
                </form>
              ) : null}
              {entry.status === "queued" ? (
                <form
                  action={processIndividualDevelopmentProfileReportFormAction.bind(null, {
                    assessmentReportId: entry.id,
                    participantId: entry.participantId,
                  })}
                >
                  <DpButton size="sm" type="submit" variant="secondary">
                    Pripremi individualni razvojni profil
                  </DpButton>
                </form>
              ) : null}
              {entry.status === "ready" && entry.href ? (
                <DpButton href={entry.href} size="sm" variant="primary">
                  Otvori individualni razvojni profil
                </DpButton>
              ) : null}
              {entry.status === "failed" ? (
                <form
                  action={resetIndividualDevelopmentProfileReportFormAction.bind(null, {
                    assessmentReportId: entry.id,
                    participantId: entry.participantId,
                  })}
                >
                  <DpButton size="sm" type="submit" variant="secondary">
                    Pokušaj ponovo
                  </DpButton>
                </form>
              ) : null}
            </div>
          </DpReportCard>
        ))}
      </div>
    </div>
  );
}
