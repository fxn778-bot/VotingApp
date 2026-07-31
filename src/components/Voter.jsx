import { color, serif, mono } from "../theme";
import { card, fieldLabel, primaryBtn, btn } from "../ui.jsx";

const centerCard = {
  ...card,
  padding: "44px 22px",
  textAlign: "center",
  marginBottom: 0,
};

const errBanner = {
  padding: "10px 13px",
  borderRadius: 9,
  fontSize: 12,
  background: color.redSoft,
  color: color.red,
};

export default function Voter({ state, actions }) {
  const { cfg, vstep, vtoken, vname, verr, vidx, vsel } = state;

  const curItem = cfg.items[vidx];
  const multi = curItem && curItem.type === "election" && curItem.seats > 1;
  const cur = (curItem && vsel[curItem.id]) || [];
  const last = vidx >= cfg.items.length - 1;
  const cannotProceed = cur.length === 0;

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
          <div style={{ fontSize: 15.5, fontWeight: 600, fontFamily: serif }}>{cfg.mtg}</div>
        </div>
        <button
          onClick={actions.goLand}
          style={{ ...btn, fontSize: 12, padding: "7px 12px", borderRadius: 8 }}
        >
          ←
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 18px 60px" }}>
        {vstep === "entry" && (
          <div style={{ ...card, padding: "22px 22px 24px", marginBottom: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, fontFamily: serif }}>
              Member verification
            </div>
            <div style={{ fontSize: 12.5, color: color.ink2, marginBottom: 16, lineHeight: 1.6 }}>
              Enter the voting token issued to you at check-in. Each token may be used once.
            </div>
            {verr && <div style={{ ...errBanner, marginBottom: 12 }}>{verr}</div>}
            <label style={{ ...fieldLabel, marginBottom: 6 }}>Voting token</label>
            <input
              type="text"
              className="focus-navy"
              value={vtoken}
              placeholder="ABC-123"
              autoComplete="off"
              onChange={(e) => actions.setVtoken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") actions.doVerify();
              }}
              style={{
                fontFamily: mono,
                fontSize: 20,
                letterSpacing: ".16em",
                textAlign: "center",
                padding: 14,
                border: "1px solid rgba(33,31,26,.16)",
                borderRadius: 11,
                width: "100%",
                outline: "none",
                marginBottom: 16,
              }}
            />
            <button onClick={actions.doVerify} style={primaryBtn}>
              Verify &amp; open ballot
            </button>
          </div>
        )}

        {vstep === "wait" && (
          <div style={centerCard}>
            <div style={{ fontSize: 30, marginBottom: 12 }}>⌛</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, fontFamily: serif }}>
              Voting not yet open
            </div>
            <div style={{ fontSize: 12.5, color: color.ink2, lineHeight: 1.7 }}>
              Verified as {vname}.
              <br />
              Waiting for the chair to open voting.
            </div>
          </div>
        )}

        {vstep === "closed" && (
          <div style={centerCard}>
            <div style={{ fontSize: 30, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, fontFamily: serif }}>
              Voting has closed
            </div>
            <div style={{ fontSize: 12.5, color: color.ink2 }}>Please see the meeting chair.</div>
          </div>
        )}

        {vstep === "done" && (
          <div style={centerCard}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: color.greenSoft,
                color: color.green,
                fontSize: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, fontFamily: serif }}>
              Ballot submitted
            </div>
            <div style={{ fontSize: 12.5, color: color.ink2, lineHeight: 1.7 }}>
              Thank you, {vname}.
              <br />
              Your token is now used and cannot vote again.
              <br />
              <br />
              Your choices are not linked to your name.
            </div>
          </div>
        )}

        {vstep === "ballot" && curItem && (
          <div style={{ ...card, padding: "20px 20px 22px", marginBottom: 0 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {cfg.items.map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 4,
                    flex: 1,
                    borderRadius: 3,
                    background:
                      i < vidx ? "#639922" : i === vidx ? color.greenAccent : "rgba(33,31,26,.12)",
                  }}
                ></div>
              ))}
            </div>
            <div
              style={{
                fontSize: 10,
                color: color.ink3,
                textTransform: "uppercase",
                letterSpacing: ".04em",
                marginBottom: 7,
              }}
            >
              Item {vidx + 1} of {cfg.items.length}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 5, fontFamily: serif }}>
              {curItem.title}
            </div>
            <div style={{ fontSize: 12.5, color: color.ink2, marginBottom: 15 }}>
              {multi
                ? `Select up to ${curItem.seats} — ${cur.length} selected`
                : curItem.type === "election"
                  ? "Select one candidate"
                  : "Cast your vote on this motion"}
            </div>

            {curItem.options.map((o) => {
              const on = cur.includes(o);
              return (
                <button
                  key={o}
                  onClick={() => actions.pick(curItem.id, o, multi, curItem.seats)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "13px 15px",
                    borderRadius: 10,
                    fontSize: 13.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    marginBottom: 7,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    border: on ? `1px solid ${color.greenAccent}` : "1px solid rgba(33,31,26,.14)",
                    background: on ? color.greenAccentSoft : "#fff",
                    color: on ? color.greenAccentInk : color.ink,
                  }}
                >
                  <span
                    style={{
                      width: 19,
                      height: 19,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: on
                        ? `1.5px solid ${color.greenAccent}`
                        : "1.5px solid rgba(33,31,26,.28)",
                      background: on ? color.greenAccent : "transparent",
                      borderRadius: multi ? 4 : "50%",
                    }}
                  >
                    {on && (
                      <span
                        style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }}
                      ></span>
                    )}
                  </span>
                  {o}
                </button>
              );
            })}

            {verr && <div style={{ ...errBanner, marginTop: 8 }}>{verr}</div>}

            <button
              onClick={actions.ballotNext}
              disabled={cannotProceed}
              style={{ ...primaryBtn, marginTop: 12, opacity: cannotProceed ? 0.4 : 1 }}
            >
              {last ? "Submit ballot" : "Next"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
