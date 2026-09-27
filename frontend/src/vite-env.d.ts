/// <reference types="vite/client" />

// Only VITE_API_BASE_URL is actually used by the app (see src/services/api.ts).
// Previously this declared VITE_SUPABASE_URL, VITE_SUPABASE_KEY, VITE_API_URL,
// and VITE_ENV as well, none of which were read anywhere — leftover from an
// earlier design where the frontend may have talked to Supabase directly.
// The current architecture never lets the browser touch Supabase; only the
// Lambda does, with the service_role key. Keeping unused env types around
// invites someone to "wire them up" later and accidentally reintroduce that.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
