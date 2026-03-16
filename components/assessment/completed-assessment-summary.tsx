import type { CompletedAssessmentReportState } from "@/lib/assessment/reports";
import { formatDimensionLabel } from "@/lib/assessment/result-display";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";

type CompletedAssessmentSummaryProps = {
  completedAt?: string | null;
  participantName?: string | null;
  testName?: string | null;
  results: CompletedAssessmentResults | null;
  reportState: CompletedAssessmentReportState | null;
};

function formatUnscoredReason(
  reason: CompletedAssessmentResults["unscoredResponses"][number]["reason"],
): string {
  if (reason === "question_type_not_scoreable") {
    return "Zabilježeno, ali nije bodovano u trenutnom MVP modelu.";
  }

  return "Zabilježeno bez numeričkih scoring vrijednosti u trenutnim seed podacima.";
}

export function CompletedAssessmentSummary({
  completedAt,
  participantName,
  testName,
  results,
  reportState,
}: CompletedAssessmentSummaryProps) {
  const maxRawScore =
    results && results.dimensions.length > 0
      ? Math.max(...results.dimensions.map((dimension) => dimension.rawScore), 0)
      : 0;
  const reportDimensionsByKey =
    reportState?.status === "ready"
      ? new Map(
          reportState.report.dimensions.map((dimension) => [dimension.dimension_key, dimension]),
        )
      : new Map();
  const heroSummary =
    reportState?.status === "ready"
      ? reportState.report.summary
      : "Završena procjena je sačuvana u zaštićenom dashboardu i spremna je za pregled rezultata.";

  return (
    <div className="results-report stack-md">
      <section className="results-report__hero">
        <div className="results-report__hero-copy stack-sm">
          <p className="results-report__eyebrow">Završeni izvještaj procjene</p>
          <div className="stack-xs">
            <h2>{testName ?? "Rezultati procjene"}</h2>
            <p className="results-report__intro">{heroSummary}</p>
          </div>
        </div>

        <dl className="results-report__hero-meta">
          <div>
            <dt>Status</dt>
            <dd>
              <span className="results-report__status-pill">Završeno</span>
            </dd>
          </div>
          <div>
            <dt>Učesnik</dt>
            <dd>{participantName ?? "Nije dostupno"}</dd>
          </div>
          <div>
            <dt>Završeno</dt>
            <dd>{completedAt ? new Date(completedAt).toLocaleString() : "Nije dostupno"}</dd>
          </div>
          <div>
            <dt>Bodovani odgovori</dt>
            <dd>{results?.scoredResponseCount ?? 0}</dd>
          </div>
        </dl>
      </section>

      {results ? (
        <section className="results-report__section card stack-sm">
          <div className="results-report__section-heading">
            <div>
              <p className="results-report__section-kicker">Pregled dimenzija</p>
              <h3>Sažetak rezultata po dimenzijama</h3>
            </div>
            <p className="results-report__section-note">
              Metoda bodovanja: {results.scoringMethod}. Rezultati su prikazani prema dostupnim
              bodovanim odgovorima.
            </p>
          </div>

          {results.dimensions.length > 0 ? (
            <ol className="results-dimension-list">
              {results.dimensions.map((dimension) => {
                const scoreWidth =
                  maxRawScore > 0 ? Math.max((dimension.rawScore / maxRawScore) * 100, 8) : 0;
                const reportDimension = reportDimensionsByKey.get(dimension.dimension);

                return (
                  <li key={dimension.dimension} className="results-dimension-card">
                    <div className="results-dimension-card__header">
                      <div>
                        <h4>{formatDimensionLabel(dimension.dimension)}</h4>
                        <p>{dimension.scoredQuestionCount} bodovanih pitanja</p>
                      </div>
                      <div className="results-dimension-card__score">
                        <span>{dimension.rawScore}</span>
                        <small>Sirovi skor</small>
                      </div>
                    </div>

                    <div
                      className="results-dimension-card__bar"
                      aria-hidden="true"
                    >
                      <span style={{ width: `${scoreWidth}%` }} />
                    </div>

                    <p className="results-dimension-card__interpretation">
                      {reportDimension?.short_interpretation ??
                        "Detaljna interpretacija za ovu dimenziju trenutno nije dostupna."}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {results.dimensions.length === 0 ? (
            <p>Za ovaj završeni pokušaj nisu dostupni odgovori koji se mogu bodovati.</p>
          ) : null}

          {results.unscoredResponses.length > 0 ? (
            <section className="results-report__subsection stack-xs">
              <h4>Zabilježeni, ali nebodovani odgovori</h4>
              <ol className="results-inline-list">
                {results.unscoredResponses.map((response) => (
                  <li key={response.questionId}>
                    <strong>{response.questionCode}</strong>: {formatUnscoredReason(response.reason)}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </section>
      ) : null}

      {reportState?.status === "ready" ? (
        <section className="results-report__section stack-sm">
          <div className="results-report__section-heading card">
            <div>
              <p className="results-report__section-kicker">AI izvještaj procjene</p>
              <h3>Strukturirani narativ rezultata</h3>
            </div>
            <p className="results-report__section-note">
              Generator: {reportState.report.generator_type}. Generisano:{" "}
              {new Date(reportState.report.generated_at).toLocaleString()}.
            </p>
          </div>

          <section className="results-report-grid">
            <article className="card results-panel results-panel--wide stack-sm">
              <div className="results-panel__header">
                <p className="results-report__section-kicker">Executive sažetak</p>
                <h4>Ukupni pregled profila</h4>
              </div>
              <p className="results-panel__lead">{reportState.report.summary}</p>
            </article>

            <article className="card results-panel stack-sm">
              <div className="results-panel__header">
                <p className="results-report__section-kicker">Interpretacije</p>
                <h4>Kratke interpretacije po dimenzijama</h4>
              </div>
              <ol className="results-interpretation-list">
                {reportState.report.dimensions.map((dimension) => (
                  <li key={dimension.dimension_key}>
                    <strong>{formatDimensionLabel(dimension.dimension_key)}</strong>
                    <span>Skor {dimension.score}</span>
                    <p>{dimension.short_interpretation}</p>
                  </li>
                ))}
              </ol>
            </article>

            {reportState.report.strengths.length > 0 ? (
              <article className="card results-panel stack-sm">
                <div className="results-panel__header">
                  <p className="results-report__section-kicker">Ključne snage</p>
                  <h4>Oblasti koje se izdvajaju</h4>
                </div>
                <ul className="results-bullet-list">
                  {reportState.report.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}

            {reportState.report.blind_spots.length > 0 ? (
              <article className="card results-panel stack-sm">
                <div className="results-panel__header">
                  <p className="results-report__section-kicker">Potencijalne slijepe tačke</p>
                  <h4>Rizici i razvojne napetosti</h4>
                </div>
                <ul className="results-bullet-list">
                  {reportState.report.blind_spots.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}

            {reportState.report.work_style.length > 0 ? (
              <article className="card results-panel stack-sm">
                <div className="results-panel__header">
                  <p className="results-report__section-kicker">Stil rada i saradnje</p>
                  <h4>Kako se profil najčešće ispoljava</h4>
                </div>
                <ul className="results-bullet-list">
                  {reportState.report.work_style.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}

            {reportState.report.development_recommendations.length > 0 ? (
              <article className="card results-panel stack-sm">
                <div className="results-panel__header">
                  <p className="results-report__section-kicker">Preporuke za razvoj</p>
                  <h4>Praktični naredni koraci</h4>
                </div>
                <ul className="results-bullet-list">
                  {reportState.report.development_recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}
          </section>

          <p className="results-report__disclaimer">{reportState.report.disclaimer}</p>
        </section>
      ) : null}

      {reportState?.status === "unavailable" ? (
        <section className="results-report__section card stack-sm">
          <div className="results-report__section-heading">
            <div>
              <p className="results-report__section-kicker">AI izvještaj procjene</p>
              <h3>Narativni izvještaj trenutno nije dostupan</h3>
            </div>
          </div>
          <p>
            AI izvještaj trenutno nije dostupan za ovaj završeni pokušaj. Numerički rezultati i
            dalje ostaju sačuvani za pregled.
          </p>
        </section>
      ) : null}
    </div>
  );
}
