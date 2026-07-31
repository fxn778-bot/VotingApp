import { createLocalBackend } from "./local";
import { createSupabaseBackend } from "./supabase";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Configured → talk to Supabase and sync across every device in the room.
// Not configured → demo mode in this browser only. The app says which it is
// on screen, because running a real meeting against demo mode would be a
// silent and very bad failure.
export const backend =
  url && key ? createSupabaseBackend(url, key) : createLocalBackend();

export const isLive = backend.mode === "live";
