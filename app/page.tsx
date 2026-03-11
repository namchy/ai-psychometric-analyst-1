import {
  getActiveTest,
  getAnswerOptionsForQuestions,
  getQuestionsForTest,
} from "@/lib/assessment/tests";

export default async function HomePage() {
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

    const questions = await getQuestionsForTest(test.id);

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

    const answerOptionsByQuestionId = await getAnswerOptionsForQuestions(
      questions.map((question) => question.id),
    );

    return (
      <main>
        <section className="card">
          <h1>{test.name}</h1>
          <p>{test.description ?? "Opis testa trenutno nije dostupan."}</p>
        </section>

        <section className="card">
          <ol>
            {questions.map((question) => {
              const options = answerOptionsByQuestionId[question.id] ?? [];

              return (
                <li key={question.id}>
                  <p>{question.text}</p>
                  {options.length > 0 ? (
                    <ol>
                      {options.map((option) => (
                        <li key={option.id}>{option.label}</li>
                      ))}
                    </ol>
                  ) : (
                    <p>No answer options available for this question.</p>
                  )}
                </li>
              );
            })}
          </ol>
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
