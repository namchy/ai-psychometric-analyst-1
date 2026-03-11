import { getActiveTest } from "@/lib/assessment/tests";

export default async function HomePage() {
  try {
    const test = await getActiveTest();

    return (
      <main>
        <section className="card">
          {test ? (
            <>
              <h1>{test.name}</h1>
              <p>{test.description ?? "Opis testa trenutno nije dostupan."}</p>
            </>
          ) : (
            <>
              <h1>No active test available</h1>
              <p>Please check back later.</p>
            </>
          )}
        </section>
      </main>
    );
  } catch {
    return (
      <main>
        <section className="card">
          <h1>Unable to load test</h1>
          <p>Please try again later.</p>
        </section>
      </main>
    );
  }
}
