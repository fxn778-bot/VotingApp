// Translation between the database's documented shapes and the app's shapes.
//
// The schema documents ballot items as { id, type, title, seats, options,
// threshold, abstain_counts }. The UI has always used the shorter { thr, abs }.
// Keeping the database in its documented form matters because the SQL comments,
// the verification queries and any future tooling all assume that shape — so we
// translate at the boundary rather than letting UI shorthand leak into storage.

export function itemFromDb(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    seats: row.seats ?? 1,
    thr: row.threshold ?? "majority",
    abs: row.abstain_counts ?? false,
    options: row.options ?? [],
  };
}

export function itemToDb(item) {
  const out = {
    id: item.id,
    type: item.type,
    title: item.title,
    seats: item.seats ?? 1,
    options: item.options ?? [],
  };
  // Threshold and abstention handling are meaningful only for motions.
  if (item.type === "motion") {
    out.threshold = item.thr ?? "majority";
    out.abstain_counts = !!item.abs;
  }
  return out;
}

export function configFromDb(row) {
  return {
    org: row.org_name,
    mtg: row.meeting_name,
    quorum: row.quorum ?? 0,
    items: (row.items ?? []).map(itemFromDb),
  };
}

export function configToDb(cfg) {
  return {
    org_name: cfg.org,
    meeting_name: cfg.mtg,
    quorum: cfg.quorum ?? 0,
    items: (cfg.items ?? []).map(itemToDb),
  };
}

// The register is keyed by token in the UI. The database also carries the row
// id, which admin actions (suspend/restore) need, so it is preserved here.
export function memberFromDb(row) {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email ?? "",
    eligible: row.eligible,
    voted: row.has_voted,
  };
}

export function registerFromDb(rows) {
  const reg = {};
  for (const r of rows) reg[r.token] = memberFromDb(r);
  return reg;
}

// tally rows -> { itemId: { choice: count } }
export function tallyFromDb(rows) {
  const out = {};
  for (const r of rows) {
    if (!out[r.item_id]) out[r.item_id] = {};
    out[r.item_id][r.choice] = r.votes;
  }
  return out;
}

// Database error codes -> what a voter should actually read on screen.
export const VOTER_ERRORS = {
  token_not_found: "Token not recognised. Check your slip, or see the registration desk.",
  not_eligible:
    "This membership is not eligible to vote at this meeting. Please see the registration desk.",
  token_already_used: "This token has already been used to cast a ballot.",
  voting_not_open: "Voting is not open.",
};

export function voterError(code) {
  return VOTER_ERRORS[code] || "Something went wrong. Please see the registration desk.";
}
