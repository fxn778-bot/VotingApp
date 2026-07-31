import { color, serif } from "../theme";
import { phaseBadge, btn } from "../ui.jsx";
import BallotTab from "./BallotTab";
import RegisterTab from "./RegisterTab";
import SessionTab from "./SessionTab";
import ResultsTab from "./ResultsTab";

const TABS = [
  ["ballot", "Ballot"],
  ["register", "Register"],
  ["session", "Session"],
  ["results", "Results"],
];

function tabStyle(active) {
  return {
    fontSize: 13,
    padding: "9px 14px",
    border: "none",
    borderBottom: `2.5px solid ${active ? color.ink : "transparent"}`,
    background: "none",
    color: active ? color.ink : color.ink3,
    fontWeight: active ? 600 : 400,
    whiteSpace: "nowrap",
    cursor: "pointer",
    borderRadius: 0,
    fontFamily: "inherit",
  };
}

export default function Admin({ state, stats, actions }) {
  const { cfg, phase, tab } = state;
  return (
    <>
      <div
        style={{
          background: "#fff",
          borderBottom: `1px solid ${color.line}`,
          padding: "14px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 9,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10.5,
              color: color.ink3,
              textTransform: "uppercase",
              letterSpacing: ".05em",
              fontWeight: 600,
            }}
          >
            {cfg.org}
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 600, fontFamily: serif }}>Admin panel</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {phase === "setup" && <span style={phaseBadge("#EFEAE0", color.ink2)}>Setup</span>}
          {phase === "voting" && (
            <span style={phaseBadge(color.greenSoft, color.green)}>Voting open</span>
          )}
          {phase === "closed" && <span style={phaseBadge(color.amberSoft, color.amber)}>Closed</span>}
          <button
            onClick={actions.goLand}
            style={{ ...btn, fontSize: 12, padding: "7px 12px", borderRadius: 8 }}
          >
            ← Exit
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 20px 70px" }}>
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${color.line}`,
            marginBottom: 22,
            overflowX: "auto",
            gap: 2,
          }}
        >
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => actions.setTab(key)} style={tabStyle(tab === key)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "ballot" && <BallotTab state={state} actions={actions} />}
        {tab === "register" && <RegisterTab state={state} stats={stats} actions={actions} />}
        {tab === "session" && <SessionTab state={state} stats={stats} actions={actions} />}
        {tab === "results" && <ResultsTab state={state} stats={stats} actions={actions} />}
      </div>
    </>
  );
}
