"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { createTeamDynamicsAssessmentAction } from "@/app/actions/team-assessments";
import {
  DashboardActionRow,
  DashboardSectionShell,
  getDashboardCtaClassName,
} from "@/components/dashboard/primitives";
import { INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE } from "@/lib/assessment/team-dynamics-action-contract";
import type { TeamSummary } from "@/lib/b2b/team-summary";

type HrTeamsTableProps = {
  teams: TeamSummary[];
};

function getAssessmentStatusBadgeClassName(hasActiveAssessment: boolean): string {
  return hasActiveAssessment
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-slate-200 bg-slate-50 text-slate-500";
}

function getRowFeedbackToneClassName(isSuccess: boolean, message: string | null) {
  if (!message) {
    return null;
  }

  return isSuccess
    ? "rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700"
    : "rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700";
}

export function HrTeamsTable({ teams }: HrTeamsTableProps) {
  const [state, formAction] = useFormState(
    createTeamDynamicsAssessmentAction,
    INITIAL_CREATE_TEAM_DYNAMICS_ASSESSMENT_ACTION_STATE,
  );

  return (
    <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
      <div className="border-b border-slate-200/80 px-4 py-5 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-headline text-[1.8rem] font-bold tracking-[-0.04em] text-slate-950">
            Timovi
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Pregled postojećih timova i pokretanje procjene timske dinamike kroz agregirani uvid, bez individualnog targetiranja članova.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto px-3 pb-3 pt-1 sm:px-4">
        <table className="min-w-[980px] w-full border-separate border-spacing-x-0 border-spacing-y-3">
          <colgroup>
            <col className="w-[32%]" />
            <col className="w-[16%]" />
            <col className="w-[24%]" />
            <col className="w-[28%]" />
          </colgroup>
          <thead>
            <tr className="text-left">
              {["Tim", "Aktivni članovi", "Procjena timske dinamike", "Akcija"].map((header) => (
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
            {teams.map((team) => {
              const isActiveAssessmentVisible = team.activeAssessment !== null;
              const isFeedbackTarget = state.teamId === team.teamId;
              const message =
                isFeedbackTarget && state.ok
                  ? state.assignmentAction === "reused"
                    ? "Aktivna procjena za ovaj tim već postoji."
                    : "Procjena timske dinamike je pokrenuta."
                  : isFeedbackTarget && !state.ok
                    ? state.message
                    : null;
              const feedbackClassName = getRowFeedbackToneClassName(state.ok, message);

              return (
                <tr key={team.teamId} className="group transition hover:-translate-y-[1px]">
                  <td className="align-middle rounded-l-[1.1rem] border-y border-l border-slate-200/70 bg-[rgba(255,255,255,0.94)] pr-4 pl-5 py-5 transition-colors group-hover:bg-white">
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-[15px] font-semibold leading-6 text-slate-950">
                          {team.name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {team.description?.trim() || "Tim nema dodatni opis."}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="align-middle border-y border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 transition-colors group-hover:bg-white">
                    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                      {team.activeMemberCount}
                    </span>
                  </td>
                  <td className="align-middle border-y border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 transition-colors group-hover:bg-white">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getAssessmentStatusBadgeClassName(
                          isActiveAssessmentVisible,
                        )}`}
                      >
                        {isActiveAssessmentVisible ? "Aktivna procjena" : "Nema aktivne procjene"}
                      </span>
                      {team.activeAssessment ? (
                        <p className="text-sm leading-6 text-slate-600">
                          Završeno {team.activeAssessment.completedCount}/{team.activeAssessment.invitedCount}
                        </p>
                      ) : (
                        <p className="text-sm leading-6 text-slate-500">
                          Procjena timske dinamike još nije pokrenuta za ovaj tim.
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="align-middle rounded-r-[1.1rem] border-y border-r border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 transition-colors group-hover:bg-white">
                    <div className="space-y-3">
                      <form action={formAction} className="space-y-3">
                        <input name="teamId" type="hidden" value={team.teamId} />
                        {feedbackClassName ? <p className={feedbackClassName}>{message}</p> : null}
                        <DashboardActionRow>
                          <button
                            className={getDashboardCtaClassName({ variant: "primary", fullWidth: true })}
                            type="submit"
                          >
                            Pokreni procjenu timske dinamike
                          </button>
                        </DashboardActionRow>
                      </form>
                      <Link
                        className={getDashboardCtaClassName({ variant: "secondary", fullWidth: true })}
                        href={`/dashboard/teams/${team.teamId}`}
                      >
                        Otvori admin detalje
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardSectionShell>
  );
}
