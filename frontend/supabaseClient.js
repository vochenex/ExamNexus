import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://jtwhrjwyqzolnxnesmrw.supabase.co";

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0d2hyand5cXpvbG54bmVzbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzUzODksImV4cCI6MjA5NTU1MTM4OX0.Oo9yJxNNDGdCPag-vJoIFDYoMLPQF_DHkVbMTQuBKyk";

// Shared across tabs via localStorage so duplicate tabs can refresh the same
// session without invalidating each other (sessionStorage caused "session expired").
const authStorage =
  typeof window !== "undefined" ? window.localStorage : undefined;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: authStorage,
    storageKey: "examnexus-auth-token",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
