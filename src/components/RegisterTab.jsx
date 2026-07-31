import { color, mono } from "../theme";
import { card, cardTitle, btn, smallBtn, statusBadge, StatTiles } from "../ui.jsx";

const th = (width) => ({
  textAlign: "left",
  fontSize: 10,
  textTransform: "uppercase",
  color: color.ink3,
  fontWeight: 400,
  padding: "6px 4px",
  borderBottom: `1px solid ${color.line}`,
  width,
});

const td = {
  padding: "7px 4px",
  borderBottom: "1px solid rgba(33,31,26,.08)",
};

export default function RegisterTab({ state, stats, actions }) {
  // Membership numbers are the natural order for check-in: officers work down
  // a numbered list, not an alphabetical one.
  const rows = Object.entries(state.reg).sort(([, a], [, b]) => {
    if (a.memberNo && b.memberNo) {
      return a.memberNo.localeCompare(b.memberNo, undefined, { numeric: true });
    }
    if (a.memberNo) return -1;
    if (b.memberNo) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <StatTiles
        tiles={[
          [stats.total, "On register"],
          [stats.eligible, "Eligible"],
          [stats.voted, "Voted"],
        ]}
      />

      <div style={card}>
        <div style={{ ...cardTitle, marginBottom: 9 }}>Import members</div>
        <div style={{ fontSize: 12, color: color.ink2, marginBottom: 9, lineHeight: 1.6 }}>
          One member per line. Paste your membership list as{" "}
          <span style={{ fontFamily: mono }}>Number, Name</span>. Each member keeps their membership
          number and is issued a single-use voting token — they need both to vote. Lines without a
          number (<span style={{ fontFamily: mono }}>Name</span> or{" "}
          <span style={{ fontFamily: mono }}>Name, email</span>) also work.
        </div>
        <textarea
          rows={4}
          className="focus-navy"
          placeholder={"KCIP-0001, Stanley Muithuri Maina\nKCIP-0002, Stella Mwangi"}
          value={state.importText}
          onChange={(e) => actions.setImportText(e.target.value)}
          style={{
            fontFamily: mono,
            fontSize: 12.5,
            lineHeight: 1.6,
            padding: "9px 11px",
            border: "1px solid rgba(33,31,26,.14)",
            borderRadius: 9,
            width: "100%",
            outline: "none",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: 9, marginTop: 9, flexWrap: "wrap" }}>
          <button onClick={actions.doImport} style={btn}>
            Import &amp; generate tokens
          </button>
          <button onClick={actions.clearRegister} style={btn}>
            Clear register
          </button>
        </div>
        {state.importMsg && (
          <div
            style={{
              marginTop: 10,
              padding: "9px 12px",
              borderRadius: 9,
              fontSize: 12,
              background: color.greenSoft,
              color: color.green,
            }}
          >
            {state.importMsg}
          </div>
        )}
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Members register</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={actions.toggleShowTok} style={smallBtn}>
              {state.showTok ? "Hide tokens" : "Show tokens"}
            </button>
            <button onClick={actions.exportTokens} style={smallBtn}>
              Export slips
            </button>
          </div>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={th("22%")}>Number</th>
                <th style={th("30%")}>Name</th>
                <th style={th("18%")}>Token</th>
                <th style={th("16%")}>Status</th>
                <th style={{ borderBottom: `1px solid ${color.line}`, width: "14%" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([tok, m]) => (
                <tr key={tok}>
                  <td style={{ ...td, fontFamily: mono, letterSpacing: ".03em" }}>
                    {m.memberNo || "—"}
                  </td>
                  <td
                    style={{
                      ...td,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </td>
                  <td style={{ ...td, fontFamily: mono, letterSpacing: ".03em" }}>
                    {state.showTok ? tok : "•••-•••"}
                  </td>
                  <td style={td}>
                    {m.voted ? (
                      <span style={statusBadge(color.greenSoft, color.green)}>Voted</span>
                    ) : m.eligible ? (
                      <span style={statusBadge("#EFEAE0", color.ink2)}>Not voted</span>
                    ) : (
                      <span style={statusBadge(color.redSoft, color.red)}>Suspended</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      onClick={() => actions.toggleEligible(tok)}
                      style={{ ...smallBtn, fontSize: 10.5, padding: "3px 8px", borderRadius: 6 }}
                    >
                      {m.eligible ? "Suspend" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          padding: "11px 14px",
          borderRadius: 10,
          fontSize: 12.5,
          background: color.amberSoft,
          color: color.amber,
          lineHeight: 1.55,
        }}
      >
        Voting needs both the membership number and the token. The number is not a secret, so the
        token is what actually protects the ballot — keep it hidden while this screen is projected,
        and hand slips out privately at check-in, where eligibility is already being established.
      </div>
    </>
  );
}
