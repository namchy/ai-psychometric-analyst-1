import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug, name")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return (
    <main>
      <h1>Local Supabase check</h1>
      <p>
        This page verifies that the app can read from local Supabase using the
        public client key.
      </p>

      <section className="card">
        {error ? (
          <>
            <h2>Query failed</h2>
            <pre>{error.message}</pre>
          </>
        ) : data ? (
          <>
            <h2>Query passed</h2>
            <p>Loaded test: {data.name}</p>
            <p>Slug: {data.slug}</p>
          </>
        ) : (
          <>
            <h2>No active tests found</h2>
            <p>Connection works, but seed data may be missing.</p>
          </>
        )}
      </section>
    </main>
  );
}
