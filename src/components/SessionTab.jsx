import { QRCodeCanvas } from "qrcode.react";
import { color, mono } from "../theme";
import { card, cardTitle, btn, alert, StatTiles } from "../ui.jsx";
import { joinLink } from "../utils";

export default function SessionTab({ state, stats, actions }) {
  const { cfg, phase } = state;
  const link = joinLink(cfg.org);
  const met = cfg.quorum > 0 && stats.voted >= cfg.quorum;

  const blockers = [];
  if (!cfg.items.length) blockers.push("add a ballot item");
  if (!stats.eligible) blockers.push("import the members register");

  const cannotOpen = phase === "voting" || blockers.length > 0;
  const cannotClose = phase !== "voting";

  const dotColor =
    phase === "setup" ? color.phaseDotSetup : phase === "voting" ? color.phaseDotVoting : color.phaseDotClosed;
  const phaseText = { setup: "Not started", voting: "Voting is open", closed: "Voting closed" }[phase];

  return (
    <>
      <div style={card}>
        <div style={{ ...cardTitle, marginBottom: 13 }}>Session control</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor }}></div>
          <span style={{ fontSize: 12.5, color: color.ink2 }}>{phaseText}</span>
        </div>
        {cfg.quorum > 0 && (
          <div
            style={{
              ...(met ? alert(color.greenSoft, color.green) : alert(color.amberSoft, color.amber)),
              marginBottom: 12,
            }}
          >
            Quorum {cfg.quorum} required · {stats.voted} participating ·{" "}
            {met ? "quorum met" : `${cfg.quorum - stats.voted} more needed`}
          </div>
        )}
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button
            onClick={actions.openVoting}
            disabled={cannotOpen}
            style={{ ...btn, padding: "9px 15px", opacity: cannotOpen ? 0.4 : 1 }}
          >
            ▶ Open voting
          </button>
          <button
            onClick={actions.closeVoting}
            disabled={cannotClose}
            style={{ ...btn, padding: "9px 15px", opacity: cannotClose ? 0.4 : 1 }}
          >
            ■ Close voting
          </button>
          <button onClick={actions.resetVotes} style={{ ...btn, padding: "9px 15px" }}>
            ↻ Reset votes
          </button>
        </div>
        {blockers.length > 0 && (
          <div style={{ fontSize: 12, color: color.ink2, marginTop: 10 }}>
            Before opening: {blockers.join("; ")}.
          </div>
        )}
      </div>

      <StatTiles
        tiles={[
          [stats.voted, "Ballots cast"],
          [stats.remaining, "Yet to vote"],
          [cfg.items.length, "Items"],
        ]}
      />

      <div style={{ background: color.soft, borderRadius: 16, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Member access QR code</div>
        <div style={{ fontSize: 12, color: color.ink2 }}>
          Project this. Members scan, then enter the token from their slip.
        </div>
        <div
          style={{
            display: "inline-block",
            background: "#fff",
            padding: 11,
            borderRadius: 11,
            margin: "12px 0",
            lineHeight: 0,
          }}
        >
          <QRCodeCanvas value={link} size={170} level="M" />
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 10.5,
            color: color.ink3,
            wordBreak: "break-all",
            padding: "8px 10px",
            background: "#fff",
            border: `1px solid ${color.line}`,
            borderRadius: 8,
            textAlign: "left",
          }}
        >
          {link}
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 12, justifyContent: "center" }}>
          <button onClick={actions.copyLink} style={{ ...btn, fontSize: 12 }}>
            Copy link
          </button>
          <button onClick={actions.printPage} style={{ ...btn, fontSize: 12 }}>
            Print
          </button>
        </div>
      </div>
    </>
  );
}
