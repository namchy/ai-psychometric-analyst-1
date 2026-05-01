import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssessmentForm, RunPageTopBar } from "@/components/assessment/assessment-form";
import { getSafranScoredRunHref } from "@/lib/assessment/attempt-lifecycle";
import { loadProtectedAttemptRunPageData } from "@/lib/assessment/protected-attempts";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptForUser, markAttemptScoredStarted } from "@/lib/candidate/attempts";

type CandidateAttemptRunPageProps = {
  params: {
    attemptId: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

function isSafranAssessmentSlug(slug: string | null | undefined): boolean {
  return slug === "safran_v1";
}

export const dynamic = "force-dynamic";

export default async function CandidateAttemptRunPage({
  params,
  searchParams,
}: CandidateAttemptRunPageProps) {
  const user = await requireAuthenticatedUser();
  let attempt = await getCandidateAttemptForUser(user.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  if (attempt.status === "completed") {
    redirect(`/app/attempts/${attempt.id}/report`);
  }

  if (attempt.status === "abandoned") {
    redirect(`/app/attempts/${attempt.id}`);
  }

  const runMode = Array.isArray(searchParams?.mode)
    ? searchParams.mode[0]
    : searchParams?.mode;
  const isSafran = isSafranAssessmentSlug(attempt.tests?.slug);
  if (
    attempt.lifecycle === "not_started" &&
    isSafran &&
    runMode !== "scored"
  ) {
    redirect(`/app/attempts/${attempt.id}`);
  }

  if (isSafran && attempt.scored_started_at && runMode !== "scored") {
    redirect(getSafranScoredRunHref(attempt.id));
  }

  if (isSafran && runMode === "scored" && !attempt.scored_started_at) {
    await markAttemptScoredStarted(attempt.id);
    const refreshedAttempt = await getCandidateAttemptForUser(user.id, params.attemptId);

    if (!refreshedAttempt) {
      notFound();
    }

    attempt = refreshedAttempt;
  }

  const runPageData = await loadProtectedAttemptRunPageData(attempt);

  if (runPageData.questions.length === 0) {
    return (
      <>
        <RunPageTopBar
          userEmail={user.email ?? "candidate@example.com"}
          userName={runPageData.participantName}
        />
        <main className="run-page-frame mx-auto w-full max-w-[70rem] px-4 pt-20 pb-6 sm:px-6 lg:px-12">
          <section className="card stack-sm">
            <h1>Test trenutno nije dostupan za pokretanje</h1>
            <p>
              Ova procjena još nije spremna za candidate run flow jer pitanja trenutno nisu
              dostupna.
            </p>
            <p>Vratite se na pregled testova i pokušajte ponovo kada test bude aktiviran.</p>
            <div>
              <Link className="candidate-home__link" href="/app">
                Nazad na testove
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <RunPageTopBar
        userEmail={user.email ?? "candidate@example.com"}
        userName={runPageData.participantName}
      />
      <main className="run-page-frame mx-auto w-full max-w-[70rem] px-4 pt-20 pb-6 sm:px-6 lg:px-12">
        <div className="grid gap-6">
          <AssessmentForm
            executionMode="protected"
            layoutMode="step"
            completionRedirectPath={`/app/attempts/${attempt.id}/report`}
            assessmentDisplayName={runPageData.assessmentName}
            participantDisplayName={runPageData.participantName}
            testId={attempt.test_id}
            locale={attempt.locale}
            questions={runPageData.questions}
            answerOptionsByQuestionId={runPageData.answerOptionsByQuestionId}
            initialAttemptId={runPageData.resumeState.attemptId}
            initialAttemptStatus={runPageData.resumeState.attemptStatus}
            initialCompletedAt={runPageData.resumeState.completedAt}
            initialSelections={runPageData.resumeState.selections}
            initialResults={runPageData.results}
            initialReport={runPageData.report}
          />
        </div>
      </main>
    </>
  );
}
