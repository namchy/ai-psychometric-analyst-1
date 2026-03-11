import type { Test } from "@/lib/assessment/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveTest = Pick<Test, "id" | "slug" | "name" | "description">;

export async function getActiveTest(): Promise<ActiveTest | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tests")
    .select("id, slug, name, description")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active test: ${error.message}`);
  }

  return data as ActiveTest | null;
}
