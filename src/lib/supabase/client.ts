import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getValidHttpUrl(candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      continue;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return trimmed;
      }
    } catch {
      // Continue to next candidate
    }
  }
  return "https://vaouuotyarwkupjwrpbz.supabase.co";
}

function getValidPublishableKey(candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    // Do not use a secret key as client-side key
    if (trimmed.startsWith("sb_secret_")) continue;
    if (trimmed.length > 10) {
      return trimmed;
    }
  }
  return "sb_publishable_HU6Ymo1pnH_5MZljgCEWjQ_DZ77tJMj";
}

const isBrowser = typeof window !== "undefined";

const rawMeta = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const rawProcess = typeof process !== "undefined" ? process.env : undefined;

const SUPABASE_URL = getValidHttpUrl([
  rawMeta?.SUPABASE_URL,
  rawProcess?.SUPABASE_URL,
  rawMeta?.VITE_SUPABASE_URL,
  rawProcess?.VITE_SUPABASE_URL,
]);

const SUPABASE_PUBLISHABLE_KEY = getValidPublishableKey([
  rawMeta?.SUPABASE_PUBLISHABLE_KEY,
  rawProcess?.SUPABASE_PUBLISHABLE_KEY,
  rawMeta?.VITE_SUPABASE_PUBLISHABLE_KEY,
  rawProcess?.VITE_SUPABASE_PUBLISHABLE_KEY,
]);

let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser,
      },
    });
  }
  return supabaseClientInstance;
}

export const supabase = getSupabase();
