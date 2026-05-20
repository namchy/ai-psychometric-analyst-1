import {
  DashboardSectionHeader,
  DashboardSectionShell,
  PageNavigation,
} from "@/components/dashboard/primitives";
import type { TeamAssessmentDetail } from "@/lib/b2b/team-assessment-detail";
import { formatHrDateTime } from "@/lib/dashboard/hr-ui-format";

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  active: "Aktivna",
  closed: "Zatvorena",
  ready_for_report: "Spremna za izvještaj",
  reported: "Izvještaj završen",
  cancelled: "Otkazana",
};

const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  invited: "Pozvan",
  started: "Započeo",
  completed: "Završio",
  expired: "Isteklo",
};

const TEAM_ROLE_LABELS: Record<string, string> = {
  member: "Član",
  lead: "Lead",
  observer: "Observer",
};

function getAssignmentStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return "Nije dostupno";
  }

  return ASSIGNMENT_STATUS_LABELS[status] ?? "Nepoznato";
}

function getParticipantStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return "Nije dostupno";
  }

  return PARTICIPANT_STATUS_LABELS[status] ?? "Nepoznato";
}

function getRoleLabel(role: string | null | undefined): string {
  if (!role) {
    return "Nije dostupno";
  }

  return TEAM_ROLE_LABELS[role] ?? role;
}

function SummaryCard(input: {
  label: string;
  value: string;
  tone?: "default" | "accent";
}) {
  const toneClassName =
    input.tone === "accent"
      ? "border-teal-200 bg-teal-50 text-teal-900"
      : "border-slate-200 bg-white/80 text-slate-900";

  return (
    <div className={`rounded-[1.25rem] border px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${toneClassName}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {input.label}
      </p>
      <p className="mt-2 text-xl font-bold tracking-[-0.03em]">{input.value}</p>
    </div>
  );
}

export function HrTeamAssessmentDetail({
  detail,
}: {
  detail: TeamAssessmentDetail;
}) {
  const assignment = detail.latestAssignment;
  const completionValue = assignment
    ? `${assignment.completedCount}/${assignment.invitedCount}`
    : "Nije pokrenuto";

  return (
    <div className="space-y-8 pb-12">
      <DashboardSectionShell className="shadow-[0_24px_54px_rgba(15,23,42,0.1)] lg:p-7">
        <div className="relative space-y-5">
          <PageNavigation
            backHref="/dashboard/teams"
            backLabel="Nazad na timove"
            contextLabel="Team Dynamics admin"
          />

          <DashboardSectionHeader
            eyebrow="Procjena timske dinamike"
            eyebrowClassName="text-teal-800/90"
            title={detail.name}
            titleClassName="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl"
            description={
              detail.description?.trim() ||
              "Admin pregled statusa timske procjene i wrapper napretka za članove tima."
            }
            descriptionClassName="max-w-3xl"
          />
        </div>
      </DashboardSectionShell>

      <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-5 py-5 shadow-[0_30px_70px_rgba(15,23,42,0.1)] sm:px-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Aktivni članovi" value={`${detail.activeMemberCount}`} />
          <SummaryCard
            label="Status procjene"
            value={assignment ? getAssignmentStatusLabel(assignment.status) : "Nema procjene"}
            tone={assignment ? "accent" : "default"}
          />
          <SummaryCard label="Završeno" value={completionValue} />
          <SummaryCard
            label="Otvorena"
            value={assignment?.openedAt ? formatHrDateTime(assignment.openedAt) : "Nije otvorena"}
          />
        </div>

        <div className="mt-5 rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-600">
          Ovaj admin pregled prikazuje samo status procjene na nivou tima i wrapper statuse članova. Pojedinačni ishodi, odgovori, bodovanja i izvještaji nisu dostupni u ovom view-u.
        </div>
      </DashboardSectionShell>

      {detail.activeMemberCount === 0 ? (
        <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
          <div className="px-6 py-8 text-sm leading-6 text-slate-600">
            Ovaj tim trenutno nema aktivnih članova, pa nije moguće prikazati wrapper status napretka.
          </div>
        </DashboardSectionShell>
      ) : !assignment ? (
        <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
          <div className="px-6 py-8 text-sm leading-6 text-slate-600">
            Procjena timske dinamike još nije pokrenuta za ovaj tim. Pokretanje procjene ostaje dostupno kroz listu timova.
          </div>
        </DashboardSectionShell>
      ) : assignment.participants.length === 0 ? (
        <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
          <div className="px-6 py-8 text-sm leading-6 text-slate-600">
            Trenutna procjena postoji, ali još nema wrapper redova za članove tima.
          </div>
        </DashboardSectionShell>
      ) : (
        <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
          <div className="border-b border-slate-200/80 px-4 py-5 sm:px-5">
            <DashboardSectionHeader
              eyebrow="Wrapper statusi"
              eyebrowClassName="text-teal-800/90"
              title="Članovi u procjeni"
              description="Prikaz wrapper statusa po članu tima bez rezultatskih prikaza, attempt linkova ili izvještaja."
              className="gap-2"
              titleClassName="text-[1.6rem]"
              descriptionClassName="max-w-3xl text-sm text-slate-600"
            />
          </div>

          <div className="overflow-x-auto px-3 pb-3 pt-1 sm:px-4">
            <table className="min-w-[920px] w-full border-separate border-spacing-x-0 border-spacing-y-3">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="text-left">
                  {["Član tima", "Email", "Uloga", "Status", "Završeno"].map((header) => (
                    <th
                      key={header}
                      className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                      scope="col"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignment.participants.map((participant) => (
                  <tr key={participant.teamAssessmentParticipantId} className="group transition hover:-translate-y-[1px]">
                    <td className="align-middle rounded-l-[1.1rem] border-y border-l border-slate-200/70 bg-[rgba(255,255,255,0.94)] pr-4 pl-5 py-5 transition-colors group-hover:bg-white">
                      <p className="text-[15px] font-semibold leading-6 text-slate-950">
                        {participant.fullName?.trim() || "Ime nije dostupno"}
                      </p>
                    </td>
                    <td className="align-middle border-y border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 text-sm leading-6 text-slate-600 transition-colors group-hover:bg-white">
                      {participant.email?.trim() || "Email nije dostupan"}
                    </td>
                    <td className="align-middle border-y border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 text-sm leading-6 text-slate-600 transition-colors group-hover:bg-white">
                      {getRoleLabel(participant.role)}
                    </td>
                    <td className="align-middle border-y border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 transition-colors group-hover:bg-white">
                      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                        {getParticipantStatusLabel(participant.status)}
                      </span>
                    </td>
                    <td className="align-middle rounded-r-[1.1rem] border-y border-r border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 text-sm leading-6 text-slate-600 transition-colors group-hover:bg-white">
                      {participant.completedAt ? formatHrDateTime(participant.completedAt) : "Nije završeno"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSectionShell>
      )}
    </div>
  );
}
