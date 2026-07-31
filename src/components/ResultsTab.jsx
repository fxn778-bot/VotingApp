import { color, bars } from "../theme";
import { card, badge, primaryBtn, StatTiles } from "../ui.jsx";
import { verdict } from "../utils";

const THR_LABEL = {
  majority: "Simple majority",
  two_thirds: "Two-thirds",
  three_quarters: "Three-quarters",
};

export default function ResultsTab({ state, stats, actions }) {
  const { cfg, tal } = state;

  return (
    <>
      <StatTiles
        tiles={[
          [stats.voted, "Ballots cast"],
          [stats.eligible, "Eligible"],
          [`${stats.turnout}%`, "Turnout"],
        ]}
      />

      {cfg.items.map((it) => {
        const tv = tal[it.id] || {};
        const total = it.options.reduce((x, o) => x + (tv[o] || 0), 0);
        const ranked = it.options.map((o) => ({ o, c: tv[o] || 0 })).sort((a, b) => b.c - a.c);
        const winners =
          it.type === "election" && total > 0
            ? ranked.slice(0, it.seats).filter((x) => x.c > 0).map((x) => x.o)
            : [];

        let verdictNode = null;
        if (it.type === "motion") {
          const r = verdict(it, tv);
          if (r) {
            verdictNode = (
              <div
                style={{
                  padding: "10px 13px",
                  borderRadius: 9,
                  fontSize: 12,
                  marginTop: 8,
                  lineHeight: 1.6,
                  background: r.pass ? color.greenSoft : color.redSoft,
                  color: r.pass ? color.green : color.red,
                }}
              >
                {r.pass ? "CARRIED" : "NOT CARRIED"} · {THR_LABEL[it.thr || "majority"]} of {r.den}{" "}
                (abstentions {it.abs ? "counted" : "excluded"}) · {r.req} needed, {r.f} in favour
              </div>
            );
          }
        } else if (winners.length) {
          verdictNode = (
            <div
              style={{
                padding: "10px 13px",
                borderRadius: 9,
                fontSize: 12,
                marginTop: 8,
                lineHeight: 1.6,
                background: color.greenSoft,
                color: color.green,
              }}
            >
              ELECTED: {winners.join(", ")}
            </div>
          );
        }

        return (
          <div key={it.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 13 }}>
              <div>
                {it.type === "election" ? (
                  <span style={badge(color.blueChipSoft, color.blueChip)}>Election</span>
                ) : (
                  <span style={badge(color.purpleChipSoft, color.purpleChip)}>Motion</span>
                )}
                <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 7 }}>{it.title}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{total}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: color.ink3,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    marginTop: 2,
                  }}
                >
                  votes
                </div>
              </div>
            </div>

            {it.options.map((o, i) => {
              const c = tv[o] || 0;
              const pct = total ? Math.round((c / total) * 100) : 0;
              const won = winners.includes(o);
              return (
                <div key={o} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: won ? 600 : 400 }}>
                      {won ? "▲ " : ""}
                      {o}
                    </span>
                    <span style={{ color: color.ink2 }}>
                      {c} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 16,
                      background: color.soft,
                      borderRadius: 5,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 5,
                        transition: "width .4s",
                        width: `${pct}%`,
                        background: bars[i % bars.length],
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}

            {total === 0 && (
              <div style={{ textAlign: "center", padding: "6px 0", fontSize: 12, color: color.ink3 }}>
                No votes yet
              </div>
            )}
            {verdictNode}
          </div>
        );
      })}

      <button onClick={actions.exportResults} style={primaryBtn}>
        {state.exportMsg}
      </button>
    </>
  );
}
