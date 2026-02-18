import { PostgrestClient } from "@supabase/postgrest-js";

const SUPABASE_URL = (process.env.POSTGREST_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.POSTGREST_API_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Supabase PostgREST endpoint: {supabase_url}/rest/v1
const POSTGREST_URL = SUPABASE_URL.endsWith("/rest/v1")
  ? SUPABASE_URL
  : `${SUPABASE_URL}/rest/v1`;

export function createPostgrestClient(token?: string) {
  const client = new PostgrestClient(POSTGREST_URL, {
    schema: "public",
    fetch: (...args) => {
      let [url, options] = args;
      if (url instanceof URL || typeof url === "string") {
        const urlObj = url instanceof URL ? url : new URL(url as string);
        const columns = urlObj.searchParams.get("columns");
        if (columns && columns.includes('"')) {
          urlObj.searchParams.set("columns", columns.replace(/"/g, ""));
          url = urlObj.toString();
        }
      }
      return fetch(url, options as RequestInit);
    },
  });

  client.headers.set("Content-Type", "application/json");

  // Supabase 인증에 필요한 헤더 (apikey + Authorization)
  if (SUPABASE_ANON_KEY) {
    client.headers.set("apikey", SUPABASE_ANON_KEY);
    client.headers.set("Authorization", `Bearer ${token || SUPABASE_ANON_KEY}`);
  }

  return client;
}
