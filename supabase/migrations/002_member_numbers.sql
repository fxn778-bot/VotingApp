-- ============================================================================
-- Migration 002 — authenticate voters by membership number
--
-- Run this in the Supabase SQL editor against a project that already has
-- migration 001 (the base schema). Safe to run on a register that already has
-- members: existing rows keep their generated tokens and simply get a null
-- member_no.
--
-- WHAT CHANGES
--   * members gains member_no (the organisation's own membership number).
--   * import_member() accepts an explicit member number and uses it as the
--     voting token.
--   * Token matching becomes punctuation- and case-insensitive, so a member
--     typing "kcip 1", "KCIP-0001" or "KCIP0001" all resolve to the same row.
--
-- SECURITY NOTE, recorded here because it is load-bearing:
-- Membership numbers are sequential and known to members, so the voting token
-- is no longer secret. Anyone who can reach the ballot can enumerate numbers
-- and cast a ballot as any member who has not yet voted. The single-use rule
-- still holds — nobody votes twice — but it no longer guarantees that the
-- person casting a member's ballot IS that member. Mitigate operationally:
-- open voting only while members are in the room, watch the ballots-cast
-- counter against heads present, and close voting promptly. To close it
-- properly, add a per-member PIN and require number + PIN.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Membership number
-- ---------------------------------------------------------------------------
alter table members add column if not exists member_no text;

-- Unique where present. A partial index lets pre-existing rows stay null.
create unique index if not exists members_member_no_key
  on members (member_no) where member_no is not null;


-- ---------------------------------------------------------------------------
-- 2. Token normalisation
--    Members will type their number off a card, a phone screen or memory.
--    "KCIP-0001", "kcip0001" and "KCIP 0001" must all be the same token,
--    without the hyphen becoming a source of failed logins on the day.
-- ---------------------------------------------------------------------------
create or replace function norm_token(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create index if not exists members_norm_token_idx on members (norm_token(token));


-- ---------------------------------------------------------------------------
-- 3. import_member() — accept an explicit membership number
--    Called once per line by the admin import. When p_member_no is supplied it
--    becomes both the membership number and the voting token; when it is not,
--    behaviour is unchanged and a random token is generated.
-- ---------------------------------------------------------------------------
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
  if p_member_no is not null and btrim(p_member_no) <> '' then
    v_token := btrim(p_member_no);
    -- Reject a duplicate outright rather than minting a second row: two
    -- members sharing a number would mean two ballots for one membership.
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
-- 4. verify_token() / cast_ballot() — match on the normalised token
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

  -- The name is returned so a member can confirm the number they typed is
  -- theirs before they vote — worth more now that numbers are typed from
  -- memory and a transposed digit lands on a real person.
  return jsonb_build_object('ok', true, 'name', v_member.full_name, 'token', v_member.token);
end;
$$;

create or replace function cast_ballot(
  p_token      text,
  p_selections jsonb
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

  for v_item, v_choices in select * from jsonb_each(p_selections)
  loop
    for v_choice in select jsonb_array_elements_text(v_choices)
    loop
      insert into ballots (item_id, choice) values (v_item, v_choice);
    end loop;
  end loop;

  update members
  set has_voted = true, voted_on = current_date
  where id = v_member.id;

  insert into audit_events (event_type) values ('ballot_cast');

  return jsonb_build_object('ok', true);
end;
$$;
