
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

if (!isSupabaseConfigured) {
  console.warn(
    "[Auth] Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) are not set. Optional authentication is running in offline demo mode."
  );
}

// Fallback dummy client or real Supabase client
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : (createClient(
      "https://placeholder-project.supabase.co",
      "placeholder-anon-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    ) as SupabaseClient);

