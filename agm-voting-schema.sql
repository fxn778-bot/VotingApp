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
  token       text        not null unique,
  eligible    boolean     not null default true,
  has_voted   boolean     not null default false,
  voted_at    timestamptz,
  created_at  timestamptz not null default now()
);

create index members_token_idx on members (token);

-- Token format: 6 chars from an unambiguous alphabet, hyphenated (ABC-123).
-- Excludes 0/O/1/I/L so a printed slip cannot be misread.


-- ---------------------------------------------------------------------------
-- 3. Ballots — anonymous. One row per choice per voter per item.
--    Multi-seat elections produce several rows for one voter on one item.
-- ---------------------------------------------------------------------------
create table ballots (
  id        uuid primary key default gen_random_uuid(),
  item_id   text        not null,
  choice    text        not null,
  cast_at   timestamptz not null default now()
);

create index ballots_item_idx on ballots (item_id);

-- Deliberately absent: member_id. There is no join path from a ballot
-- to a member. This is what makes the secret ballot structurally true
-- rather than merely promised.


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


-- ---------------------------------------------------------------------------
-- 5. Tally view — safe to expose publicly
-- ---------------------------------------------------------------------------
create view tally as
select item_id, choice, count(*)::int as votes
from ballots
group by item_id, choice;

-- Participation without linkage
create view participation as
select
  count(*) filter (where eligible)                    as eligible_count,
  count(*) filter (where eligible and has_voted)      as voted_count,
  count(*)                                            as register_count
from members;


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
  where token = upper(trim(p_token))
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
  set has_voted = true, voted_at = now()
  where id = v_member.id;

  insert into audit_events (event_type, payload)
  values ('ballot_cast', jsonb_build_object('items', jsonb_object_keys(p_selections)));

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
  select * into v_member from members where token = upper(trim(p_token));

  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_not_found');
  end if;
  if not v_member.eligible then
    return jsonb_build_object('ok', false, 'error', 'not_eligible');
  end if;
  if v_member.has_voted then
    return jsonb_build_object('ok', false, 'error', 'token_already_used');
  end if;

  -- Return the name only, so the voter can confirm the slip is theirs.
  return jsonb_build_object('ok', true, 'name', v_member.full_name);
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

grant execute on function cast_ballot(text, jsonb)  to anon;
grant execute on function verify_token(text)        to anon;
grant select on tally, participation                to anon;


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

revoke execute on function open_voting()  from anon;
revoke execute on function close_voting() from anon;


-- ---------------------------------------------------------------------------
-- 10. Token generation
--     Alphabet excludes 0 O 1 I L to survive being read off a printed slip.
-- ---------------------------------------------------------------------------
create or replace function generate_token()
returns text language plpgsql as $$
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
create or replace function import_member(p_name text, p_email text default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_token text; v_tries int := 0;
begin
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

revoke execute on function import_member(text, text) from anon;


-- ---------------------------------------------------------------------------
-- 11. Realtime (Supabase) — lets the admin results screen push-update
-- ---------------------------------------------------------------------------
-- alter publication supabase_realtime add table ballots;
-- alter publication supabase_realtime add table meeting_config;
--
-- Subscribe on the admin client to refresh tallies without polling.


-- ---------------------------------------------------------------------------
-- 12. Post-meeting verification queries
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
