import { useCallback, useEffect, useRef, useState } from "react";
import { backend, isLive } from "./backend";
import { uid, verdict, joinLink, copyText } from "./utils";

// How often the admin screens re-read the server during a live meeting.
// Polling rather than websockets: venue wifi drops sockets, and a missed
// push during a vote is worse than a few seconds of staleness.
const POLL_MS = 5000;

const emptyCfg = { org: "", mtg: "", quorum: 0, items: [] };

export function useVotingApp() {
  const [state, setFull] = useState({
    screen: "land",
    tab: "ballot",
    loading: true,
    error: "",
    adminEmail: null,
    authError: "",
    busy: false,

    cfg: emptyCfg,
    phase: "setup",
    reg: {},
    tal: {},
    participation: null,

    showTok: false,
    importText: "",
    importMsg: "",
    saveMsg: "Save ballot configuration",
    exportMsg: "Export results record",
    newCandidates: {},

    vstep: "entry",
    vmemberno: "",
    vtoken: "",
    vname: "",
    vidx: 0,
    vsel: {},
    verr: "",
  });

  const timers = useRef([]);
  const alive = useRef(true);

  const set = useCallback((patch) => {
    if (!alive.current) return;
    setFull((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  const later = useCallback(
    (ms, patch) => timers.current.push(setTimeout(() => set(patch), ms)),
    [set]
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // Any backend call can fail on a flaky venue connection. Route them all
  // through here so a failure shows up on screen instead of vanishing.
  const run = useCallback(
    async (what, fn, { busy = false } = {}) => {
      if (busy) set({ busy: true });
      try {
        const out = await fn();
        set({ error: "" });
        return out;
      } catch (e) {
        set({ error: e?.message || `${what} failed` });
        return null;
      } finally {
        if (busy) set({ busy: false });
      }
    },
    [set]
  );

  const loadMeeting = useCallback(async () => {
    const m = await run("Loading the meeting", () => backend.getMeeting());
    if (m) set({ cfg: m.cfg, phase: m.phase });
    return m;
  }, [run, set]);

  const loadAdminData = useCallback(async () => {
    const [reg, tal, part] = await Promise.all([
      run("Loading the register", () => backend.getRegister()),
      run("Loading results", () => backend.getTally()),
      run("Loading turnout", () => backend.getParticipation()),
    ]);
    set((s) => ({
      reg: reg ?? s.reg,
      tal: tal ?? s.tal,
      participation: part ?? s.participation,
    }));
  }, [run, set]);

  // Initial load: the meeting definition is all a voter needs. The register
  // and tallies are admin-only and load once signed in.
  useEffect(() => {
    (async () => {
      const session = await backend.getSession().catch(() => ({ email: null }));
      await loadMeeting();
      if (!backend.requiresAuth || session.email) {
        set({ adminEmail: session.email ?? "demo" });
        if (!backend.requiresAuth) await loadAdminData();
      }
      set({ loading: false });
    })();
  }, [loadMeeting, loadAdminData, set]);

  // Keep admin screens and the voter waiting-room fresh.
  const signedIn = !!state.adminEmail;
  const onAdmin = state.screen === "admin" && signedIn;
  const voterWaiting = state.screen === "voter" && state.vstep === "wait";
  useEffect(() => {
    if (!onAdmin && !voterWaiting) return undefined;
    const t = setInterval(() => {
      loadMeeting();
      if (onAdmin) loadAdminData();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [onAdmin, voterWaiting, loadMeeting, loadAdminData]);

  // A voter sitting on the waiting screen should drop into the ballot the
  // moment the chair opens voting, without touching anything.
  useEffect(() => {
    if (state.screen === "voter" && state.vstep === "wait" && state.phase === "voting") {
      set({ vstep: "ballot", vidx: 0, vsel: {} });
    }
  }, [state.screen, state.vstep, state.phase, set]);

  // ---- derived ----
  const members = Object.values(state.reg);
  const fromReg = members.length > 0;
  const eligible = fromReg
    ? members.filter((m) => m.eligible).length
    : (state.participation?.eligible_count ?? 0);
  const voted = fromReg
    ? members.filter((m) => m.voted).length
    : (state.participation?.voted_count ?? 0);
  const stats = {
    total: fromReg ? members.length : (state.participation?.register_count ?? 0),
    eligible,
    voted,
    remaining: Math.max(0, eligible - voted),
    turnout: eligible ? Math.round((voted / eligible) * 100) : 0,
  };

  const actions = {
    // ---- navigation ----
    goAdmin: () => set({ screen: "admin" }),
    goVoter: () =>
      set({ screen: "voter", vstep: "entry", vmemberno: "", vtoken: "", verr: "" }),
    goLand: () => set({ screen: "land" }),
    setTab: (tab) => set({ tab }),
    dismissError: () => set({ error: "" }),

    // ---- admin auth ----
    signIn: async (email, password) => {
      set({ busy: true, authError: "" });
      const r = await backend.signIn(email, password);
      if (!r.ok) {
        set({ busy: false, authError: r.error || "Sign in failed" });
        return;
      }
      const session = await backend.getSession();
      set({ adminEmail: session.email, busy: false, authError: "" });
      await loadAdminData();
    },
    signOut: async () => {
      await backend.signOut();
      set({ adminEmail: null, screen: "land", reg: {}, tal: {} });
    },

    // ---- ballot configuration (local draft until saved) ----
    setOrg: (v) => set((s) => ({ cfg: { ...s.cfg, org: v } })),
    setMtg: (v) => set((s) => ({ cfg: { ...s.cfg, mtg: v } })),
    setQuorum: (v) => set((s) => ({ cfg: { ...s.cfg, quorum: parseInt(v) || 0 } })),
    addItem: (type) =>
      set((s) => ({
        cfg: {
          ...s.cfg,
          items: [
            ...s.cfg.items,
            {
              id: uid(),
              type,
              title: type === "election" ? "Election: " : "Motion: ",
              seats: 1,
              thr: "majority",
              abs: false,
              options: type === "motion" ? ["For", "Against", "Abstain"] : [],
            },
          ],
        },
      })),
    delItem: (id) =>
      set((s) => ({ cfg: { ...s.cfg, items: s.cfg.items.filter((x) => x.id !== id) } })),
    setItemField: (id, field, val) =>
      set((s) => ({
        cfg: { ...s.cfg, items: s.cfg.items.map((x) => (x.id === id ? { ...x, [field]: val } : x)) },
      })),
    setNewCandidate: (id, v) => set((s) => ({ newCandidates: { ...s.newCandidates, [id]: v } })),
    addOpt: (id) => {
      const v = (state.newCandidates[id] || "").trim();
      if (!v) return;
      set((s) => ({
        cfg: {
          ...s.cfg,
          items: s.cfg.items.map((x) =>
            x.id === id && !x.options.includes(v) ? { ...x, options: [...x.options, v] } : x
          ),
        },
        newCandidates: { ...s.newCandidates, [id]: "" },
      }));
    },
    delOpt: (id, o) =>
      set((s) => ({
        cfg: {
          ...s.cfg,
          items: s.cfg.items.map((x) =>
            x.id === id ? { ...x, options: x.options.filter((y) => y !== o) } : x
          ),
        },
      })),
    saveConfig: async () => {
      const r = await run("Saving the ballot", () => backend.saveConfig(state.cfg), { busy: true });
      if (r) {
        set({ saveMsg: "Saved" });
        later(1600, { saveMsg: "Save ballot configuration" });
      }
    },

    // ---- register ----
    setImportText: (v) => set({ importText: v }),
    doImport: async () => {
      const raw = (state.importText || "").trim();
      if (!raw) return;
      const lines = raw.split("\n").map((x) => x.trim()).filter(Boolean);
      const r = await run("Importing members", () => backend.importMembers(lines), { busy: true });
      if (!r) return;
      const msg = `${r.added} member${r.added !== 1 ? "s" : ""} added${
        r.dupes ? `, ${r.dupes} duplicate${r.dupes !== 1 ? "s" : ""} skipped` : ""
      }`;
      set({ importText: "", importMsg: msg });
      later(3500, { importMsg: "" });
      await loadAdminData();
    },
    clearRegister: async () => {
      if (!confirm("Clear the entire members register, including all tokens?")) return;
      await run("Clearing the register", () => backend.clearRegister(), { busy: true });
      await loadAdminData();
    },
    toggleEligible: async (token) => {
      const m = state.reg[token];
      if (!m) return;
      await run("Updating the member", () => backend.setEligible(token, !m.eligible, m.id));
      await loadAdminData();
    },
    toggleShowTok: () => set((s) => ({ showTok: !s.showTok })),
    exportTokens: () => {
      const entries = Object.entries(state.reg);
      const byNumber = entries.some(([, m]) => m.memberNo);
      const lines = entries
        .sort(([, a], [, b]) =>
          byNumber && a.memberNo && b.memberNo
            ? a.memberNo.localeCompare(b.memberNo, undefined, { numeric: true })
            : a.name.localeCompare(b.name)
        )
        .map(
          ([t, m]) =>
            `${(m.memberNo || "—").padEnd(12)}${m.name}${m.email ? " <" + m.email + ">" : ""}\t${t}`
        );
      // The token is a secret even though the number beside it is not, so the
      // sheet as a whole has to be handled as confidential.
      copyText(
        `${state.cfg.org} — ${state.cfg.mtg}\n` +
          `VOTING SLIPS (CONFIDENTIAL)\n` +
          `Members need BOTH their membership number and the token below.\n\n` +
          `${"NUMBER".padEnd(12)}NAME\tTOKEN\n${lines.join("\n")}\n`,
        "Voting slips copied. Paste into a document to print or mail-merge."
      );
    },

    // ---- session control ----
    openVoting: async () => {
      await run("Opening voting", () => backend.setPhase("voting"), { busy: true });
      await loadMeeting();
    },
    closeVoting: async () => {
      await run("Closing voting", () => backend.setPhase("closed"), { busy: true });
      await loadMeeting();
    },
    resetVotes: async () => {
      if (!confirm("Reset all votes and re-enable every token? This cannot be undone.")) return;
      await run("Resetting votes", () => backend.resetVotes(), { busy: true });
      await Promise.all([loadMeeting(), loadAdminData()]);
    },
    copyLink: () => copyText(joinLink(state.cfg.org), "Link copied"),
    printPage: () => window.print(),

    exportResults: () => {
      const { cfg, tal } = state;
      let o = `${cfg.org}\n${cfg.mtg}\nRESULTS RECORD\n\nEligible members: ${stats.eligible}\nBallots cast: ${stats.voted}\nQuorum required: ${cfg.quorum || "not set"}\n`;
      cfg.items.forEach((it, n) => {
        const tv = tal[it.id] || {};
        const total = it.options.reduce((x, q) => x + (tv[q] || 0), 0);
        o += `\n${"-".repeat(46)}\nITEM ${n + 1} — ${it.title}\n`;
        it.options.forEach((q) => {
          o += `  ${q}: ${tv[q] || 0}\n`;
        });
        o += `  Total: ${total}\n`;
        if (it.type === "motion") {
          const r = verdict(it, tv);
          if (r)
            o += `  Threshold: ${it.thr || "majority"} (abstentions ${it.abs ? "counted" : "excluded"})\n  Denominator: ${r.den} | Required: ${r.req} | In favour: ${r.f}\n  Result: ${r.pass ? "CARRIED" : "NOT CARRIED"}\n`;
        } else {
          const w = it.options
            .map((q) => ({ q, c: tv[q] || 0 }))
            .sort((a, b) => b.c - a.c)
            .slice(0, it.seats)
            .filter((x) => x.c > 0);
          o += `  Seats: ${it.seats}\n  Elected: ${w.map((x) => x.q).join(", ") || "none"}\n`;
        }
      });
      o += `\n\nTeller: ____________________   Teller: ____________________\nSecretary: _________________   Date: ______________________\n`;
      copyText(o, "Results record copied to clipboard.");
      set({ exportMsg: "Copied ✓" });
      later(1600, { exportMsg: "Export results record" });
    },

    // ---- voter ----
    setVmemberno: (v) => set({ vmemberno: v }),
    setVtoken: (v) => set({ vtoken: v }),
    doVerify: async () => {
      if (!state.vmemberno.trim() || !state.vtoken.trim()) {
        set({ verr: "Enter both your membership number and the voting token from your slip." });
        return;
      }
      set({ busy: true });
      let r;
      try {
        r = await backend.verifyToken(state.vmemberno, state.vtoken);
      } catch (e) {
        set({ busy: false, verr: e?.message || "Could not reach the voting server." });
        return;
      }
      set({ busy: false });
      if (!r.ok) {
        set({ verr: r.error });
        return;
      }
      // Re-read the phase so a voter who loaded the page early is routed by
      // the meeting's current state, not the state when the page opened.
      const m = await loadMeeting();
      const phase = m?.phase ?? state.phase;
      const base = { vtoken: r.token, vmemberno: r.memberNo ?? state.vmemberno, vname: r.name, verr: "" };
      if (phase === "setup") set({ ...base, vstep: "wait" });
      else if (phase === "closed") set({ ...base, vstep: "closed" });
      else set({ ...base, vidx: 0, vsel: {}, vstep: "ballot" });
    },
    pick: (id, o, multi, seats) => {
      set((s) => {
        const cur = s.vsel[id] || [];
        let next;
        if (!multi) next = cur[0] === o ? [] : [o];
        else if (cur.includes(o)) next = cur.filter((x) => x !== o);
        else if (cur.length < seats) next = [...cur, o];
        else return {};
        return { vsel: { ...s.vsel, [id]: next } };
      });
    },
    ballotNext: async () => {
      if (state.vidx < state.cfg.items.length - 1) {
        set((s) => ({ vidx: s.vidx + 1 }));
        return;
      }
      set({ busy: true, verr: "" });
      let r;
      try {
        r = await backend.castBallot(state.vmemberno, state.vtoken, state.vsel);
      } catch (e) {
        // Deliberately do NOT mark the ballot done — the voter must be able to
        // retry. cast_ballot is guarded by has_voted, so a retry after a
        // response that was actually delivered is refused, not double-counted.
        set({ busy: false, verr: e?.message || "Could not submit. Please try again." });
        return;
      }
      set({ busy: false });
      if (!r.ok) {
        set({ verr: r.error, vstep: r.error?.includes("not open") ? "closed" : "ballot" });
        return;
      }
      set({ vstep: "done" });
    },
  };

  return { state, stats, actions, isLive };
}
