import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSafranScoredRunHref } from "@/lib/assessment/attempt-lifecycle";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCandidateAttemptForUser } from "@/lib/candidate/attempts";

type CandidateAttemptPracticeLandingPageProps = {
  params: {
    attemptId: string;
  };
};

function isSafranAssessmentSlug(slug: string | null | undefined): boolean {
  return slug === "safran_v1";
}

export const dynamic = "force-dynamic";

export default async function CandidateAttemptPracticeLandingPage({
  params,
}: CandidateAttemptPracticeLandingPageProps) {
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
        <div className="stack-sm">
          <div className="stack-xs">
            <p className="assessment-eyebrow">Prije početka testa</p>
            <h1>Kratka priprema</h1>
            <p className="candidate-intro__lead">
              Prije početka testa proći ćeš kroz 4 kratka primjera zadataka.
            </p>
          </div>
        </div>
      </section>

      <section className="candidate-intro__section card stack-sm">
        <p>
          Ovi primjeri služe samo da vidiš kako zadaci izgledaju i ne ulaze u rezultat.
        </p>
        <p>
          Odaberi odgovor za koji misliš da je tačan, a nakon toga nastavi dalje.
        </p>
      </section>

      <section className="candidate-intro__cta card stack-sm">
        <div className="dashboard-links">
          <Link className="button-secondary" href={`/app/attempts/${attempt.id}`}>
            Nazad
          </Link>
          <Link className="candidate-home__link" href={`/app/attempts/${attempt.id}/practice/1`}>
            Započni primjere
          </Link>
        </div>
      </section>
    </main>
  );
}
