// Live backend: Supabase (PostgreSQL + PostgREST + Auth).
//
// Trust model, mirroring supabase/schema.sql:
//   * Voters are the `anon` role. They can read meeting_config and the
//     participation counts, and call verify_token / cast_ballot. They cannot
//     read the register, raw ballots, or live tallies — RLS blocks it, so a
//     leaked anon key does not leak the ballot.
//   * Admins sign in and become `authenticated`, which unlocks the register,
//     tallies and session control.
// Any admin call therefore fails without a session; that is the database
// enforcing the rule, not the UI being polite.
import { createClient } from "@supabase/supabase-js";
import { configFromDb, configToDb, registerFromDb, tallyFromDb, voterError } from "./mapping";
import { normTok } from "../utils";

export function createSupabaseBackend(url, anonKey) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  // PostgREST errors carry a code/message; surface something an operator can
  // act on rather than "[object Object]".
  const fail = (e, what) => {
    const msg = e?.message || e?.error_description || String(e);
    return new Error(`${what}: ${msg}`);
  };

  return {
    mode: "live",
    requiresAuth: true,
    client: sb,

    async getSession() {
      const { data } = await sb.auth.getSession();
      return { email: data?.session?.user?.email ?? null };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    async signOut() {
      await sb.auth.signOut();
      return { ok: true };
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) =>
        cb(session?.user?.email ?? null)
      );
      return () => data?.subscription?.unsubscribe();
    },

    // ---- meeting definition (readable by voters) ----
    async getMeeting() {
      const { data, error } = await sb
        .from("meeting_config")
        .select("org_name,meeting_name,quorum,phase,items")
        .eq("id", 1)
        .single();
      if (error) throw fail(error, "Could not load the meeting");
      return { cfg: configFromDb(data), phase: data.phase };
    },
    async saveConfig(cfg) {
      const { error } = await sb
        .from("meeting_config")
        .update({ ...configToDb(cfg), updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw fail(error, "Could not save the ballot");
      return { ok: true };
    },

    // ---- register (admin only) ----
    async getRegister() {
      const { data, error } = await sb
        .from("members")
        .select("id,full_name,email,token,eligible,has_voted")
        .order("full_name");
      if (error) throw fail(error, "Could not load the register");
      return registerFromDb(data);
    },
    async importMembers(lines) {
      let added = 0;
      let dupes = 0;
      // Existing names are checked client-side so a re-run of the same paste
      // does not mint a second token for someone already on the register.
      const existing = new Set(
        Object.values(await this.getRegister()).map((m) => m.name.toLowerCase())
      );
      for (const line of lines) {
        const parts = line.split(",").map((x) => x.trim());
        const name = parts[0];
        if (!name) continue;
        if (existing.has(name.toLowerCase())) {
          dupes++;
          continue;
        }
        const { error } = await sb.rpc("import_member", {
          p_name: name,
          p_email: parts[1] || null,
        });
        if (error) throw fail(error, `Could not add ${name}`);
        existing.add(name.toLowerCase());
        added++;
      }
      return { added, dupes };
    },
    async setEligible(token, eligible, id) {
      const q = sb.from("members").update({ eligible });
      const { error } = id ? await q.eq("id", id) : await q.eq("token", token);
      if (error) throw fail(error, "Could not update the member");
      return { ok: true };
    },
    async clearRegister() {
      // neq on a never-matching id deletes all rows while keeping PostgREST's
      // mandatory filter, which exists to stop an accidental unfiltered delete.
      const { error } = await sb
        .from("members")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw fail(error, "Could not clear the register");
      return { ok: true };
    },

    // ---- results ----
    async getTally() {
      const { data, error } = await sb.from("tally").select("item_id,choice,votes");
      if (error) throw fail(error, "Could not load results");
      return tallyFromDb(data);
    },
    async getParticipation() {
      const { data, error } = await sb
        .from("participation")
        .select("eligible_count,voted_count,register_count")
        .single();
      if (error) throw fail(error, "Could not load turnout");
      return data;
    },

    // ---- session control (admin only) ----
    async setPhase(phase) {
      const fn = phase === "voting" ? "open_voting" : "close_voting";
      const { error } = await sb.rpc(fn);
      if (error) throw fail(error, "Could not change the session");
      return { ok: true };
    },
    async resetVotes() {
      const { error } = await sb.rpc("reset_votes");
      if (error) throw fail(error, "Could not reset votes");
      return { ok: true };
    },

    // ---- voter path (anon) ----
    async verifyToken(raw) {
      const token = normTok(raw);
      const { data, error } = await sb.rpc("verify_token", { p_token: token });
      if (error) throw fail(error, "Could not reach the voting server");
      if (!data?.ok) return { ok: false, error: voterError(data?.error) };
      return { ok: true, name: data.name, token };
    },
    async castBallot(token, selections) {
      const { data, error } = await sb.rpc("cast_ballot", {
        p_token: token,
        p_selections: selections,
      });
      if (error) throw fail(error, "Could not submit your ballot");
      if (!data?.ok) return { ok: false, error: voterError(data?.error) };
      return { ok: true };
    },
  };
}
