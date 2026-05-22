import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  getTeamAssessmentExecutionStatusLabel,
  loadTeamAssessmentExecutionContext,
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
            <dd className="text-sm font-semibold text-slate-900">
              {getTeamAssessmentExecutionStatusLabel(shellState.wrapperStatus)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Paket procjene
            </dt>
            <dd className="text-sm font-semibold text-slate-900">{access.context.packageSlug}</dd>
          </div>
        </dl>

        <section className="space-y-3 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-5">
          <h2 className="text-lg font-bold tracking-[-0.03em] text-slate-950">
            {shellState.title}
          </h2>
          <p className="text-sm leading-6 text-slate-700">
            {shellState.message}
          </p>
        </section>
      </section>
    </main>
  );
}
