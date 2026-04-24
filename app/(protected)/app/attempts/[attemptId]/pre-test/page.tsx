import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSafranScoredRunHref } from "@/lib/assessment/attempt-lifecycle";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptForUser } from "@/lib/candidate/attempts";

type CandidateAttemptPreTestPageProps = {
  params: {
    attemptId: string;
  };
};

function isSafranAssessmentSlug(slug: string | null | undefined): boolean {
  return slug === "safran_v1";
}

export const dynamic = "force-dynamic";

export default async function CandidateAttemptPreTestPage({
  params,
}: CandidateAttemptPreTestPageProps) {
  const user = await requireAuthenticatedUser();
  const attempt = await getCandidateAttemptForUser(user.id, params.attemptId);

  if (!attempt) {
    notFound();
  }

  if (!isSafranAssessmentSlug(attempt.tests?.slug)) {
    redirect(`/app/attempts/${attempt.id}`);
  }

  if (attempt.status === "completed") {
    redirect(`/app/attempts/${attempt.id}/report`);
  }

  if (attempt.status === "abandoned") {
    redirect(`/app/attempts/${attempt.id}`);
  }

  if (attempt.lifecycle !== "not_started") {
    redirect(getSafranScoredRunHref(attempt.id));
  }

  return (
    <main className="candidate-intro stack-md mx-auto w-full max-w-5xl px-4">
      <section className="candidate-intro__hero card stack-sm">
        <div className="stack-xs">
          <p className="assessment-eyebrow">Prije početka testa</p>
          <h1>Spreman si za početak</h1>
          <p className="candidate-intro__lead">
            Sada počinje stvarni test.
          </p>
        </div>
      </section>

      <section className="candidate-intro__section card stack-sm">
        <p>Od ovog trenutka tvoji odgovori ulaze u rezultat.</p>
        <p>Rješavaj zadatke pažljivo i svojim tempom.</p>
      </section>

      <section className="candidate-intro__cta card stack-sm">
        <div className="dashboard-links">
          <Link className="button-secondary" href={`/app/attempts/${attempt.id}/practice/4`}>
            Nazad
          </Link>
          <Link className="candidate-home__link" href={getSafranScoredRunHref(attempt.id)}>
            Počni test
          </Link>
        </div>
      </section>
    </main>
  );
}
