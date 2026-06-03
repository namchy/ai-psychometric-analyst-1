import {
  processIndividualDevelopmentProfileReportFormAction,
  resetIndividualDevelopmentProfileReportFormAction,
} from "@/app/actions/individual-development-profile";
import {
  DashboardSectionHeader,
  DpButton,
  DpMetaGrid,
  DpMetaItem,
  DpStatusBadge,
} from "@/components/dashboard/primitives";
import type { IndividualDevelopmentProfileReportListEntry } from "@/lib/assessment/individual-development-profile-report-list";
import { formatHrDateTime, formatHrShortId } from "@/lib/dashboard/hr-ui-format";

type IndividualDevelopmentProfileReportListProps = {
  entries: IndividualDevelopmentProfileReportListEntry[];
};

function getStatusTone(
  status: IndividualDevelopmentProfileReportListEntry["status"],
): "success" | "warning" | "info" | "danger" {
  switch (status) {
    case "ready":
      return "success";
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
          <article
            key={entry.id}
            className="flex h-full flex-col rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,251,253,0.96))] p-5 shadow-[0_14px_27px_rgba(15,23,42,0.06)]"
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
                <DpStatusBadge tone={getStatusTone(entry.status)}>
                  {entry.statusLabel}
                </DpStatusBadge>
              </div>

              <p className="min-h-[3rem] text-sm leading-6 text-slate-600">
                {entry.safeStatusMessage}
              </p>

              <DpMetaGrid columns={3}>
                <DpMetaItem
                  helper="Interni skraćeni identifikator ciklusa"
                  label="Ciklus procjene"
                  value={formatHrShortId(entry.assessmentAssignmentId)}
                />
                <DpMetaItem label="Kreirano" value={formatHrDateTime(entry.createdAt)} />
                <DpMetaItem
                  label="Zadnja promjena"
                  value={formatHrDateTime(entry.updatedAt)}
                />
              </DpMetaGrid>
            </div>

            <div className="mt-6">
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
              {entry.status === "ready" ? (
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
          </article>
        ))}
      </div>
    </div>
  );
}
