-- ============================================================================
-- Migration 003 — two-factor voting: membership number + issued token
--
-- Run after 002. Safe to run on a register that already has members.
--
-- WHY
-- Migration 002 made the membership number the credential outright, which is
-- convenient but not secret: numbers are sequential and already known, so
-- anyone reaching the ballot could vote as any member who had not yet voted.
-- This migration restores the guarantee by requiring BOTH:
--
--   membership number  — proves the person is on the register (they know it)
--   voting token       — proves the person is that member (issued privately)
--
-- Neither alone is enough. Guessing numbers is now useless without the token,
-- and a token found on a dropped slip is useless without knowing whose it is.
--
-- The old single-credential functions are DROPPED, not merely superseded.
-- Leaving cast_ballot(text, jsonb) in place and granted to anon would leave
-- the number-only path callable over the REST API and defeat the whole change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Every member needs a real token again
--    Rows imported under migration 002 have token = member_no. Those are not
--    secrets, so re-issue them. Rows that already have a generated token are
--    left alone.
-- ---------------------------------------------------------------------------
do $$
declare r record; t text; guard int;
begin
  for r in select id from members where member_no is not null
             and norm_token(token) = norm_token(member_no)
  loop
    guard := 0;
    loop
      t := generate_token();
      guard := guard + 1;
      exit when not exists (select 1 from members where norm_token(token) = norm_token(t));
      if guard > 40 then raise exception 'token generation failed'; end if;
    end loop;
    update members set token = t where id = r.id;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 2. import_member() — membership number from the list, token freshly minted
-- ---------------------------------------------------------------------------
create or replace function import_member(
  p_name      text,
  p_email     text default null,
  p_member_no text default null
)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_token text; v_no text; v_tries int := 0;
begin
  v_no := nullif(btrim(coalesce(p_member_no, '')), '');

  -- One row per membership number. Two rows would be two ballots for one
  -- membership, which no amount of downstream checking can undo.
  if v_no is not null and exists (
    select 1 from members where norm_token(member_no) = norm_token(v_no)
  ) then
    raise exception 'membership number % is already on the register', v_no
      using errcode = 'unique_violation';
  end if;

  loop
    v_token := generate_token();
    begin
      insert into members (full_name, email, token, member_no)
      values (p_name, p_email, v_token, v_no);
      return v_token;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 20 then raise exception 'token generation failed'; end if;
    end;
  end loop;
end $$;

revoke execute on function import_member(text, text, text) from anon, public;
grant  execute on function import_member(text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Drop the single-credential entry points
--    Do this BEFORE creating the two-argument versions so there is no window
--    in which the weaker path is callable.
-- ---------------------------------------------------------------------------
drop function if exists verify_token(text);
drop function if exists cast_ballot(text, jsonb);


-- ---------------------------------------------------------------------------
-- 4. verify_token(member_no, token)
--    Deliberately returns the SAME error for a wrong number, a wrong token and
--    a mismatched pair. Distinguishing them would confirm which half was right
--    and turn the pair back into two independently guessable secrets.
-- ---------------------------------------------------------------------------
create or replace function verify_token(p_member_no text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_member members%rowtype;
begin
  select * into v_member
  from members
  where norm_token(token) = norm_token(p_token)
    and (member_no is null or norm_token(member_no) = norm_token(p_member_no));

  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_not_found');
  end if;
  if not v_member.eligible then
    return jsonb_build_object('ok', false, 'error', 'not_eligible');
  end if;
  if v_member.has_voted then
    return jsonb_build_object('ok', false, 'error', 'token_already_used');
  end if;

  return jsonb_build_object(
    'ok', true,
    'name', v_member.full_name,
    'token', v_member.token,
    'member_no', v_member.member_no
  );
end $$;


-- ---------------------------------------------------------------------------
-- 5. cast_ballot(member_no, token, selections)
-- ---------------------------------------------------------------------------
create or replace function cast_ballot(
  p_member_no  text,
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

  -- Locked so two simultaneous submissions on one membership cannot both pass
  -- the has_voted check.
  select * into v_member
  from members
  where norm_token(token) = norm_token(p_token)
    and (member_no is null or norm_token(member_no) = norm_token(p_member_no))
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
end $$;

grant execute on function cast_ballot(text, text, jsonb) to anon, authenticated;
grant execute on function verify_token(text, text)       to anon, authenticated;
