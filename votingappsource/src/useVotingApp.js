import { useCallback, useEffect, useRef, useState } from "react";
import { seedCfg, seedReg, seedTal } from "./seed";
import { newToken, normTok, uid, verdict, joinLink, copyText } from "./utils";

const LS_KEY = "agm_voting_v1";

function loadPersisted() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function initialState() {
  const saved = loadPersisted();
  return {
    screen: "land",
    tab: "ballot",
    phase: saved?.phase ?? "voting",
    cfg: saved?.cfg ?? seedCfg,
    reg: saved?.reg ?? seedReg,
    tal: saved?.tal ?? seedTal,
    showTok: false,
    importText: "",
    importMsg: "",
    saveMsg: "Save ballot configuration",
    exportMsg: "Export results record",
    newCandidates: {},
    vstep: "entry",
    vtoken: "",
    vname: "",
    vidx: 0,
    vsel: {},
    verr: "",
  };
}

export function useVotingApp() {
  const [state, setFull] = useState(initialState);
  const timers = useRef([]);

  const set = useCallback((patch) => {
    setFull((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms, patch) => timers.current.push(setTimeout(() => set(patch), ms));

  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ cfg: state.cfg, phase: state.phase, reg: state.reg, tal: state.tal })
      );
    } catch {
      /* storage may be unavailable; demo still works in memory */
    }
  }, [state.cfg, state.phase, state.reg, state.tal]);

  const members = Object.values(state.reg);
  const eligible = members.filter((m) => m.eligible).length;
  const voted = members.filter((m) => m.voted).length;
  const stats = {
    total: members.length,
    eligible,
    voted,
    remaining: Math.max(0, eligible - voted),
    turnout: eligible ? Math.round((voted / eligible) * 100) : 0,
  };

  const actions = {
    goAdmin: () => set({ screen: "admin" }),
    goVoter: () => set({ screen: "voter", vstep: "entry", vtoken: "", verr: "" }),
    goLand: () => set({ screen: "land" }),
    setTab: (tab) => set({ tab }),

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
    setNewCandidate: (id, v) =>
      set((s) => ({ newCandidates: { ...s.newCandidates, [id]: v } })),
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
    saveConfig: () => {
      set({ saveMsg: "Saved" });
      later(1600, { saveMsg: "Save ballot configuration" });
    },

    setImportText: (v) => set({ importText: v }),
    doImport: () => {
      const raw = (state.importText || "").trim();
      if (!raw) return;
      const lines = raw.split("\n").map((x) => x.trim()).filter(Boolean);
      const reg = { ...state.reg };
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
      const msg = `${added} member${added !== 1 ? "s" : ""} added${
        dupes ? `, ${dupes} duplicate${dupes !== 1 ? "s" : ""} skipped` : ""
      }`;
      set({ reg, importText: "", importMsg: msg });
      later(3500, { importMsg: "" });
    },
    clearRegister: () => {
      if (confirm("Clear the entire members register, including all tokens?")) set({ reg: {} });
    },
    toggleEligible: (tok) =>
      set((s) => ({ reg: { ...s.reg, [tok]: { ...s.reg[tok], eligible: !s.reg[tok].eligible } } })),
    toggleShowTok: () => set((s) => ({ showTok: !s.showTok })),
    exportTokens: () => {
      const lines = Object.entries(state.reg)
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([t, m]) => `${m.name}${m.email ? " <" + m.email + ">" : ""}\t${t}`);
      copyText(
        `${state.cfg.org} — ${state.cfg.mtg}\nVOTING TOKENS (CONFIDENTIAL)\n\n${lines.join("\n")}\n`,
        "Token slips copied. Paste into a document to print or mail-merge."
      );
    },

    openVoting: () => set({ phase: "voting" }),
    closeVoting: () => set({ phase: "closed" }),
    resetVotes: () => {
      if (!confirm("Reset all votes and re-enable every token? This cannot be undone.")) return;
      set((s) => {
        const reg = {};
        for (const [t, m] of Object.entries(s.reg)) reg[t] = { ...m, voted: false };
        return { tal: {}, reg };
      });
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

    setVtoken: (v) => set({ vtoken: v }),
    doVerify: () => {
      const t = normTok(state.vtoken);
      if (!t) {
        set({ verr: "Please enter your voting token." });
        return;
      }
      const m = state.reg[t];
      if (!m) {
        set({ verr: "Token not recognised. Check your slip, or see the registration desk." });
        return;
      }
      if (!m.eligible) {
        set({
          verr: "This membership is not eligible to vote at this meeting. Please see the registration desk.",
        });
        return;
      }
      if (m.voted) {
        set({ verr: "This token has already been used to cast a ballot." });
        return;
      }
      if (state.phase === "setup") {
        set({ vtoken: t, vname: m.name, verr: "", vstep: "wait" });
        return;
      }
      if (state.phase === "closed") {
        set({ vtoken: t, vname: m.name, verr: "", vstep: "closed" });
        return;
      }
      set({ vtoken: t, vname: m.name, verr: "", vidx: 0, vsel: {}, vstep: "ballot" });
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
    ballotNext: () => {
      if (state.vidx >= state.cfg.items.length - 1) {
        actions.submitBallot();
        return;
      }
      set((s) => ({ vidx: s.vidx + 1 }));
    },
    submitBallot: () => {
      const { phase, reg, vtoken, vsel, tal } = state;
      if (phase !== "voting") {
        set({ verr: "Voting is no longer open.", vstep: "closed" });
        return;
      }
      const m = reg[vtoken];
      if (!m) {
        set({ verr: "Token not recognised." });
        return;
      }
      if (m.voted) {
        set({ verr: "This token has already been used." });
        return;
      }
      const newTal = { ...tal };
      for (const [item, choices] of Object.entries(vsel)) {
        newTal[item] = { ...(newTal[item] || {}) };
        choices.forEach((c) => {
          newTal[item][c] = (newTal[item][c] || 0) + 1;
        });
      }
      set({
        tal: newTal,
        reg: { ...reg, [vtoken]: { ...m, voted: true, votedAt: Date.now() } },
        vstep: "done",
      });
    },
  };

  return { state, stats, actions };
}
