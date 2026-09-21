# Valencia Frosh-Soph Classic 2026 — Parent Site (POC) Design

**Date:** 2026-09-21 · **Event:** Saturday, September 26, 2026 · **Source:** `references/2026 Valencia Frosh-Soph Classic Schedule.pdf`

## Goal

A mobile-first public web page parents open from a texted link (no login) to see schedule, live pool standings, and live Gold/Purple brackets — and where anyone at any of the three gyms can enter scores. Proof of concept: open editing now; locking to named scorekeepers later must be a rules change, not a rebuild.

## Tournament facts (from the flyer)

- 24 teams, 6 pools of 4, round robin (3 matches per team, 6 per pool, 36 total). Pool matches are best-of-three (2 or 3 sets recorded).
- Venues / courts: Valencia HS — Pools A (Court 1), B (Court 2). Golden Valley HS — Pools C (Court 4), D (Court 5). Castaic HS — Pools E (Court 7), F (Court 8).
- Timeline: 7:00 check-in, 7:30 coaches'/officials' meeting and spectator doors, 8:00–1:00 pool play (hourly slots), 3:00–5:30 playoffs (30-min slots), 6:00 awards.
- Pools: A Valencia, Birmingham, SCCS, Santa Paula · B Canyon, Kennedy, Trinity, Newbury Park · C Golden Valley, Granada Hills, Providence, Royal · D Saugus, Buena, Quartz Hill, Moorpark · E Castaic, El Camino Real, Alemany 1, Rosamond · F Burroughs, Ventura, Alemany 2, Village Christian.
- Pool schedule (team1, team2, working) per slot/court: transcribed verbatim from PDF page 3 into `data/tournament.js`.
- 1st/2nd in each pool → **Gold** (Valencia, Courts 1–3). 3rd/4th → **Purple** (Golden Valley, Courts 4–6). Playoff matches are a single set to 25.
- Tickets: $10 cashless via ticket link; kids ≤5 and seniors 65+ free; one ticket covers all venues. Directions (north/south Google Maps links + parking notes) for each gym. Contact: Jim Shiraishi, Tournament Director.

### Bracket (identical for Gold and Purple; `S`=seed, `W`/`L`=winner/loser of match n)

| # | Time | Court (G/P) | Team 1 | Team 2 | Working |
|---|------|-------|--------|--------|---------|
| 1 | 3:00 | 1 / 4 | S8 | S9 | S1 |
| 2 | 3:00 | 2 / 5 | S5 | S12 | S4 |
| 3 | 3:30 | 1 / 4 | S7 | S10 | S2 |
| 4 | 3:30 | 2 / 5 | S6 | S11 | S3 |
| 5 | 3:30 | 3 / 6 | L1 | L2 | W1 |
| 6 | 4:00 | 1 / 4 | S1 | W1 | S2 |
| 7 | 4:00 | 2 / 5 | S4 | W2 | S3 |
| 8 | 4:00 | 3 / 6 | L3 | L4 | W5 |
| 9 | 4:30 | 1 / 4 | S2 | W3 | W6 |
| 10 | 4:30 | 2 / 5 | S3 | W4 | W7 |
| 11 | 4:30 | 3 / 6 | L6 | L7 | W8 |
| 12 | 5:00 | 1 / 4 | W6 | W7 | L6 |
| 13 | 5:00 | 2 / 5 | W9 | W10 | L10 |
| 14 | 5:00 | 3 / 6 | L9 | L10 | W11 |
| 15 | 5:30 | 1 / 4 | W12 | W13 | L12 | ← Championship (1st place)
| 16 | 5:30 | 3 / 6 | L12 | L13 | W14 | ← 3rd place

**Flyer ambiguities (shown as-is, flagged in the UI data, not "fixed"):**
- Purple courts: schedule table says Courts 4/5/6; bracket page says 1/2/3. Site uses **4/5/6**.
- Working conflicts in the source: match 13 working "L10" while L10 plays match 14 at 5:00; match 15 working "L12" while L12 plays match 16 at 5:30. Site displays the flyer's assignment with a small "TBD — check with director" note.

## Pages (single page, 4 tabs)

Header: event name + **"Follow my team"** picker (persisted in `localStorage`, try/catch-guarded). Selected team is highlighted everywhere, including work assignments.

1. **Info** — date/times, ticket link + pricing, per-gym cards with North/South Maps buttons and parking note, director contact.
2. **Schedule** — grouped by gym → time → court; each card shows teams, working team, score/status. "Now / Next" strip based on device clock on event day. Playoff matches appear with resolved team names once known.
3. **Pools** — standings per pool A–F: MW-ML, sets W-L, point diff; rank badge + Gold/Purple destination once pool complete.
4. **Bracket** — Gold/Purple toggle; championship tree (1–4, 6, 7, 9, 10, 12, 13, 15), consolation strip (5, 8, 11, 14) and 3rd place (16). Slots show resolved team names, court, time, working team, score.

Mobile-first, 16px gutters, large tap targets, works at 360px width, light/dark via `prefers-color-scheme`. Valencia purple/gold palette.

## Score entry

Tap any match → bottom sheet with set score inputs (pool: 3 sets, set 3 optional; playoff: 1 set), optional "entered by" name, Save / Clear. Validation: integers 0–60, no ties within a set, pool match must have a 2-set winner (2–0 or 2–1). Every match shows "updated X min ago". Anyone can edit (POC).

## Seeding

- **Pool rank:** match wins → set win % → head-to-head (2-way ties only) → point differential → points scored → alphabetical (last resort, marked "tie").
- **Division seeds:** Gold seeds 1–6 = pool winners ranked against each other by (match wins, set %, point diff, points scored); seeds 7–12 = runners-up by the same. Purple identical using 3rd and 4th place teams.
- Seeds computed only when all 36 pool matches have scores; before that, bracket shows "Seed N".
- **Override:** "Edit seeds" screen per division lets anyone assign teams to seeds 1–12 (each team once). Saved overrides are stored in Firestore and win over auto seeding until "Reset to auto".

## Architecture

- **Static site** (plain HTML/CSS/ES modules, no build step) on GitHub Pages, repo under `morganms313`.
- `data/tournament.js` — static facts: teams, pools, venues, pool matches (ids `A1`…`F6`), bracket templates (ids `G1`…`G16`, `P1`…`P16`), info content.
- `js/logic.js` — pure functions, no DOM/Firebase: `poolStandings`, `divisionSeeds`, `resolveBracket` (seed/winner/loser refs → team names), `matchWinner`. Unit-tested with `node --test`.
- `js/store.js` — Firestore wrapper: subscribe to `scores` and `seeds` collections, save/clear. Uses Firestore `persistentLocalCache` (IndexedDB) so reads survive reload offline and writes queue until reconnected.
- `js/ui.js` + `index.html` + `css/style.css` — rendering from `(tournament, scores, seedOverrides)`.
- `sw.js` — service worker caching the app shell so the page opens with no signal.
- Firebase config in `js/firebase-config.js` (public web config; not a secret).

### Firestore data

- `scores/{matchId}` → `{ sets: [[25,21],[20,25],[15,11]], by: "optional name", updatedAt: serverTimestamp }`
- `seeds/{gold|purple}` → `{ order: ["Team", … 12], by, updatedAt }`

### Security rules (POC)

Public read. Writes allowed only to `scores/{id}` where id matches `^[A-F][1-6]$|^[GP]([1-9]|1[0-6])$`, `sets` is a list of 1–3 pairs of ints 0–60, `by` is a string ≤ 40 chars; and to `seeds/{gold|purple}` with `order` a list of 12 strings. Everything else denied. Later upgrade: require `request.auth` + allowlist of scorekeeper emails.

## Testing

- `node --test` on `logic.js`: standings with ties, head-to-head, seeding order, full bracket resolution from a sample fully-scored tournament, override precedence.
- Data check test: 36 pool matches, each team plays 3 and works ≥1, every pool pair appears exactly once.
- Manual: browser preview at mobile width; enter scores in two tabs to confirm live sync; offline reload.

## Out of scope (POC)

Auth, push notifications, stats, JV tournament (Oct 3) — though swapping `data/tournament.js` should support it.

## Morgan's setup step

Create a Firebase project (Google account), add a Web app, enable Firestore (production mode), paste the web config; Claude supplies the rules file to publish. Create GitHub repo + enable Pages.
