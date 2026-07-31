# Running a real AGM

Two parts: set up the meeting server once, then follow the run sheet on the day.

Budget about 30 minutes for setup, and do it **at least a day before** the
meeting — not in the room. Do a full rehearsal (§5) before it matters.

> ## Status for the "AGM Voting App" project
>
> Already done:
>
> - **§1 Project** — created (`us-west-2`, PostgreSQL 17, healthy).
> - **§2 Tables** — schema applied and verified against the live database:
>   ballots refused before opening, three ballots cast, double-vote refused,
>   unknown token refused, closed session refused. Verification data deleted
>   afterwards; the register, ballots and audit log are empty and the phase is
>   back to `setup`.
> - **Security advisors** — the two ERROR-level findings are fixed. The
>   remaining warnings are intentional; see §11.
>
> Still yours to do: **§3** (create the admin account — it needs the dashboard),
> **§4** (put the URL and key in `.env.local`, then build), and **§5** (rehearse).
>
> **New:** run `migrations/002_member_numbers.sql` then
> `migrations/003_two_factor.sql` before importing the register — together they
> add membership numbers and two-factor voting. See §12.

---

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a project. The
   free tier is ample for an AGM.
2. Choose a region near where the meeting happens — it is the difference
   between a ballot that submits instantly and one that feels sluggish.
3. Save the database password somewhere you will still have on the day.

## 2. Create the tables

In the Supabase dashboard, open **SQL Editor → New query**, paste the entire
contents of [`schema.sql`](./schema.sql), and run it.

You should see `Success. No rows returned`. Confirm under **Table Editor**
that `meeting_config`, `members`, `ballots` and `audit_events` exist.

Run it once. Re-running on a database that already has data will fail on the
`create table` statements — which is deliberate, so you cannot wipe a live
register by accident.

## 3. Create the administrator account

**Authentication → Users → Add user**, with *Auto Confirm User* switched on so
no confirmation email is needed.

Use a real address and a strong password. Anyone with this login can open and
close voting, and can see the register. Create one account per officer who
needs it rather than sharing a single login — the audit log is more useful when
actions belong to people.

Only accounts you create here can administer the meeting. There is no sign-up
in the app.

## 4. Point the app at the project

Copy the URL and anon key from **Project Settings → API**, then in the project
root:

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

```bash
npm install
npm run build
```

> **These values are baked in at build time, not read when the app runs.**
> If you change `.env.local`, you must run `npm run build` again — otherwise
> the old settings stay live. A build made with no values is a demo-mode build
> and **cannot** talk to your project no matter how it is deployed.

**Confirm it worked before going further.** Serve the build (`npm run preview`)
and open it: the landing screen must say **"Live meeting"** in green. If it says
**"Demo mode"**, the values did not reach the build — check the file is named
`.env.local`, both variables are filled in, and you rebuilt.

The anon key is public by design; every voter's browser needs it. It is safe to
publish. What protects the ballot is the row-level security in `schema.sql`, not
secrecy of this key. **Never** put the `service_role` key in the app — it
bypasses RLS entirely.

## 5. Rehearse

Deploy the built `dist/` folder anywhere static (Netlify, Vercel, Cloudflare
Pages, GitHub Pages). Then, before the meeting:

1. Sign in as admin. Add two or three test members on the **Register** tab.
2. Build the real ballot on the **Ballot** tab and save it.
3. **Session → Open voting.** Vote from a phone on mobile data, not venue wifi —
   that is what your members will actually be on.
4. Check the vote appears under **Results**.
5. Try the same token twice. It must be refused.
6. **Session → Reset votes**, then clear the test members from the register.

Do not skip step 6. Starting an AGM with rehearsal votes in the tally is a
result you cannot defend.

---

## 6. Run sheet for the day

**Before members arrive**

- Sign in as admin; confirm the landing screen says *Live meeting*.
- **Ballot** tab: check every item, candidate and threshold. Save.
- **Register** tab: import the members. Each gets a single-use token.
- Print the token slips (**Export slips**) and put them in check-in order.
- Leave the phase on **Setup**. Do not open voting yet.

**At check-in**

- Hand each member their slip as they arrive. Check-in is what establishes
  eligibility — the token just carries it into the room.
- Keep the **Register** tab off the projector, or use **Hide tokens**.

**Opening the vote**

- Project **Session**. The QR code takes members to the ballot.
- **Open voting.** Anyone waiting on the verification screen moves to the ballot
  automatically within a few seconds.
- Watch *Ballots cast* climb against the quorum line.

**Closing**

- Give a clear verbal warning, then **Close voting**. Late submissions are
  refused from that moment.
- **Results** shows each item with its verdict. **Export results record** copies
  a plain-text record for the minutes, with teller signature lines.

**After**

- Reconcile before announcing anything (§7).
- Optionally publish results to members. Both statements are needed — the grant
  alone does nothing, because the view runs as the caller and anon has no read
  policy on `ballots`:

  ```sql
  alter view tally set (security_invoker = off);
  grant select on tally to anon;
  ```

  Until you run these, only signed-in admins can see totals.

---

## 7. Reconciliation

Run this in the SQL editor before announcing results. For a single-choice item
the two numbers must match exactly:

```sql
select
  (select count(*) from ballots where item_id = 'itm2') as ballots_cast,
  (select voted_count from participation)               as members_voted;
```

A mismatch means something went wrong. Re-run that item rather than explaining
the discrepancy away.

Full tally with percentages:

```sql
select t.item_id, t.choice, t.votes,
       round(100.0 * t.votes / sum(t.votes) over (partition by t.item_id), 1) as pct
from tally t
order by t.item_id, t.votes desc;
```

---

## 8. What can go wrong

**A member loses their slip.** Look them up on the **Register** tab, reveal
tokens, and re-read it to them privately. The token is unused until they vote.

**Someone votes on another member's behalf.** The system cannot detect this —
it authenticates the token, not the person. This is why slips are handed out at
check-in against identity, and why they should not be left on a table.

**A member's phone will not scan the QR code.** The join link is printed under
the QR code; read it out, or lend them a device. Their token is what matters,
not which device they use.

**Someone votes twice.** They cannot. The token is burned inside the same
database transaction that records the ballot, and the row is locked, so two
simultaneous submissions cannot both succeed.

**The venue's internet fails.** Everything stops — the ballot lives on
Supabase. Have a paper fallback for a meeting whose decisions matter, and
consider a phone hotspot as backup. Ballots already cast are safe.

**A voter closes the tab mid-ballot.** Their token is not burned until they
submit, so they can start again from the beginning.

**Submission fails on a weak connection.** The voter stays on the ballot with
an error and can retry. If the first attempt did reach the database, the retry
is refused as already-used — it cannot double-count.

**You opened voting too early.** Close voting, **Reset votes**, then open again
when ready. Reset deletes all ballots and re-enables every token.

---

## 9. Ballot secrecy — what this system does and does not promise

**Does:** `ballots` carries no member reference. There is no column, no foreign
key, and no timestamp precise enough to link a ballot to the person who cast it.
`members.has_voted` records *that* someone voted; the ballot records *what* was
voted; nothing joins them. Admins can read ballots but cannot alter or delete
them.

This is stronger than the original draft of the schema, which stored
`ballots.cast_at` and `members.voted_at` as timestamps written in the same
transaction. PostgreSQL's `now()` returns the transaction timestamp, so both
columns held an identical value and this reconstructed the entire secret ballot:

```sql
select m.full_name, b.choice
from members m join ballots b on b.cast_at = m.voted_at;
```

Storing only a date closes it. Verified: with 3 voters that join now returns 9
ambiguous rows instead of 3 identifying ones.

**Does not:** anonymity needs a crowd. If only one or two members vote on an
item, their choices are identifiable by arithmetic alone — no schema can prevent
that. The same applies to a unanimous item.

**Residual:** someone with direct database access and real intent could compare
physical row order against `created_at` ordering in the register. Section 13 of
`schema.sql` has a one-line shuffle to remove even that; run it after voting
closes.

---

## 10. Security notes

- The anon key is public. RLS is what protects the data. Never expose
  `service_role`.
- Voters cannot read the register, the raw ballots, or live tallies. Verified by
  test — the database refuses, rather than the UI hiding them.
- Cast ballots are immutable. No update or delete grant exists on `ballots` for
  anyone, including admins.
- Tokens are 6 characters from a 31-character alphabet (~887 million
  combinations) with ambiguous characters removed. Guessing one is impractical
  for a meeting, but Supabase applies no rate limiting by default — for a
  high-stakes vote, consider enabling it.
- `verify_token` returns the member's name for a valid token, so anyone holding
  a slip can confirm whose it is. That is intended: it lets a member check they
  were handed the right slip.

---

## 11. Security advisor warnings you can ignore

Supabase's linter (**Advisors → Security**) reports several warnings against
this schema. All of them are this design working as intended. Recorded here so
nobody "fixes" them into a broken meeting later.

**`anon` can execute `cast_ballot` and `verify_token`.** That is the entire
design. A voter is anonymous by definition — they hold a token, not an account.
Both functions are `SECURITY DEFINER` precisely so a voter can cast a ballot
without being able to read the tables the ballot lands in. Revoking these would
mean nobody can vote.

**`authenticated` can also execute them.** Harmless. An admin calling
`cast_ballot` still needs a valid unused token, which makes them a voter like
anyone else.

**RLS policies on `meeting_config` and `members` are "always true" for
`authenticated`.** Deliberate. This app has one meeting and one class of
privileged user: the officers running it. There are no per-row owners to scope
to. The meaningful boundary is anon vs authenticated, and that boundary is
enforced. Only create admin accounts for people who should see the register.

Two findings were real and are already fixed:

- **Security definer views** (ERROR). `tally` and `participation` ran as their
  owner, bypassing RLS. Both now use `security_invoker = on`.
- **Mutable search_path** (WARN) on `generate_token`, now pinned.

Run **Advisors → Security** yourself after any schema change. Expect the
warnings above and nothing else; anything new deserves a look.


---

## 12. How members are authenticated

Voting takes **two** things, and neither alone is enough:

| | What it is | Secret? | Proves |
|---|---|---|---|
| **Membership number** | `KCIP-0001`, from your own list | No — members already know it | The person is on the register |
| **Voting token** | `ABC-123`, generated per member | Yes — issued at check-in | The person *is* that member |

Guessing numbers gets an attacker nowhere without the token. A token found on a
dropped slip gets them nowhere without knowing whose it is.

### Importing the register

Paste your membership list straight in as `Number, Name`:

```
KCIP-0001, Stanley Muithuri Maina
KCIP-0002, Stella Mwangi
```

Each member keeps their number and is issued a fresh random token. Lines
without a number (`Jane Wanjiru`, or `Peter Otieno, peter@example.com`) still
work and get a token as before; the two formats can be mixed in one paste.

Matching ignores case and punctuation, so `KCIP-0001`, `kcip0001` and
`kcip 0001` are the same number — a hyphen should never decide whether someone
can vote. A number already on the register is refused rather than duplicated,
so re-pasting the list is safe.

**To enable this on a project created earlier**, run
[`migrations/002_member_numbers.sql`](./migrations/002_member_numbers.sql) then
[`migrations/003_two_factor.sql`](./migrations/003_two_factor.sql) in the SQL
editor. A fresh install from `schema.sql` already includes both. Migration 003
re-issues a real token to anyone whose token was previously their membership
number, and drops the older single-credential functions so the weaker path
cannot be called.

### Handing out slips

**Register → Export slips** gives you number, name and token per line, in
membership-number order — the order you will work down at check-in.

The sheet is confidential. The number on it is not a secret, but the token
beside it is, and the two together are a ballot.

Hand each slip out at check-in against identity. That is what ties the
credential to a real person; the app only checks that the pair matches.

### What this does and does not prove

**Does:** nobody votes twice — the pair is burned inside the same transaction
that records the ballot, and the row is locked, so two simultaneous
submissions cannot both succeed. Nobody who is not on the register can vote.
Guessing is impractical: the token is 6 characters from a 31-character
alphabet, and the attacker must also pair it with the right number.

**Does not:** stop a member handing their slip to someone else, or someone
voting with a slip they found. The system authenticates the credential, not the
face. That is why slips go out at check-in, one at a time, and should not be
left on a table.

**A wrong number, a wrong token and a mismatched pair all return the same
message.** That is deliberate — saying which half was wrong would let the pair
be guessed one piece at a time.

### If a member loses their slip

Look them up on **Register**, use **Show tokens**, and read the token back to
them privately. Nothing is burned until they actually vote.
