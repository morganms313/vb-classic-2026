import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POOLS, POOL_MATCHES, PLAYOFF_MATCHES, DIVISIONS, ALL_TEAMS } from '../data/tournament.js';
import {
  validateSets, matchResult, poolStandings, allStandings, autoSeeds, effectiveSeeds,
  resolveBracket, placements, refLabel,
} from '../js/logic.js';

// --- data integrity -------------------------------------------------------

test('24 teams, 36 pool matches, 32 playoff matches', () => {
  assert.equal(ALL_TEAMS.length, 24);
  assert.equal(new Set(ALL_TEAMS).size, 24);
  assert.equal(POOL_MATCHES.length, 36);
  assert.equal(PLAYOFF_MATCHES.length, 32);
});

test('each pool is a full round robin; every team plays 3 and works at least 1', () => {
  for (const [key, pool] of Object.entries(POOLS)) {
    const ms = POOL_MATCHES.filter((m) => m.pool === key);
    const pairs = new Set(ms.map((m) => [m.t1, m.t2].sort().join('|')));
    assert.equal(pairs.size, 6, `pool ${key} pairs`);
    for (const t of pool.teams) {
      assert.equal(ms.filter((m) => m.t1 === t || m.t2 === t).length, 3, `${t} plays 3`);
      assert.ok(ms.some((m) => m.work === t), `${t} works`);
    }
    for (const m of ms) {
      assert.ok(pool.teams.includes(m.t1) && pool.teams.includes(m.t2) && pool.teams.includes(m.work));
      assert.ok(m.work !== m.t1 && m.work !== m.t2);
    }
  }
});

// --- validation -----------------------------------------------------------

test('validateSets', () => {
  assert.equal(validateSets('pool', [[25, 20], [25, 18]]), null);
  assert.equal(validateSets('pool', [[25, 20], [18, 25], [15, 10]]), null);
  assert.match(validateSets('pool', [[25, 20]]), /two sets/);
  assert.match(validateSets('pool', [[25, 20], [25, 18], [10, 15]]), /already decided/);
  assert.match(validateSets('pool', [[25, 25], [25, 18]]), /tie/);
  assert.match(validateSets('pool', [[25, -1], [25, 18]]), /0–60/);
  assert.equal(validateSets('playoff', [[25, 23]]), null);
  assert.match(validateSets('playoff', [[25, 23], [25, 1]]), /one set/);
});

test('matchResult totals', () => {
  assert.deepEqual(matchResult('pool', [[25, 20], [18, 25], [15, 10]]), { s1: 2, s2: 1, p1: 58, p2: 55, winner: 1 });
  assert.equal(matchResult('pool', [[25, 20]]), null);
});

// --- standings ------------------------------------------------------------

const A = POOL_MATCHES.filter((m) => m.pool === 'A');

function scoreMatch(scores, m, winner, sets) {
  // winner is a team name; sets from the winner's perspective
  const flip = m.t2 === winner;
  scores[m.id] = { sets: sets.map(([w, l]) => (flip ? [l, w] : [w, l])) };
}
const find = (ms, x, y) => ms.find((m) => (m.t1 === x && m.t2 === y) || (m.t1 === y && m.t2 === x));

test('clean standings: 3-0, 2-1, 1-2, 0-3', () => {
  const s = {};
  const [V, B, S, SP] = POOLS.A.teams;
  scoreMatch(s, find(A, V, B), V, [[25, 10], [25, 10]]);
  scoreMatch(s, find(A, V, S), V, [[25, 10], [25, 10]]);
  scoreMatch(s, find(A, V, SP), V, [[25, 10], [25, 10]]);
  scoreMatch(s, find(A, B, S), B, [[25, 10], [25, 10]]);
  scoreMatch(s, find(A, B, SP), B, [[25, 10], [25, 10]]);
  scoreMatch(s, find(A, S, SP), S, [[25, 10], [25, 10]]);
  const st = poolStandings(POOLS.A.teams, A, s);
  assert.equal(st.complete, true);
  assert.deepEqual(st.rows.map((r) => r.team), [V, B, S, SP]);
  assert.deepEqual([st.rows[0].mw, st.rows[0].ml, st.rows[0].sw, st.rows[0].sl], [3, 0, 6, 0]);
});

test('two-way tie on wins and set % breaks by head-to-head, not point diff', () => {
  const s = {};
  const [V, B, S, SP] = POOLS.A.teams;
  // V and B both 2-1 with identical set records; B beat V but V has much better point diff.
  scoreMatch(s, find(A, B, V), B, [[25, 23], [25, 23]]);
  scoreMatch(s, find(A, V, S), V, [[25, 5], [25, 5]]);
  scoreMatch(s, find(A, V, SP), V, [[25, 5], [25, 5]]);
  scoreMatch(s, find(A, B, S), B, [[25, 23], [25, 23]]);
  scoreMatch(s, find(A, SP, B), SP, [[25, 23], [25, 23]]);
  scoreMatch(s, find(A, S, SP), S, [[25, 23], [25, 23]]);
  const st = poolStandings(POOLS.A.teams, A, s);
  assert.equal(st.rows[0].team, B);
  assert.equal(st.rows[1].team, V);
});

test('three-way tie falls to point differential', () => {
  const s = {};
  const [V, B, S, SP] = POOLS.A.teams;
  // V beats B, B beats S, S beats V: all 2-1 after each beats SP. Sets all 2-0.
  scoreMatch(s, find(A, V, B), V, [[25, 20], [25, 20]]); // V +10
  scoreMatch(s, find(A, B, S), B, [[25, 15], [25, 15]]); // B +20
  scoreMatch(s, find(A, S, V), S, [[25, 23], [25, 23]]); // S +4
  for (const t of [V, B, S]) scoreMatch(s, find(A, t, SP), t, [[25, 10], [25, 10]]);
  const st = poolStandings(POOLS.A.teams, A, s);
  // pd: V +10-4+30=36, B -10+20+30=40, S -20+4+30=14
  assert.deepEqual(st.rows.map((r) => r.team), [B, V, S, SP]);
});

test('incomplete pool reports not complete', () => {
  const s = {};
  scoreMatch(s, A[0], A[0].t1, [[25, 10], [25, 10]]);
  const st = poolStandings(POOLS.A.teams, A, s);
  assert.equal(st.complete, false);
  assert.equal(st.played, 1);
});

// --- seeding + bracket ----------------------------------------------------

// Every pool: team index 0 goes 3-0, 1 goes 2-1, 2 goes 1-2, 3 goes 0-3.
// Margin varies by pool so cross-pool ordering is deterministic: pool A widest.
function fullPoolScores() {
  const s = {};
  const margins = { A: 15, B: 13, C: 11, D: 9, E: 7, F: 5 };
  for (const [key, pool] of Object.entries(POOLS)) {
    const ms = POOL_MATCHES.filter((m) => m.pool === key);
    const t = pool.teams;
    const lose = 25 - margins[key];
    for (const [w, l] of [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]) {
      scoreMatch(s, find(ms, t[w], t[l]), t[w], [[25, lose], [25, lose]]);
    }
  }
  return s;
}

test('auto seeds: pool winners 1–6, runners-up 7–12; Purple uses 3rd/4th', () => {
  const scores = fullPoolScores();
  const st = allStandings(POOLS, POOL_MATCHES, scores);
  const gold = autoSeeds(st, DIVISIONS.gold.ranks);
  assert.deepEqual(gold.slice(0, 6), ['Valencia', 'Canyon', 'Golden Valley', 'Saugus', 'Castaic', 'Burroughs']);
  assert.deepEqual(gold.slice(6), ['Birmingham', 'Kennedy', 'Granada Hills', 'Buena', 'El Camino Real', 'Ventura']);
  const purple = autoSeeds(st, DIVISIONS.purple.ranks);
  // 3rd/4th-place teams have negative point diff, so the narrowest margins (pool F) seed highest.
  assert.deepEqual(purple.slice(0, 6), ['Alemany 2', 'Alemany 1', 'Quartz Hill', 'Providence', 'Trinity', 'SCCS']);
  assert.equal(purple[6], 'Village Christian');
  assert.equal(purple.length, 12);
});

test('auto seeds are null until every pool is complete', () => {
  const scores = fullPoolScores();
  delete scores.F6;
  assert.equal(autoSeeds(allStandings(POOLS, POOL_MATCHES, scores), [1, 2]), null);
});

test('override wins over auto, partial override ignored', () => {
  const auto = Array.from({ length: 12 }, (_, i) => `T${i}`);
  const order = [...auto].reverse();
  assert.deepEqual(effectiveSeeds(auto, { order }), { seeds: order, source: 'override' });
  assert.deepEqual(effectiveSeeds(auto, { order: order.slice(0, 5) }), { seeds: auto, source: 'auto' });
  assert.deepEqual(effectiveSeeds(null, null), { seeds: null, source: 'pending' });
});

test('bracket resolves seeds, winners, losers, workers; top seeds win out', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => `Seed${i + 1}`);
  const gold = PLAYOFF_MATCHES.filter((m) => m.division === 'gold');
  const scores = {};
  // Lower seed number always wins; walk the bracket in order, scoring as teams become known.
  for (let pass = 0; pass < 16; pass++) {
    for (const m of resolveBracket(gold, seeds, scores)) {
      if (m.team1 && m.team2 && !scores[m.id]) {
        const n1 = Number(m.team1.slice(4));
        const n2 = Number(m.team2.slice(4));
        scores[m.id] = { sets: [n1 < n2 ? [25, 20] : [20, 25]] };
      }
    }
  }
  const r = resolveBracket(gold, seeds, scores);
  const by = Object.fromEntries(r.map((m) => [m.n, m]));
  assert.deepEqual([by[1].team1, by[1].team2, by[1].worker], ['Seed8', 'Seed9', 'Seed1']);
  assert.deepEqual([by[6].team1, by[6].team2], ['Seed1', 'Seed8']);
  assert.deepEqual([by[5].team1, by[5].team2], ['Seed9', 'Seed12']);
  assert.deepEqual([by[15].team1, by[15].team2], ['Seed1', 'Seed2']);
  assert.equal(by[13].worker, 'Seed6'); // L10: Seed3 beat Seed6
  assert.deepEqual(placements(r), { first: 'Seed1', second: 'Seed2', third: 'Seed3' });
  assert.ok(r.every((m) => m.result), 'all 16 matches decided');
});

test('unresolved bracket slots stay null', () => {
  const gold = PLAYOFF_MATCHES.filter((m) => m.division === 'gold');
  const r = resolveBracket(gold, null, {});
  assert.ok(r.every((m) => m.team1 === null && m.team2 === null));
  assert.equal(refLabel('W6', 'Gold'), 'Gold 6 winner');
  assert.equal(refLabel('S12', 'Gold'), 'Seed 12');
});
