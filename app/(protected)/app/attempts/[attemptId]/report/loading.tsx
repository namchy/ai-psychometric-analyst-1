export default function CandidateAttemptReportLoading() {
  return (
    <main className="attempt-results-page stack-md mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <section className="attempt-results-page__content">
        <section className="assessment-completion-state">
          <div className="assessment-completion-state__hero stack-sm">
            <h2>Ucitavamo izvjestaj</h2>
            <p className="assessment-completion-state__description">
              Pripremamo bodovane rezultate i pregled dimenzija za ovaj zavrseni pokusaj.
            </p>
          </div>
          <div aria-hidden="true" className="assessment-completion-state__indicator">
            <span className="assessment-completion-state__indicator-orbit">
              <span className="assessment-completion-state__indicator-core" />
            </span>
            <span className="assessment-completion-state__indicator-bar" />
          </div>
          <p className="assessment-completion-state__status">
            Ovo obicno traje samo nekoliko trenutaka.
          </p>
        </section>
      </section>
    </main>
  );
}
