// Demo backend: everything lives in this browser. No sync, no auth.
// Used when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not configured.
import { seedCfg, seedReg, seedTal } from "../seed";
import { newToken, normTok } from "../utils";
import { voterError } from "./mapping";

const KEY = "agm_voting_v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(patch) {
  const cur = load() || { cfg: seedCfg, phase: "voting", reg: seedReg, tal: seedTal };
  const next = { ...cur, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private browsing or quota — demo continues in memory for this page view */
  }
  return next;
}

function state() {
  return load() || save({});
}

export function createLocalBackend() {
  return {
    mode: "demo",
    // Demo mode has no real accounts; the admin panel opens straight away.
    requiresAuth: false,

    async getSession() {
      return { email: null };
    },
    async signIn() {
      return { ok: true };
    },
    async signOut() {
      return { ok: true };
    },

    async getMeeting() {
      const s = state();
      return { cfg: s.cfg, phase: s.phase };
    },
    async saveConfig(cfg) {
      save({ cfg });
      return { ok: true };
    },

    async getRegister() {
      return state().reg;
    },
    async importMembers(lines) {
      const s = state();
      const reg = { ...s.reg };
      const names = new Set(Object.values(reg).map((m) => m.name.toLowerCase()));
      const toks = new Set(Object.keys(reg));
      let added = 0;
      let dupes = 0;
      for (const line of lines) {
        const parts = line.split(",").map((x) => x.trim());
        const name = parts[0];
        if (!name) continue;
        if (names.has(name.toLowerCase())) {
          dupes++;
          continue;
        }
        let t;
        let guard = 0;
        do {
          t = newToken();
          guard++;
        } while (toks.has(t) && guard < 60);
        toks.add(t);
        names.add(name.toLowerCase());
        reg[t] = { name, email: parts[1] || "", eligible: true, voted: false };
        added++;
      }
      save({ reg });
      return { added, dupes };
    },
    async setEligible(token, eligible) {
      const s = state();
      save({ reg: { ...s.reg, [token]: { ...s.reg[token], eligible } } });
      return { ok: true };
    },
    async clearRegister() {
      save({ reg: {} });
      return { ok: true };
    },

    async getTally() {
      return state().tal;
    },
    async getParticipation() {
      const m = Object.values(state().reg);
      return {
        register_count: m.length,
        eligible_count: m.filter((x) => x.eligible).length,
        voted_count: m.filter((x) => x.eligible && x.voted).length,
      };
    },

    async setPhase(phase) {
      save({ phase });
      return { ok: true };
    },
    async resetVotes() {
      const s = state();
      const reg = {};
      for (const [t, m] of Object.entries(s.reg)) reg[t] = { ...m, voted: false };
      save({ reg, tal: {} });
      return { ok: true };
    },

    async verifyToken(raw) {
      const t = normTok(raw);
      const s = state();
      const m = s.reg[t];
      if (!m) return { ok: false, error: voterError("token_not_found") };
      if (!m.eligible) return { ok: false, error: voterError("not_eligible") };
      if (m.voted) return { ok: false, error: voterError("token_already_used") };
      return { ok: true, name: m.name, token: t };
    },
    async castBallot(token, selections) {
      const s = state();
      if (s.phase !== "voting") return { ok: false, error: voterError("voting_not_open") };
      const m = s.reg[token];
      if (!m) return { ok: false, error: voterError("token_not_found") };
      if (m.voted) return { ok: false, error: voterError("token_already_used") };
      const tal = { ...s.tal };
      for (const [item, choices] of Object.entries(selections)) {
        tal[item] = { ...(tal[item] || {}) };
        choices.forEach((c) => {
          tal[item][c] = (tal[item][c] || 0) + 1;
        });
      }
      save({ tal, reg: { ...s.reg, [token]: { ...m, voted: true } } });
      return { ok: true };
    },
  };
}
