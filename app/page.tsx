import { getActiveTest, getQuestionsForTest } from "@/lib/assessment/tests";

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

    return (
      <main>
        <section className="card">
          <h1>{test.name}</h1>
          <p>{test.description ?? "Opis testa trenutno nije dostupan."}</p>
        </section>

        <section className="card">
          {questions.length > 0 ? (
            <ol>
              {questions.map((question) => (
                <li key={question.id}>{question.text}</li>
              ))}
            </ol>
          ) : (
            <>
              <h2>No questions available</h2>
              <p>This test does not have any questions yet.</p>
            </>
          )}
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
