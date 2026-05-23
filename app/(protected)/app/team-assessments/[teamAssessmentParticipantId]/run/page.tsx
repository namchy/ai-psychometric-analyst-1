import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamDynamicsRunUiSkeleton } from "@/components/assessment/team-dynamics-run-ui-skeleton";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  loadTeamAssessmentExecutionContext,
  loadTeamAssessmentRunHandoff,
  markTeamAssessmentExecutionStartedIfInvited,
  resolveTeamAssessmentExecutionShellState,
} from "@/lib/assessment/team-assessment-execution";

type TeamAssessmentRunPageProps = {
  params: {
    teamAssessmentParticipantId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function TeamAssessmentRunPage({ params }: TeamAssessmentRunPageProps) {
  const user = await requireAuthenticatedUser();
  const access = await loadTeamAssessmentExecutionContext({
    teamAssessmentParticipantId: params.teamAssessmentParticipantId,
    userId: user.id,
  });

  if (!access.ok) {
    notFound();
  }

  let wrapperStatus = access.context.wrapperStatus;
  let shellState = resolveTeamAssessmentExecutionShellState({
    route: "run",
    wrapperStatus,
  });

  if (shellState.shouldTransitionToStarted) {
    const transition = await markTeamAssessmentExecutionStartedIfInvited({
      teamAssessmentParticipantId: access.context.teamAssessmentParticipantId,
    });

    wrapperStatus = transition.status;
    shellState = resolveTeamAssessmentExecutionShellState({
      route: "run",
      wrapperStatus,
    });
  }

  const handoff = await loadTeamAssessmentRunHandoff({
    context: {
      ...access.context,
      wrapperStatus,
    },
    shellState,
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-10 sm:px-6 lg:px-8">
      <section className="space-y-6 rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95))] p-6 shadow-[0_24px_54px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold tracking-[-0.01em] text-slate-700">
            <Link
              href={`/app/team-assessments/${params.teamAssessmentParticipantId}`}
              className="inline-flex items-center gap-2 transition-colors duration-200 hover:text-slate-900"
            >
              <span aria-hidden="true">←</span>
              <span>Nazad na uvod</span>
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 transition-colors duration-200 hover:text-slate-900"
            >
              <span>Nazad na dashboard</span>
            </Link>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Team Dynamics
            </p>
            <h1 className="text-3xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-4xl">
              Procjena timske dinamike
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-[15px]">
              Ova procjena je dio timske procjene, ne individualni psihološki profil.
            </p>
          </div>
        </div>

        <dl className="grid gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white/75 p-5 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Status wrappera
            </dt>
            <dd className="text-sm font-semibold text-slate-900">{handoff.statusLabel}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Paket procjene
            </dt>
            <dd className="text-sm font-semibold text-slate-900">{handoff.packageSlug}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Status attempta
            </dt>
            <dd className="text-sm font-semibold text-slate-900">{handoff.attemptStatus}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Broj pitanja
            </dt>
            <dd className="text-sm font-semibold text-slate-900">{handoff.activeQuestionCount}</dd>
          </div>
        </dl>

        <section className="space-y-3 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-5">
          <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
            {handoff.placeholderTitle}
          </h2>
          <p className="text-sm font-semibold text-slate-900">Podaci za rjesavanje su pripremljeni.</p>
          <p className="text-sm leading-6 text-slate-700">
            {handoff.placeholderMessage}
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Rjesavanje procjene jos nije omoguceno u ovoj verziji.
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Ucitani su osnovni execution podaci za {handoff.testName} i broj aktivnih pitanja:{" "}
            {handoff.activeQuestionCount}.
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Sekcije su pripremljene za sljedeci korak: {handoff.blockOutlineCount}.
          </p>
          <p className="text-sm leading-6 text-slate-700">
            Pitanja su pripremljena za sljedeci korak: {handoff.questionOutlineCount}.
          </p>
          {handoff.warningCode === "unexpected_question_count" ? (
            <p className="text-sm leading-6 text-amber-800">
              Handoff je ucitan, ali broj aktivnih pitanja odstupa od ocekivanog Team Dynamics
              footprinta ili outline nije uskladjen sa aktivnim pitanjima.
            </p>
          ) : null}
        </section>

        <TeamDynamicsRunUiSkeleton
          teamAssessmentParticipantId={handoff.teamAssessmentParticipantId}
          uiOnlyItems={handoff.uiOnlyItems}
          uiOnlyItemCount={handoff.uiOnlyItemCount}
          uiOnlyUnsupportedCount={handoff.uiOnlyUnsupportedCount}
          uiOnlySkeletonMode={handoff.uiOnlySkeletonMode}
          savedSelectedOptionIdsByQuestionId={handoff.savedSelectedOptionIdsByQuestionId}
          savedAnswerQuestionIds={handoff.savedAnswerQuestionIds}
          savedAnswerCount={handoff.savedAnswerCount}
          isRunnableShellState={handoff.isRunnableShellState}
        />
      </section>
    </main>
  );
}
