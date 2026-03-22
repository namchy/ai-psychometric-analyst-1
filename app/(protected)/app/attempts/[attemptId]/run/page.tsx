import { notFound, redirect } from "next/navigation";
import { setProtectedAttemptLocale } from "@/app/actions/assessment";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import {
  getAssessmentLocaleLabel,
  type AssessmentLocale,
} from "@/lib/assessment/locale";
import { loadProtectedAttemptRunPageData } from "@/lib/assessment/protected-attempts";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptForUser } from "@/lib/candidate/attempts";

type CandidateAttemptRunPageProps = {
  params: {
    attemptId: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

function getLocaleErrorMessage(rawError: string | string[] | undefined): string | null {
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  switch (error) {
    case "locale-locked":
      return "Jezik testa se može promijeniti samo prije prvog odgovora.";
    case "locale-update-failed":
      return "Promjena jezika trenutno nije uspjela. Pokušajte ponovo.";
    default:
      return null;
  }
}

function LocaleButton({
  attemptId,
  locale,
}: {
  attemptId: string;
  locale: AssessmentLocale;
}) {
  return (
    <form action={setProtectedAttemptLocale}>
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnPath" value={`/app/attempts/${attemptId}/run`} />
      <button className="button-secondary" type="submit">
        {getAssessmentLocaleLabel(locale)}
      </button>
    </form>
  );
}

export const dynamic = "force-dynamic";

export default async function CandidateAttemptRunPage({
  params,
  searchParams,
}: CandidateAttemptRunPageProps) {
  const user = await requireAuthenticatedUser();
  const attempt = await getCandidateAttemptForUser(user.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  if (attempt.status === "completed") {
    redirect(`/app/attempts/${attempt.id}/report`);
  }

  if (attempt.status === "abandoned") {
    redirect(`/app/attempts/${attempt.id}`);
  }

  const runPageData = await loadProtectedAttemptRunPageData(attempt);
  const localeErrorMessage = getLocaleErrorMessage(searchParams?.error);

  if (runPageData.questions.length === 0) {
    return (
      <main className="stack-md">
        <section className="card stack-sm">
          <h1>{attempt.tests?.name ?? attempt.tests?.slug ?? "Procjena"}</h1>
          <p>Pitanja za ovu procjenu trenutno nisu dostupna.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="assessment-run-page stack-md">
      {attempt.lifecycle === "not_started" ? (
        <section className="card stack-sm">
          <h1>Odaberite jezik testa</h1>
          <p>Trenutni jezik: {getAssessmentLocaleLabel(attempt.locale)}.</p>
          <p>Odabrani jezik vrijedi za cijeli attempt i može se mijenjati samo prije prvog odgovora.</p>
          {localeErrorMessage ? (
            <p className="status-message status-message--danger">{localeErrorMessage}</p>
          ) : null}
          <div className="dashboard-links">
            <LocaleButton attemptId={attempt.id} locale="bs" />
            <LocaleButton attemptId={attempt.id} locale="hr" />
          </div>
        </section>
      ) : null}

      <section className="assessment-run-shell">
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
      </section>
    </main>
  );
}
