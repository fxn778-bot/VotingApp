import { color } from "../theme";
import {
  card,
  cardTitle,
  fieldLabel,
  itemLabel,
  input,
  itemInput,
  select,
  btn,
  badge,
  primaryBtn,
  alert,
} from "../ui.jsx";

export default function BallotTab({ state, actions }) {
  const { cfg, phase } = state;
  const locked = phase !== "setup";

  return (
    <>
      {locked && (
        <div style={{ ...alert(color.amberSoft, color.amber), fontSize: 12.5, marginBottom: 14, padding: "11px 14px", borderRadius: 10, lineHeight: 1.55 }}>
          Voting is active. Close voting in the Session tab to edit the ballot.
        </div>
      )}

      <div style={card}>
        <div style={cardTitle}>Meeting</div>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Organization</label>
          <input
            type="text"
            className="focus-navy"
            value={cfg.org}
            disabled={locked}
            onChange={(e) => actions.setOrg(e.target.value)}
            style={input}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Meeting name</label>
          <input
            type="text"
            className="focus-navy"
            value={cfg.mtg}
            disabled={locked}
            onChange={(e) => actions.setMtg(e.target.value)}
            style={input}
          />
        </div>
        <div>
          <label style={fieldLabel}>Quorum (members required)</label>
          <input
            type="number"
            min="0"
            className="focus-navy"
            value={cfg.quorum}
            disabled={locked}
            onChange={(e) => actions.setQuorum(e.target.value)}
            style={{ ...input, width: 120 }}
          />
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>Ballot items</div>
        {cfg.items.map((it) => (
          <div
            key={it.id}
            style={{
              background: "#F9F7F1",
              border: "1px solid rgba(33,31,26,.09)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 11,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 11 }}>
              {it.type === "election" ? (
                <span style={badge(color.blueChipSoft, color.blueChip)}>Election</span>
              ) : (
                <span style={badge(color.purpleChipSoft, color.purpleChip)}>Motion</span>
              )}
              {!locked && (
                <button
                  onClick={() => actions.delItem(it.id)}
                  style={{
                    fontSize: 11,
                    background: "none",
                    border: "none",
                    color: color.ink3,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Remove
                </button>
              )}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={itemLabel}>Title</label>
              <input
                type="text"
                className="focus-navy"
                value={it.title}
                disabled={locked}
                onChange={(e) => actions.setItemField(it.id, "title", e.target.value)}
                style={itemInput}
              />
            </div>

            {it.type === "election" && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <label style={{ ...itemLabel, display: "inline", marginBottom: 0 }}>Seats</label>
                <input
                  type="number"
                  min="1"
                  value={it.seats}
                  disabled={locked}
                  onChange={(e) =>
                    actions.setItemField(it.id, "seats", Math.max(1, parseInt(e.target.value) || 1))
                  }
                  style={{ ...itemInput, width: 60, padding: "6px 9px" }}
                />
              </div>
            )}

            {it.type === "motion" && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
                <div>
                  <label style={itemLabel}>Threshold</label>
                  <select
                    value={it.thr}
                    disabled={locked}
                    onChange={(e) => actions.setItemField(it.id, "thr", e.target.value)}
                    style={select}
                  >
                    <option value="majority">Simple majority</option>
                    <option value="two_thirds">Two-thirds</option>
                    <option value="three_quarters">Three-quarters</option>
                  </select>
                </div>
                <div>
                  <label style={itemLabel}>Abstentions</label>
                  <select
                    value={it.abs ? "1" : "0"}
                    disabled={locked}
                    onChange={(e) => actions.setItemField(it.id, "abs", e.target.value === "1")}
                    style={select}
                  >
                    <option value="0">Excluded from denominator</option>
                    <option value="1">Counted in denominator</option>
                  </select>
                </div>
              </div>
            )}

            <label style={{ ...itemLabel, marginBottom: 5 }}>
              {it.type === "election" ? "Candidates" : "Options"}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {it.options.map((o) => (
                <span
                  key={o}
                  style={{
                    fontSize: 11.5,
                    background: "#fff",
                    border: "1px solid rgba(33,31,26,.14)",
                    padding: "4px 9px",
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {o}
                  {!locked && (
                    <button
                      onClick={() => actions.delOpt(it.id, o)}
                      style={{
                        background: "none",
                        border: "none",
                        color: color.ink3,
                        fontSize: 10,
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>

            {!locked && it.type === "election" && (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Add candidate…"
                  value={state.newCandidates[it.id] || ""}
                  onChange={(e) => actions.setNewCandidate(it.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") actions.addOpt(it.id);
                  }}
                  style={{ ...itemInput, flex: 1, width: "auto", fontSize: 12, padding: "7px 10px" }}
                />
                <button onClick={() => actions.addOpt(it.id)} style={{ ...btn, fontSize: 12, padding: "7px 13px", borderRadius: 8 }}>
                  Add
                </button>
              </div>
            )}
          </div>
        ))}

        {!locked && (
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 6 }}>
            <button onClick={() => actions.addItem("election")} style={btn}>
              + Election
            </button>
            <button onClick={() => actions.addItem("motion")} style={btn}>
              + Motion / bylaw
            </button>
          </div>
        )}
      </div>

      {!locked && (
        <button onClick={actions.saveConfig} style={primaryBtn}>
          {state.saveMsg}
        </button>
      )}
    </>
  );
}
