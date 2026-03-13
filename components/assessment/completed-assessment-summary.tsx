import type { CompletedAssessmentReportState } from "@/lib/assessment/reports";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";

type CompletedAssessmentSummaryProps = {
  completedAt?: string | null;
  results: CompletedAssessmentResults | null;
  reportState: CompletedAssessmentReportState | null;
};

function formatDimensionLabel(dimension: string): string {
  return dimension
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatUnscoredReason(
  reason: CompletedAssessmentResults["unscoredResponses"][number]["reason"],
): string {
  if (reason === "question_type_not_scoreable") {
    return "Recorded but not scored in the current MVP model.";
  }

  return "Recorded without numeric scoring values in the current seed data.";
}

export function CompletedAssessmentSummary({
  completedAt,
  results,
  reportState,
}: CompletedAssessmentSummaryProps) {
  return (
    <>
      <p>
        Assessment completed.
        {completedAt ? ` Completed at ${new Date(completedAt).toLocaleString()}.` : ""} Your
        answers are now read-only.
      </p>

      {results ? (
        <section>
          <h2>Results</h2>
          <p>
            Scoring method: {results.scoringMethod}. Scored responses: {results.scoredResponseCount}.
          </p>

          {results.dimensions.length > 0 ? (
            <ol>
              {results.dimensions.map((dimension) => (
                <li key={dimension.dimension}>
                  <strong>{formatDimensionLabel(dimension.dimension)}</strong>: raw score{" "}
                  {dimension.rawScore} from {dimension.scoredQuestionCount} scored question(s).
                </li>
              ))}
            </ol>
          ) : (
            <p>No scoreable responses are available for this completed attempt.</p>
          )}

          {results.unscoredResponses.length > 0 ? (
            <>
              <h3>Recorded but unscored responses</h3>
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
          <h2>Assessment report</h2>
          <p>
            Generator: {reportState.report.generator_type}. Snapshot generated at{" "}
            {new Date(reportState.report.generated_at).toLocaleString()}.
          </p>
          <p>{reportState.report.summary}</p>

          <h3>Dimensions</h3>
          <ol>
            {reportState.report.dimensions.map((dimension) => (
              <li key={dimension.dimension_key}>
                <strong>{formatDimensionLabel(dimension.dimension_key)}</strong>: score{" "}
                {dimension.score}. {dimension.short_interpretation}
              </li>
            ))}
          </ol>

          <h3>Strengths</h3>
          <ul>
            {reportState.report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Blind spots</h3>
          <ul>
            {reportState.report.blind_spots.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Work style</h3>
          <ul>
            {reportState.report.work_style.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Development recommendations</h3>
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
          <h2>Assessment report</h2>
          <p>AI izvjestaj trenutno nije dostupan za ovaj zavrseni attempt.</p>
        </section>
      ) : null}
    </>
  );
}
