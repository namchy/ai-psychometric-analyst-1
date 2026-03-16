import type { CompletedAssessmentReportState } from "@/lib/assessment/reports";
import { formatDimensionLabel } from "@/lib/assessment/result-display";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";

type CompletedAssessmentSummaryProps = {
  completedAt?: string | null;
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
  results,
  reportState,
}: CompletedAssessmentSummaryProps) {
  return (
    <>
      <p>
        Procjena je završena.
        {completedAt ? ` Završeno: ${new Date(completedAt).toLocaleString()}.` : ""} Vaši odgovori
        su sada dostupni samo za pregled.
      </p>

      {results ? (
        <section>
          <h2>Rezultati</h2>
          <p>
            Metoda bodovanja: {results.scoringMethod}. Broj bodovanih odgovora:{" "}
            {results.scoredResponseCount}.
          </p>

          {results.dimensions.length > 0 ? (
            <ol>
              {results.dimensions.map((dimension) => (
                <li key={dimension.dimension}>
                  <strong>{formatDimensionLabel(dimension.dimension)}</strong>: sirovi skor{" "}
                  {dimension.rawScore} iz {dimension.scoredQuestionCount} bodovanih pitanja.
                </li>
              ))}
            </ol>
          ) : (
            <p>Za ovaj završeni pokušaj nisu dostupni odgovori koji se mogu bodovati.</p>
          )}

          {results.unscoredResponses.length > 0 ? (
            <>
              <h3>Zabilježeni, ali nebodovani odgovori</h3>
              <ol>
                {results.unscoredResponses.map((response) => (
                  <li key={response.questionId}>
                    <strong>{response.questionCode}</strong>: {formatUnscoredReason(response.reason)}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
      ) : null}

      {reportState?.status === "ready" ? (
        <section>
          <h2>AI izvještaj procjene</h2>
          <p>
            Generator: {reportState.report.generator_type}. Sačuvani izvještaj generisan:{" "}
            {new Date(reportState.report.generated_at).toLocaleString()}.
          </p>
          <p>{reportState.report.summary}</p>

          <h3>Dimenzije</h3>
          <ol>
            {reportState.report.dimensions.map((dimension) => (
              <li key={dimension.dimension_key}>
                <strong>{formatDimensionLabel(dimension.dimension_key)}</strong>: skor{" "}
                {dimension.score}. {dimension.short_interpretation}
              </li>
            ))}
          </ol>

          <h3>Snage</h3>
          <ul>
            {reportState.report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Slijepe tačke</h3>
          <ul>
            {reportState.report.blind_spots.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Radni stil</h3>
          <ul>
            {reportState.report.work_style.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Preporuke za razvoj</h3>
          <ul>
            {reportState.report.development_recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <p>{reportState.report.disclaimer}</p>
        </section>
      ) : null}

      {reportState?.status === "unavailable" ? (
        <section>
          <h2>AI izvještaj procjene</h2>
          <p>AI izvještaj trenutno nije dostupan za ovaj završeni pokušaj.</p>
        </section>
      ) : null}
    </>
  );
}
