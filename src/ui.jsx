// Shared inline-style fragments transcribed from the design prototype.
import { color, serif } from "./theme";

export const card = {
  background: color.surface,
  border: `1px solid ${color.line}`,
  borderRadius: 16,
  padding: "18px 20px",
  marginBottom: 14,
};

export const cardTitle = { fontSize: 13.5, fontWeight: 600, marginBottom: 14 };

export const fieldLabel = {
  fontSize: 10.5,
  color: color.ink3,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  display: "block",
  marginBottom: 5,
};

export const itemLabel = { ...fieldLabel, fontSize: 10, marginBottom: 4 };

export const input = {
  fontFamily: "inherit",
  fontSize: 13,
  padding: "9px 12px",
  border: "1px solid rgba(33,31,26,.15)",
  borderRadius: 10,
  background: "#fff",
  color: color.ink,
  width: "100%",
  outline: "none",
};

export const itemInput = {
  fontFamily: "inherit",
  fontSize: 12.5,
  padding: "8px 10px",
  border: "1px solid rgba(33,31,26,.14)",
  borderRadius: 8,
  background: "#fff",
  width: "100%",
  outline: "none",
};

export const select = {
  fontFamily: "inherit",
  fontSize: 12.5,
  padding: "7px 9px",
  border: "1px solid rgba(33,31,26,.14)",
  borderRadius: 8,
  background: "#fff",
};

export const btn = {
  fontSize: 12.5,
  padding: "8px 14px",
  border: "1px solid rgba(33,31,26,.16)",
  borderRadius: 9,
  background: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  color: color.ink,
};

export const smallBtn = {
  ...btn,
  fontSize: 11,
  padding: "6px 10px",
  borderRadius: 7,
};

export const primaryBtn = {
  width: "100%",
  padding: 14,
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 11,
  background: color.navy,
  color: "#fff",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

export const badge = (bg, fg) => ({
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 7,
  background: bg,
  color: fg,
});

export const statusBadge = (bg, fg) => ({
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 7,
  background: bg,
  color: fg,
});

export const phaseBadge = (bg, fg) => ({
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 11px",
  borderRadius: 8,
  background: bg,
  color: fg,
});

export const alert = (bg, fg) => ({
  padding: "10px 13px",
  borderRadius: 9,
  fontSize: 12,
  background: bg,
  color: fg,
});

export const statRow = { display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" };

export const statTile = {
  background: "#fff",
  border: `1px solid ${color.line}`,
  borderRadius: 12,
  padding: 14,
  flex: 1,
  minWidth: 100,
  textAlign: "center",
};

export const statNum = { fontSize: 25, fontWeight: 600 };

export const statLabel = {
  fontSize: 10,
  color: color.ink3,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  marginTop: 3,
};

export const serifHeading = { fontFamily: serif };

export function StatTiles({ tiles }) {
  return (
    <div style={statRow}>
      {tiles.map(([num, label]) => (
        <div key={label} style={statTile}>
          <div style={statNum}>{num}</div>
          <div style={statLabel}>{label}</div>
        </div>
      ))}
    </div>
  );
}
