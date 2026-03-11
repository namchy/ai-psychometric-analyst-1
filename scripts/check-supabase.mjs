import { createClient } from "@supabase/supabase-js";

function fail(message) {
  throw new Error(message);
}

try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  }

  const supabase = createClient(url, publishableKey);
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug, name")
    .eq("is_active", true)
    .limit(1);

  if (error) {
    fail(`Supabase query failed: ${error.message}`);
  }

  console.log("Supabase query passed. Rows returned:", data?.length ?? 0);
  if (data?.[0]) {
    console.log("First active test:", data[0].slug);
  }

  if (!serviceRoleKey) {
    fail("Missing SUPABASE_SERVICE_ROLE_KEY in the server environment");
  }

  const activeTestId = data?.[0]?.id;

  if (!activeTestId) {
    fail("No active test found for write-path verification.");
  }

  const adminSupabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: attemptData, error: attemptError } = await adminSupabase
    .from("attempts")
    .insert({ test_id: activeTestId })
    .select("id")
    .single();

  if (attemptError || !attemptData) {
    fail(`Supabase admin write check failed: ${attemptError?.message ?? "Unknown error"}`);
  }

  const { error: cleanupError } = await adminSupabase
    .from("attempts")
    .delete()
    .eq("id", attemptData.id);

  if (cleanupError) {
    fail(`Supabase admin cleanup failed: ${cleanupError.message}`);
  }

  console.log("Supabase admin write check passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
