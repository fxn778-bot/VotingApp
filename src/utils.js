const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newToken() {
  let t = "";
  for (let i = 0; i < 6; i++) t += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return t.slice(0, 3) + "-" + t.slice(3);
}

// Tokens are compared with punctuation and case stripped, so a member typing
// "kcip 1", "KCIP-0001" or "KCIP0001" all reach the same row. Mirrors
// norm_token() in the database — keep the two in step.
export function normTok(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// A membership number looks like KCIP-0001: a letter-led prefix, then digits,
// with no spaces. Used to tell "KCIP-0001, Jane Doe" apart from "Jane Doe,
// jane@example.com" on an import line, since both are two comma-separated
// fields and guessing wrong would put a name in the number column.
const MEMBER_NO_RE = /^[A-Za-z][A-Za-z0-9]*[-/ ]?\d+[A-Za-z0-9-]*$/;

export function looksLikeMemberNo(field) {
  const f = String(field || "").trim();
  if (!f || f.includes("@")) return false;
  // A name has spaces between words; a membership number does not (beyond an
  // optional single separator before the digits).
  if (/\s{1,}\S+\s+/.test(f)) return false;
  return MEMBER_NO_RE.test(f) && /\d/.test(f);
}

// Parse one import line into { memberNo, name, email }.
// Accepts, and auto-detects between:
//   KCIP-0001, Stanley Muithuri Maina
//   KCIP-0001, Stanley Muithuri Maina, stanley@example.com
//   Jane Wanjiru
//   Peter Otieno, peter@example.com
export function parseImportLine(line) {
  const parts = String(line || "").split(",").map((x) => x.trim());
  if (!parts.length || !parts[0]) return null;

  if (parts.length >= 2 && looksLikeMemberNo(parts[0])) {
    const name = parts[1];
    if (!name) return null;
    return { memberNo: parts[0], name, email: parts[2] || "" };
  }

  const name = parts[0];
  if (!name) return null;
  const second = parts[1] || "";
  return { memberNo: null, name, email: second.includes("@") ? second : "" };
}

export function uid() {
  return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function joinLink(orgName) {
  const slug = (orgName || "org").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "org";
  return `https://vote.${slug}.org/m/AGM2026`;
}

// Motion pass/fail: denominator excludes or includes abstentions per item config.
export function verdict(item, tallyForItem) {
  const f = tallyForItem["For"] || 0;
  const a = tallyForItem["Against"] || 0;
  const ab = tallyForItem["Abstain"] || 0;
  const den = item.abs ? f + a + ab : f + a;
  if (!den) return null;
  const frac = { majority: 0.5, two_thirds: 2 / 3, three_quarters: 0.75 }[item.thr || "majority"];
  const req = item.thr === "majority" || !item.thr ? Math.floor(den * 0.5) + 1 : Math.ceil(den * frac);
  return { den, req, pass: f >= req, f };
}

export function copyText(text, note) {
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(text)
      .then(() => alert(note))
      .catch(() => alert("Copy failed"));
  } else {
    alert("Clipboard unavailable");
  }
}
