"use client";

import { useMemo, useState, useTransition } from "react";
import {
  replaceTeamDynamicsReportSelectionInclusionAction,
} from "@/app/actions/team-assessments";
import {
  DashboardActionRow,
  DashboardInfoCardShell,
  DashboardSectionHeader,
  DashboardStatusBadge,
  getDashboardCtaClassName,
} from "@/components/dashboard/primitives";
import type {
  TeamDynamicsReportSelectionMember,
  TeamDynamicsReportSelectionReadModel,
  TeamDynamicsReportSelectionTeamSizeStatus,
} from "@/lib/b2b/team-dynamics-report-selection";

type TeamDynamicsReportMemberSelectionProps = {
  teamAssessmentAssignmentId: string | null;
  initialSelection: TeamDynamicsReportSelectionReadModel | null;
};

type SelectionState = {
  availableMembers: TeamDynamicsReportSelectionMember[];
  includedMembers: TeamDynamicsReportSelectionMember[];
  selectedCount: number;
  teamSizeStatus: TeamDynamicsReportSelectionTeamSizeStatus;
  disabledReasons: string[];
};

type FeedbackState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

function sortMembers(members: TeamDynamicsReportSelectionMember[]) {
  return [...members].sort((left, right) => {
    const leftJoinedAt = left.joinedAt ? Date.parse(left.joinedAt) : 0;
    const rightJoinedAt = right.joinedAt ? Date.parse(right.joinedAt) : 0;

    if (leftJoinedAt !== rightJoinedAt) {
      return leftJoinedAt - rightJoinedAt;
    }

    return (left.fullName ?? "").localeCompare(right.fullName ?? "", "bs");
  });
}

function dedupeReasons(reasons: string[]) {
  return Array.from(
    new Set(reasons.filter((reason) => typeof reason === "string" && reason.trim().length > 0)),
  );
}

function getTeamSizeStatus(selectedCount: number): TeamDynamicsReportSelectionTeamSizeStatus {
  if (selectedCount < 4) {
    return "too_few";
  }

  if (selectedCount <= 10) {
    return "ideal";
  }

  if (selectedCount <= 15) {
    return "warning";
  }

  return "too_many";
}

function buildPreviewState(input: {
  availableMembers: TeamDynamicsReportSelectionMember[];
  includedMembers: TeamDynamicsReportSelectionMember[];
}): SelectionState {
  const availableMembers = sortMembers(input.availableMembers);
  const includedMembers = sortMembers(input.includedMembers);
  const selectedCount = includedMembers.length;
  const teamSizeStatus = getTeamSizeStatus(selectedCount);
  const hasIncompleteMembers = includedMembers.some((member) => member.status !== "completed");
  const hasMissingScores = includedMembers.some(
    (member) => member.scoreReadinessStatus === "not_found",
  );
  const hasInvalidScores = includedMembers.some(
    (member) => member.scoreReadinessStatus === "invalid",
  );
  const disabledReasons = dedupeReasons([
    ...(selectedCount < 4 ? ["minimum_selected_members_not_met"] : []),
    ...(selectedCount > 15 ? ["maximum_selected_members_exceeded"] : []),
    ...(hasIncompleteMembers ? ["included_members_not_completed"] : []),
    ...(hasMissingScores ? ["included_members_missing_score_snapshots"] : []),
    ...(hasInvalidScores ? ["included_members_invalid_score_snapshots"] : []),
  ]);

  return {
    availableMembers,
    includedMembers,
    selectedCount,
    teamSizeStatus,
    disabledReasons,
  };
}

function createSelectionState(
  selection: TeamDynamicsReportSelectionReadModel | null,
): SelectionState {
  if (!selection) {
    return {
      availableMembers: [],
      includedMembers: [],
      selectedCount: 0,
      teamSizeStatus: "too_few",
      disabledReasons: ["minimum_selected_members_not_met"],
    };
  }

  return {
    availableMembers: sortMembers(selection.availableMembers),
    includedMembers: sortMembers(selection.includedMembers),
    selectedCount: selection.selectedCount,
    teamSizeStatus: selection.teamSizeStatus,
    disabledReasons: [...selection.disabledReasons],
  };
}

function getTeamSizeStatusLabel(status: TeamDynamicsReportSelectionTeamSizeStatus): string {
  switch (status) {
    case "ideal":
      return "Idealno";
    case "warning":
      return "Warning";
    case "too_many":
      return "Blocked";
    case "too_few":
    default:
      return "Nije spremno";
  }
}

function getDisabledReasonLabel(reason: string): string {
  switch (reason) {
    case "minimum_selected_members_not_met":
      return "Potrebno je uključiti najmanje 4 člana.";
    case "maximum_selected_members_exceeded":
      return "MVP trenutno podržava najviše 15 uključenih članova.";
    case "included_members_not_completed":
      return "Neki uključeni članovi još nisu završili procjenu.";
    case "included_members_missing_score_snapshots":
      return "Nedostaju readiness snapshoti za neke uključene članove.";
    case "included_members_invalid_score_snapshots":
      return "Neki readiness snapshoti nisu validni za timski izvještaj.";
    default:
      return reason;
  }
}

function getParticipantStatusLabel(status: TeamDynamicsReportSelectionMember["status"]): string {
  switch (status) {
    case "completed":
      return "Završen";
    case "started":
      return "Započeto";
    case "expired":
      return "Isteklo";
    case "invited":
    default:
      return "Pozvan";
  }
}

function getParticipantStatusToneClassName(status: TeamDynamicsReportSelectionMember["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "started":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "expired":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "invited":
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

function getScoreReadinessLabel(
  status: TeamDynamicsReportSelectionMember["scoreReadinessStatus"],
): string {
  switch (status) {
    case "ready":
      return "Score readiness: spremno";
    case "invalid":
      return "Score readiness: nije validno";
    case "not_found":
    default:
      return "Score readiness: nedostaje";
  }
}

function getScoreReadinessToneClassName(
  status: TeamDynamicsReportSelectionMember["scoreReadinessStatus"],
): string {
  switch (status) {
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "invalid":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "not_found":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getBlockingReasonLabel(reason: string | null): string | null {
  if (!reason) {
    return null;
  }

  switch (reason) {
    case "member_score_snapshot_not_found":
      return "Score readiness snapshot još nije dostupan.";
    case "score_row_version_mismatch":
      return "Score readiness snapshot nije u očekivanoj verziji.";
    case "score_row_not_scored":
      return "Score readiness snapshot još nije označen kao scored.";
    case "invalid_score_snapshot_shape":
      return "Score readiness snapshot nema očekivanu strukturu.";
    case "score_snapshot_not_scored":
      return "Score readiness snapshot još nije završen.";
    case "score_snapshot_contract_mismatch":
      return "Score readiness snapshot nije validan za timski izvještaj.";
    default:
      if (reason.startsWith("member_not_completed:")) {
        const status = reason.split(":")[1] ?? "invited";
        return `Član još nije završio procjenu: ${getParticipantStatusLabel(
          status as TeamDynamicsReportSelectionMember["status"],
        ).toLowerCase()}.`;
      }

      return reason;
  }
}

function getMemberDisplayName(member: TeamDynamicsReportSelectionMember): string {
  return member.fullName?.trim() || "Ime nije dostupno";
}

function getMemberEmail(member: TeamDynamicsReportSelectionMember): string {
  return member.email?.trim() || "Email nije dostupan";
}

function getIncludedIds(state: SelectionState): string[] {
  return state.includedMembers.map((member) => member.teamAssessmentParticipantId);
}

function MemberCard({
  member,
  actionLabel,
  onAction,
}: {
  member: TeamDynamicsReportSelectionMember;
  actionLabel: string;
  onAction: (teamAssessmentParticipantId: string) => void;
}) {
  const blockingReasonLabel = getBlockingReasonLabel(member.blockingReason);

  return (
    <div className="rounded-[1.1rem] border border-slate-200 bg-white/80 p-4 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[15px] font-semibold leading-6 text-slate-950">
            {getMemberDisplayName(member)}
          </p>
          <p className="text-sm leading-6 text-slate-600">{getMemberEmail(member)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getParticipantStatusToneClassName(
              member.status,
            )}`}
          >
            {getParticipantStatusLabel(member.status)}
          </span>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getScoreReadinessToneClassName(
              member.scoreReadinessStatus,
            )}`}
          >
            {getScoreReadinessLabel(member.scoreReadinessStatus)}
          </span>
        </div>

        {blockingReasonLabel ? (
          <p className="text-sm leading-6 text-slate-600">{blockingReasonLabel}</p>
        ) : (
          <p className="text-sm leading-6 text-slate-600">
            Član je spreman za uključivanje u konkretni timski izvještaj.
          </p>
        )}

        <button
          className={getDashboardCtaClassName({ variant: "secondary", fullWidth: true, size: "sm" })}
          onClick={() => onAction(member.teamAssessmentParticipantId)}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export function TeamDynamicsReportMemberSelection({
  teamAssessmentAssignmentId,
  initialSelection,
}: TeamDynamicsReportMemberSelectionProps) {
  const [savedState, setSavedState] = useState(() => createSelectionState(initialSelection));
  const [draftState, setDraftState] = useState(() => createSelectionState(initialSelection));
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, startTransition] = useTransition();

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(getIncludedIds(draftState)) !== JSON.stringify(getIncludedIds(savedState));
  }, [draftState, savedState]);

  function moveMemberToIncluded(teamAssessmentParticipantId: string) {
    setDraftState((currentState) => {
      const member = currentState.availableMembers.find(
        (candidate) => candidate.teamAssessmentParticipantId === teamAssessmentParticipantId,
      );

      if (!member) {
        return currentState;
      }

      return buildPreviewState({
        availableMembers: currentState.availableMembers.filter(
          (candidate) => candidate.teamAssessmentParticipantId !== teamAssessmentParticipantId,
        ),
        includedMembers: [...currentState.includedMembers, member],
      });
    });
    setFeedback(null);
  }

  function moveMemberToAvailable(teamAssessmentParticipantId: string) {
    setDraftState((currentState) => {
      const member = currentState.includedMembers.find(
        (candidate) => candidate.teamAssessmentParticipantId === teamAssessmentParticipantId,
      );

      if (!member) {
        return currentState;
      }

      return buildPreviewState({
        availableMembers: [...currentState.availableMembers, member],
        includedMembers: currentState.includedMembers.filter(
          (candidate) => candidate.teamAssessmentParticipantId !== teamAssessmentParticipantId,
        ),
      });
    });
    setFeedback(null);
  }

  function handleSaveSelection() {
    if (!teamAssessmentAssignmentId) {
      setFeedback({
        tone: "error",
        message: "Finalni Team Dynamics assignment nije dostupan za čuvanje izbora.",
      });
      return;
    }

    const includedTeamAssessmentParticipantIds = getIncludedIds(draftState);

    startTransition(() => {
      void (async () => {
        const result = await replaceTeamDynamicsReportSelectionInclusionAction({
          teamAssessmentAssignmentId,
          includedTeamAssessmentParticipantIds,
        });

        if (!result.ok) {
          setFeedback({
            tone: "error",
            message: result.message,
          });
          return;
        }

        const nextState = createSelectionState(result.selection);
        setSavedState(nextState);
        setDraftState(nextState);
        setFeedback({
          tone: "success",
          message: "Izbor članova je sačuvan.",
        });
      })();
    });
  }

  return (
    <div className="space-y-5">
      <DashboardInfoCardShell className="rounded-[1.25rem] border-slate-200 bg-white/85 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              selectedCount
            </p>
            <p className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
              {draftState.selectedCount}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              teamSizeStatus
            </p>
            <DashboardStatusBadge className="w-fit border-slate-200 bg-slate-100 text-slate-700">
              {getTeamSizeStatusLabel(draftState.teamSizeStatus)}
            </DashboardStatusBadge>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              disabledReasons
            </p>
            <div className="flex flex-wrap gap-2">
              {draftState.disabledReasons.length > 0 ? (
                draftState.disabledReasons.map((reason) => (
                  <DashboardStatusBadge
                    key={reason}
                    className="border-slate-200 bg-slate-100 text-slate-700"
                  >
                    {getDisabledReasonLabel(reason)}
                  </DashboardStatusBadge>
                ))
              ) : (
                <DashboardStatusBadge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Spremno za sljedeći korak
                </DashboardStatusBadge>
              )}
            </div>
          </div>
        </div>
      </DashboardInfoCardShell>

      {feedback ? (
        <div
          className={
            feedback.tone === "success"
              ? "rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700"
              : "rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardInfoCardShell className="rounded-[1.4rem] border-slate-200 bg-white/85 p-4">
          <div className="space-y-4">
            <DashboardSectionHeader
              title="Svi članovi tima"
              titleClassName="text-[1.25rem]"
              description="Članovi koji pripadaju ovom Team Dynamics assignmentu. Premještanjem u desni panel uključuješ ih samo u ovaj konkretni timski izvještaj."
              descriptionClassName="max-w-none text-sm text-slate-600"
            />

            <div className="space-y-3">
              {draftState.availableMembers.length > 0 ? (
                draftState.availableMembers.map((member) => (
                  <MemberCard
                    key={member.teamAssessmentParticipantId}
                    member={member}
                    actionLabel="Uključi u izvještaj"
                    onAction={moveMemberToIncluded}
                  />
                ))
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm leading-6 text-slate-600">
                  Trenutno nema dodatnih članova za uključivanje u izvještaj.
                </div>
              )}
            </div>
          </div>
        </DashboardInfoCardShell>

        <DashboardInfoCardShell className="rounded-[1.4rem] border-slate-200 bg-white/85 p-4">
          <div className="space-y-4">
            <DashboardSectionHeader
              title="Uključeni u izvještaj"
              titleClassName="text-[1.25rem]"
              description="Ovi članovi će biti korišteni za pripremu timskog izvještaja. Član koji nije ovdje ostaje u timu, ali nije uključen u ovaj izvještaj."
              descriptionClassName="max-w-none text-sm text-slate-600"
            />

            <div className="space-y-3">
              {draftState.includedMembers.length > 0 ? (
                draftState.includedMembers.map((member) => (
                  <MemberCard
                    key={member.teamAssessmentParticipantId}
                    member={member}
                    actionLabel="Vrati u sve članove"
                    onAction={moveMemberToAvailable}
                  />
                ))
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm leading-6 text-slate-600">
                  Nijedan član još nije uključen u konkretni timski izvještaj.
                </div>
              )}
            </div>
          </div>
        </DashboardInfoCardShell>
      </div>

      <DashboardInfoCardShell className="rounded-[1.25rem] border-slate-200 bg-white/85 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="space-y-4">
          <DashboardActionRow className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              className={getDashboardCtaClassName({
                variant: isPending ? "disabled" : "primary",
              })}
              disabled={isPending || !teamAssessmentAssignmentId}
              onClick={handleSaveSelection}
              type="button"
            >
              {isPending ? "Čuvanje..." : "Sačuvaj izbor"}
            </button>
            <button
              className={getDashboardCtaClassName({ variant: "disabled" })}
              disabled
              type="button"
            >
              Kreiraj timski izvještaj
            </button>
          </DashboardActionRow>

          <p className="text-sm leading-6 text-slate-600">
            Generisanje timskog izvještaja bit će dostupno u sljedećem koraku.
          </p>
          {hasUnsavedChanges ? (
            <p className="text-sm leading-6 text-slate-600">
              Lokalni draft se razlikuje od zadnjeg sačuvanog izbora dok ne pritisneš `Sačuvaj izbor`.
            </p>
          ) : null}
        </div>
      </DashboardInfoCardShell>
    </div>
  );
}
