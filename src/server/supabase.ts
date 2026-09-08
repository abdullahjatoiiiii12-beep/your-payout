import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export { createSupabaseContext, withSupabase } from "@supabase/server";

let cachedAdminClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;

function getSafeSupabaseUrl(): string {
  const candidate = process.env.SUPABASE_URL || "https://vaouuotyarwkupjwrpbz.supabase.co";
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return "https://vaouuotyarwkupjwrpbz.supabase.co";
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch {
    // fallback
  }
  return "https://vaouuotyarwkupjwrpbz.supabase.co";
}

export function getSupabaseConfig() {
  const url = getSafeSupabaseUrl();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const jwksUrl = process.env.SUPABASE_JWKS_URL;

  return {
    url: url || "",
    publishableKey: publishableKey ? `${publishableKey.slice(0, 14)}...` : "",
    jwksUrl: jwksUrl || "",
    isConfigured: Boolean(url && (publishableKey || secretKey)),
    hasSecretKey: Boolean(secretKey && !secretKey.includes("••")),
    hasPublishableKey: Boolean(publishableKey),
  };
}

/**
 * Lazy-initializes and returns a Supabase Admin Client using SUPABASE_SECRET_KEY.
 * Fails fast with clear explanation if credentials are not configured.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const url = getSafeSupabaseUrl();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("SUPABASE_URL environment variable is missing.");
  }
  if (!secretKey || secretKey.includes("••")) {
    throw new Error(
      "SUPABASE_SECRET_KEY environment variable is required for server admin client.",
    );
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedAdminClient;
}

/**
 * Lazy-initializes and returns a standard Supabase Client using SUPABASE_PUBLISHABLE_KEY.
 */
export function getSupabaseClient(): SupabaseClient {
  const url = getSafeSupabaseUrl();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("SUPABASE_URL environment variable is missing.");
  }
  if (!key || key.includes("••")) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY environment variable is required.");
  }

  if (!cachedPublicClient) {
    cachedPublicClient = createClient(url, key, {
      auth: {
        persistSession: false,
      },
    });
  }

  return cachedPublicClient;
}
