import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, publishableKey } = getSupabaseEnv();
    browserClient = createClient(url, publishableKey);
  }
  return browserClient;
}
