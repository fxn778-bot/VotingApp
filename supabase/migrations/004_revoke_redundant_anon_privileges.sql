-- ============================================================================
-- Migration 004 — remove redundant anon privileges (defence in depth)
--
-- Supabase grants `anon` SELECT on new public tables by default. RLS still
-- blocked every row — verified on the live project with data present: anon saw
-- 0 members, 0 ballots and 0 tally rows — so this was never a leak.
--
-- But it left the secrecy of the register resting on ONE mechanism. A policy
-- edited carelessly, or RLS switched off on a table during debugging, and the
-- whole register becomes readable by anyone holding the public anon key, which
-- ships in every voter's browser. Revoking the redundant grant means two
-- independent things must be wrong before anything leaks.
--
-- Safe to run more than once.
-- ============================================================================

revoke select on members       from anon;
revoke select on ballots       from anon;
revoke select on audit_events  from anon;
revoke select on tally         from anon;
revoke select on participation from anon;

-- anon KEEPS meeting_config. Voters must read the ballot definition in order
-- to vote at all — do not revoke this one.

-- The voter path is unaffected: cast_ballot() and verify_token() are
-- SECURITY DEFINER, so they reach these tables on the voter's behalf without
-- the voter holding any privilege of their own. Verified after the revoke.

-- Drop the stale two-argument import_member from the original schema. It
-- predates membership numbers and would insert a member with no member_no,
-- so it must not remain callable beside the three-argument version.
drop function if exists import_member(text, text);
