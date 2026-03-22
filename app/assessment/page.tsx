import { cookies } from "next/headers";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import { DEFAULT_ASSESSMENT_LOCALE } from "@/lib/assessment/locale";
import {
  ASSESSMENT_ATTEMPT_COOKIE_NAME,
  getActiveTest,
  getAnswerOptionsForQuestions,
  getAssessmentResumeState,
  getCompletedAssessmentReportSnapshot,
  getCompletedAssessmentResults,
  getQuestionsForTest,
} from "@/lib/assessment/tests";

export const dynamic = "force-dynamic";

export default async function LegacyAssessmentPage() {
  try {
    const test = await getActiveTest();

    if (!test) {
      return (
        <main>
          <section className="card">
            <h1>No active test available</h1>
            <p>Please check back later.</p>
          </section>
        </main>
      );
    }

    const questions = await getQuestionsForTest(test.id, DEFAULT_ASSESSMENT_LOCALE);

    if (questions.length === 0) {
      return (
        <main>
          <section className="card">
            <h1>{test.name}</h1>
            <p>{test.description ?? "Opis testa trenutno nije dostupan."}</p>
          </section>

          <section className="card">
            <h2>No questions available</h2>
            <p>This test does not have any questions yet.</p>
          </section>
        </main>
      );
    }

    const attemptId = cookies().get(ASSESSMENT_ATTEMPT_COOKIE_NAME)?.value;
    const answerOptionsByQuestionId = await getAnswerOptionsForQuestions(
      questions.map((question) => question.id),
      DEFAULT_ASSESSMENT_LOCALE,
    );
    const resumeState = await getAssessmentResumeState(test.id, attemptId);
    const results = await getCompletedAssessmentResults(test.id, resumeState.attemptId);
    const report = await getCompletedAssessmentReportSnapshot(test.id, resumeState.attemptId);

    return (
      <main>
        <section className="card">
          <h1>{test.name}</h1>
          <p>{test.description ?? "Opis testa trenutno nije dostupan."}</p>
        </section>

        <section className="card">
          <AssessmentForm
            testId={test.id}
            locale={DEFAULT_ASSESSMENT_LOCALE}
            questions={questions}
            answerOptionsByQuestionId={answerOptionsByQuestionId}
            initialAttemptId={resumeState.attemptId}
            initialAttemptStatus={resumeState.attemptStatus}
            initialCompletedAt={resumeState.completedAt}
            initialSelections={resumeState.selections}
            initialResults={results}
            initialReport={report}
          />
        </section>
      </main>
    );
  } catch {
    return (
      <main>
        <section className="card">
          <h1>Unable to load assessment</h1>
          <p>Please try again later.</p>
        </section>
      </main>
    );
  }
}
