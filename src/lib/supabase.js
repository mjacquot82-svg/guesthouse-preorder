import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export async function verifySupabaseConnection() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      connected: false,
      reason: "Missing Supabase environment variables.",
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });

    return {
      connected: response.ok,
      reason: response.ok ? "Supabase client initialized." : `Supabase returned ${response.status}.`,
    };
  } catch (error) {
    return {
      connected: false,
      reason: error instanceof Error ? error.message : "Supabase connection check failed.",
    };
  }
}
