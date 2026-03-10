import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, publishableKey);
const { data, error } = await supabase
  .from("tests")
  .select("id, slug, name")
  .eq("is_active", true)
  .limit(1);

if (error) {
  console.error("Supabase query failed:", error.message);
  process.exit(1);
}

console.log("Supabase query passed. Rows returned:", data?.length ?? 0);
if (data?.[0]) {
  console.log("First active test:", data[0].slug);
}
