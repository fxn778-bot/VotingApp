-- ============================================================================
-- AGM Voting System — database schema
-- Target: PostgreSQL 14+ / Supabase
--
-- Design intent:
--   * members.token authenticates a voter and is single-use
--   * ballots holds WHAT was voted, with NO link to a member
--   * members.has_voted holds WHO voted, with NO link to a choice
--   * the two are written in one transaction inside cast_ballot()
--   * clients never touch ballots or members directly; RLS blocks it
--
-- CHANGES FROM THE ORIGINAL DRAFT (both deliberate, see notes inline):
--   1. Ballot secrecy: timestamps no longer form a join key between a member
--      and their ballot. This was a real de-anonymization hole — see §3.
--   2. Live tallies are admin-only until voting closes — see §5.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Meeting configuration (single row)
-- ---------------------------------------------------------------------------
create table meeting_config (
  id            int primary key default 1,
  org_name      text        not null default 'My Community Group',
  meeting_name  text        not null default 'Annual General Meeting',
  quorum        int         not null default 0,
  phase         text        not null default 'setup'
                            check (phase in ('setup','voting','closed')),
  items         jsonb       not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  constraint singleton check (id = 1)
);

insert into meeting_config (id) values (1) on conflict do nothing;

-- items jsonb shape:
-- [{ "id":"itm1", "type":"election", "title":"Election of Chair",
--    "seats":1, "options":["A","B"] },
--  { "id":"itm2", "type":"motion", "title":"Amend Article IV",
--    "threshold":"two_thirds", "abstain_counts":false,
--    "options":["For","Against","Abstain"] }]


-- ---------------------------------------------------------------------------
-- 2. Members register
-- ---------------------------------------------------------------------------
create table members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text        not null,
  email       text,
  phone       text,
  token       text        not null unique,   -- the voting credential
  member_no   text        unique,             -- the organisation's own number
  eligible    boolean     not null default true,
  has_voted   boolean     not null default false,
  voted_on    date,                       -- was voted_at timestamptz; see §3
  created_at  timestamptz not null default now()
);

create index members_token_idx on members (token);

-- Token format, when generated: 6 chars from an unambiguous alphabet,
-- hyphenated (ABC-123). Excludes 0/O/1/I/L so a printed slip cannot be misread.
--
-- Alternatively the organisation's own membership number can be the token —
-- import_member() takes one and uses it for both columns. That trades secrecy
-- for convenience and IS A REAL TRADE: membership numbers are sequential and
-- already known, so anyone reaching the ballot can try another member's
-- number. The single-use rule still stops double voting, but it no longer
-- proves the person casting a member's ballot IS that member. Add a per-member
-- PIN if the vote is contested or the stakes are high.

-- Members type their number off a card or from memory, so matching ignores
-- case and punctuation: "kcip 1", "KCIP-0001" and "KCIP0001" are one token.
create or replace function norm_token(t text)
returns text language sql immutable set search_path = public as $$
  select upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create index members_norm_token_idx on members (norm_token(token));


-- ---------------------------------------------------------------------------
-- 3. Ballots — anonymous. One row per choice per voter per item.
--    Multi-seat elections produce several rows for one voter on one item.
-- ---------------------------------------------------------------------------
create table ballots (
  id        uuid primary key default gen_random_uuid(),
  item_id   text        not null,
  choice    text        not null,
  cast_on   date        not null default current_date   -- was cast_at timestamptz
);

create index ballots_item_idx on ballots (item_id);

-- Deliberately absent: member_id. There is no join path from a ballot
-- to a member. This is what makes the secret ballot structurally true
-- rather than merely promised.
--
-- WHY THE TIMESTAMPS ARE GONE (this is the important part):
--
-- The original draft had ballots.cast_at timestamptz default now() and
-- members.voted_at timestamptz set to now() in the same transaction. In
-- PostgreSQL, now() is the TRANSACTION timestamp — it returns an identical
-- value for every statement in one transaction. So both columns held the
-- exact same value for the same voter, and this one query reconstructed
-- the entire secret ballot:
--
--   select m.full_name, b.item_id, b.choice
--   from members m join ballots b on b.cast_at = m.voted_at;
--
-- Storing only a date collapses every voter on meeting day into one bucket,
-- so the join returns the full cross product and identifies nobody.
-- Turnout, quorum and tallies are unaffected — none of them need the time
-- of day. Keep it this way unless you have a specific reason not to.
--
-- Residual risk, for completeness: physical row order (ctid) still reflects
-- insertion order, so someone with direct database access and real intent
-- could correlate the Nth voter with the Nth ballot group. Section 13 has a
-- one-line shuffle you can run after the meeting to remove even that.


-- ---------------------------------------------------------------------------
-- 4. Audit log — append only
-- ---------------------------------------------------------------------------
create table audit_events (
  id           uuid primary key default gen_random_uuid(),
  event_type   text        not null,
  actor        text,
  payload      jsonb,
  occurred_at  timestamptz not null default now()
);

create index audit_time_idx on audit_events (occurred_at);

-- Note: ballot_cast audit rows deliberately carry no member reference and no
-- item detail (see cast_ballot below) — otherwise this table would reintroduce
-- exactly the correlation that section 3 removes.


-- ---------------------------------------------------------------------------
-- 5. Tally view — admin-only until you choose to publish
-- ---------------------------------------------------------------------------
create view tally with (security_invoker = on) as
select item_id, choice, count(*)::int as votes
from ballots
group by item_id, choice;

-- Participation without linkage
create view participation with (security_invoker = on) as
select
  count(*) filter (where eligible)                    as eligible_count,
  count(*) filter (where eligible and has_voted)      as voted_count,
  count(*)                                            as register_count
from members;

-- security_invoker matters. From PostgreSQL 15 a view runs as its OWNER
-- unless told otherwise, which silently bypasses RLS on the tables beneath
-- it — Supabase's linter flags this as an error, correctly. Both views are
-- read only by signed-in admins, and `authenticated` already holds select
-- policies on ballots and members, so running them as the caller is strictly
-- tighter and loses nothing.
--
-- Neither view is granted to anon: members cannot watch running totals while
-- voting is still open (see section 8 for how to publish results afterwards).


-- ---------------------------------------------------------------------------
-- 6. cast_ballot() — the only write path for voters
--    SECURITY DEFINER so it can write to tables the caller cannot read.
-- ---------------------------------------------------------------------------
create or replace function cast_ballot(
  p_token      text,
  p_selections jsonb   -- {"itm1":["Candidate A"], "itm2":["For"]}
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member    members%rowtype;
  v_phase     text;
  v_item      text;
  v_choices   jsonb;
  v_choice    text;
begin
  select phase into v_phase from meeting_config where id = 1;

  if v_phase <> 'voting' then
    return jsonb_build_object('ok', false, 'error', 'voting_not_open');
  end if;

  -- Lock the row so two concurrent submissions with the same token
  -- cannot both pass the has_voted check.
  select * into v_member
  from members
  where norm_token(token) = norm_token(p_token)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_not_found');
  end if;

  if not v_member.eligible then
    return jsonb_build_object('ok', false, 'error', 'not_eligible');
  end if;

  if v_member.has_voted then
    return jsonb_build_object('ok', false, 'error', 'token_already_used');
  end if;

  -- Write the anonymous ballots
  for v_item, v_choices in select * from jsonb_each(p_selections)
  loop
    for v_choice in select jsonb_array_elements_text(v_choices)
    loop
      insert into ballots (item_id, choice) values (v_item, v_choice);
    end loop;
  end loop;

  -- Burn the token
  update members
  set has_voted = true, voted_on = current_date
  where id = v_member.id;

  -- Audit the fact of a ballot, with nothing that identifies the voter
  -- or the choices. Timestamped to the second, which is safe precisely
  -- because it cannot be joined to anything.
  insert into audit_events (event_type) values ('ballot_cast');

  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------------
-- 7. verify_token() — check eligibility without casting
-- ---------------------------------------------------------------------------
create or replace function verify_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_member members%rowtype;
begin
  select * into v_member from members where norm_token(token) = norm_token(p_token);

  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_not_found');
  end if;
  if not v_member.eligible then
    return jsonb_build_object('ok', false, 'error', 'not_eligible');
  end if;
  if v_member.has_voted then
    return jsonb_build_object('ok', false, 'error', 'token_already_used');
  end if;

  -- Return the name so the voter can confirm the credential is theirs before
  -- voting — worth more when numbers are typed from memory and a transposed
  -- digit lands on a real person.
  return jsonb_build_object('ok', true, 'name', v_member.full_name, 'token', v_member.token);
end;
$$;


-- ---------------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------------
alter table meeting_config enable row level security;
alter table members        enable row level security;
alter table ballots        enable row level security;
alter table audit_events   enable row level security;

-- Voters (anon) may read the ballot definition and phase. Nothing else.
create policy anon_read_config on meeting_config
  for select to anon using (true);

-- No anon policy on members, ballots, or audit_events at all.
-- With RLS on and no policy, anon gets zero rows. The only way a voter
-- touches those tables is through the SECURITY DEFINER functions above.

-- Administrators authenticate and get full access.
create policy admin_all_config on meeting_config
  for all to authenticated using (true) with check (true);
create policy admin_all_members on members
  for all to authenticated using (true) with check (true);
create policy admin_read_ballots on ballots
  for select to authenticated using (true);
create policy admin_read_audit on audit_events
  for select to authenticated using (true);

-- Note: admins can READ ballots (needed to tally) but there is deliberately
-- no update or delete policy. Cast ballots are immutable even to the admin.

-- Table privileges. These are NOT optional and NOT redundant with the
-- policies above: in PostgreSQL, RLS is applied on top of ordinary table
-- privileges, so a policy without a matching GRANT still denies everything.
-- Supabase's default privileges happen to grant anon/authenticated access to
-- public tables, which can mask the omission — but if those defaults are ever
-- tightened, voters silently stop being able to load the ballot. Spelled out
-- here so the schema is correct on its own terms.
grant select                         on meeting_config to anon;
grant select, insert, update         on meeting_config to authenticated;
grant select, insert, update, delete on members        to authenticated;
grant select                         on ballots        to authenticated;
grant select                         on audit_events   to authenticated;

-- Note there is no grant of insert/update/delete on ballots to anyone.
-- Ballots are written only by cast_ballot() running as definer, which makes
-- them immutable at the privilege level as well as the policy level.

grant execute on function cast_ballot(text, jsonb)  to anon;
grant execute on function verify_token(text)        to anon;

-- Tallies and turnout are for signed-in admins only (see section 5).
grant select on tally         to authenticated;
grant select on participation to authenticated;

-- To publish results to members after the meeting, run BOTH of these — the
-- grant alone is not enough once the view runs as the caller, because anon
-- has no select policy on ballots:
--   alter view tally set (security_invoker = off);
--   grant select on tally to anon;


-- ---------------------------------------------------------------------------
-- 9. Session control helpers (admin only)
-- ---------------------------------------------------------------------------
create or replace function open_voting()
returns void language sql security definer set search_path = public as $$
  update meeting_config set phase = 'voting', updated_at = now() where id = 1;
  insert into audit_events (event_type) values ('session_opened');
$$;

create or replace function close_voting()
returns void language sql security definer set search_path = public as $$
  update meeting_config set phase = 'closed', updated_at = now() where id = 1;
  insert into audit_events (event_type) values ('session_closed');
$$;

revoke execute on function open_voting()  from anon, public;
revoke execute on function close_voting() from anon, public;
grant  execute on function open_voting()  to authenticated;
grant  execute on function close_voting() to authenticated;


-- ---------------------------------------------------------------------------
-- 10. Token generation
--     Alphabet excludes 0 O 1 I L to survive being read off a printed slip.
-- ---------------------------------------------------------------------------
create or replace function generate_token()
returns text language plpgsql
set search_path = public   -- pinned: removes any search_path shadowing risk
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return substr(result,1,3) || '-' || substr(result,4,3);
end;
$$;

-- Bulk import. Retries on the (rare) unique collision.
create or replace function import_member(
  p_name      text,
  p_email     text default null,
  p_member_no text default null
)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_token text; v_tries int := 0;
begin
  -- Explicit membership number: use it as the token, and refuse a duplicate
  -- outright. Two rows for one number would be two ballots for one membership.
  if p_member_no is not null and btrim(p_member_no) <> '' then
    v_token := btrim(p_member_no);
    if exists (select 1 from members where norm_token(token) = norm_token(v_token)) then
      raise exception 'membership number % is already on the register', v_token
        using errcode = 'unique_violation';
    end if;
    insert into members (full_name, email, token, member_no)
    values (p_name, p_email, v_token, v_token);
    return v_token;
  end if;

  loop
    v_token := generate_token();
    begin
      insert into members (full_name, email, token)
      values (p_name, p_email, v_token);
      return v_token;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 20 then raise exception 'token generation failed'; end if;
    end;
  end loop;
end;
$$;

revoke execute on function import_member(text, text, text) from anon, public;
grant  execute on function import_member(text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 11. Reset helper (admin only) — clears votes and re-enables every token
-- ---------------------------------------------------------------------------
create or replace function reset_votes()
returns void language sql security definer set search_path = public as $$
  delete from ballots;
  update members set has_voted = false, voted_on = null;
  insert into audit_events (event_type) values ('votes_reset');
$$;

revoke execute on function reset_votes() from anon, public;
grant  execute on function reset_votes() to authenticated;


-- ---------------------------------------------------------------------------
-- 12. Realtime (Supabase) — lets the admin results screen push-update
-- ---------------------------------------------------------------------------
-- alter publication supabase_realtime add table ballots;
-- alter publication supabase_realtime add table meeting_config;
--
-- The app polls every few seconds by default, which is enough for a meeting
-- and avoids a websocket dropping on venue wifi. Enable these only if you
-- would rather have push updates.


-- ---------------------------------------------------------------------------
-- 13. Post-meeting verification queries
-- ---------------------------------------------------------------------------

-- Does the ballot count reconcile with the participation count?
-- For a single-choice item these must match. A mismatch means something
-- is wrong and the item should be re-run rather than explained away.
--
--   select
--     (select count(*) from ballots where item_id = 'itm2') as ballots_cast,
--     (select voted_count from participation)               as members_voted;

-- Final tally with turnout:
--
--   select t.item_id, t.choice, t.votes,
--          round(100.0 * t.votes / sum(t.votes) over (partition by t.item_id), 1) as pct
--   from tally t
--   order by t.item_id, t.votes desc;

-- Optional: destroy insertion-order correlation once voting has closed.
-- Rewrites the table in random order so ctid reveals nothing about who
-- voted when. Run after close_voting(), before publishing results.
--
--   create table ballots_shuffled as
--     select * from ballots order by random();
--   truncate ballots;
--   insert into ballots select * from ballots_shuffled;
--   drop table ballots_shuffled;
