// Demo backend: everything lives in this browser. No sync, no auth.
// Used when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not configured.
import { seedCfg, seedReg, seedTal } from "../seed";
import { newToken, normTok, parseImportLine } from "../utils";
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

// Resolve a membership number + token pair to the register key it belongs to.
// Both must match the same member; a member with no number on file (name-only
// import) is matched on the token alone.
function findKey(reg, memberNo, token) {
  const t = normTok(token);
  if (!t) return null;
  const n = normTok(memberNo);
  return (
    Object.keys(reg).find((k) => {
      if (normTok(k) !== t) return false;
      const mn = reg[k].memberNo;
      return !mn || normTok(mn) === n;
    }) || null
  );
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
      const norms = new Set(Object.keys(reg).map(normTok));
      const numbers = new Set(
        Object.values(reg).filter((m) => m.memberNo).map((m) => normTok(m.memberNo))
      );
      let added = 0;
      let dupes = 0;
      for (const line of lines) {
        const parsed = parseImportLine(line);
        if (!parsed) continue;
        const { memberNo, name, email } = parsed;

        // A repeated membership number is the duplicate that matters — two
        // rows for one number would mean two ballots for one membership.
        if (memberNo) {
          if (numbers.has(normTok(memberNo))) {
            dupes++;
            continue;
          }
        } else if (names.has(name.toLowerCase())) {
          dupes++;
          continue;
        }

        // The membership number identifies; the token authenticates. Always
        // mint a fresh token — the number is not a secret.
        let t;
        let guard = 0;
        do {
          t = newToken();
          guard++;
        } while (norms.has(normTok(t)) && guard < 60);
        names.add(name.toLowerCase());
        if (memberNo) numbers.add(normTok(memberNo));
        reg[t] = { name, email, memberNo, eligible: true, voted: false };
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

    async verifyToken(memberNo, token) {
      const s = state();
      const key = findKey(s.reg, memberNo, token);
      const m = key && s.reg[key];
      // One error for every kind of miss: saying which half was wrong would
      // let the pair be guessed one piece at a time.
      if (!m) return { ok: false, error: voterError("token_not_found") };
      if (!m.eligible) return { ok: false, error: voterError("not_eligible") };
      if (m.voted) return { ok: false, error: voterError("token_already_used") };
      return { ok: true, name: m.name, token: key, memberNo: m.memberNo };
    },
    async castBallot(memberNo, rawToken, selections) {
      const s = state();
      if (s.phase !== "voting") return { ok: false, error: voterError("voting_not_open") };
      const token = findKey(s.reg, memberNo, rawToken);
      const m = token && s.reg[token];
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
