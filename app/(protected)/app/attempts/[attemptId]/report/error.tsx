"use client";

type CandidateAttemptReportErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CandidateAttemptReportError({
  error,
  reset,
}: CandidateAttemptReportErrorProps) {
  return (
    <main className="attempt-results-page stack-md">
      <section className="attempt-results-page__content">
        <section className="card stack-sm">
          <h1>Izvjestaj trenutno nije moguce otvoriti</h1>
          <p>
            Doslo je do greske prilikom ucitavanja rezultata za ovaj pokusaj. Pokusaj ponovo
            ucitati stranicu.
          </p>
          {error.digest ? (
            <p className="results-report__section-note">Referenca greske: {error.digest}</p>
          ) : null}
          <div>
            <button type="button" className="button-secondary" onClick={reset}>
              Pokusaj ponovo
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
