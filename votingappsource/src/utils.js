const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newToken() {
  let t = "";
  for (let i = 0; i < 6; i++) t += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return t.slice(0, 3) + "-" + t.slice(3);
}

export function normTok(raw) {
  const s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 6 ? s.slice(0, 3) + "-" + s.slice(3) : s;
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
