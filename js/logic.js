// Pure tournament logic: no DOM, no Firebase. Tested with `node --test`.

/**
 * Validate a set list for a match kind. Returns an error string or null.
 * In-progress scores (final = false) only need valid numbers; ties and unfinished sets are fine.
 */
export function validateSets(kind, sets, final = true) {
  if (!Array.isArray(sets) || sets.length === 0) return 'Enter at least one set.';
  for (const s of sets) {
    if (!Array.isArray(s) || s.length !== 2) return 'Each set needs two scores.';
    for (const v of s) {
      if (!Number.isInteger(v) || v < 0 || v > 60) return 'Scores must be whole numbers 0–60.';
    }
  }
  if (sets.length > (kind === 'playoff' ? 1 : 3)) return kind === 'playoff' ? 'Playoff matches are one set.' : 'Pool matches are best of three.';
  if (!final) return null;
  for (const s of sets) if (s[0] === s[1]) return 'A final set can’t be tied.';
  if (kind === 'playoff') {
    if (sets.length !== 1) return 'Playoff matches are one set.';
    return null;
  }
  if (sets.length > 3) return 'Pool matches are best of three.';
  let a = 0;
  let b = 0;
  for (const [x, y] of sets) {
    if (a === 2 || b === 2) return 'Match was already decided before the last set.';
    if (x > y) a++;
    else b++;
  }
  if (a !== 2 && b !== 2) return 'Someone needs to win two sets.';
  return null;
}

/** Summary of a final match: sets won by each side and winner index (1|2), or null if not final/decided. */
export function matchResult(kind, sets, final = true) {
  if (!final || !sets || validateSets(kind, sets)) return null;
  let s1 = 0;
  let s2 = 0;
  let p1 = 0;
  let p2 = 0;
  for (const [x, y] of sets) {
    p1 += x;
    p2 += y;
    if (x > y) s1++;
    else s2++;
  }
  return { s1, s2, p1, p2, winner: s1 > s2 ? 1 : 2 };
}

/** Scores saved before in-progress entry existed have no `final` field; those were always complete. */
export const isFinal = (score) => !!score && score.final !== false;

const setPct = (r) => (r.sw + r.sl === 0 ? 0 : r.sw / (r.sw + r.sl));

function compareRecords(a, b) {
  return (
    b.mw - a.mw ||
    setPct(b) - setPct(a) ||
    b.pd - a.pd ||
    b.pf - a.pf ||
    a.team.localeCompare(b.team)
  );
}

/**
 * Standings for one pool.
 * @param {string[]} teams
 * @param {object[]} matches pool matches for this pool
 * @param {Record<string, {sets:number[][]}>} scores keyed by match id
 * @returns {{rows: object[], complete: boolean, played: number}}
 */
export function poolStandings(teams, matches, scores) {
  const rec = Object.fromEntries(
    teams.map((t) => [t, { team: t, mw: 0, ml: 0, sw: 0, sl: 0, pf: 0, pa: 0, pd: 0, tie: false }]),
  );
  const h2h = {};
  let played = 0;
  for (const m of matches) {
    const r = matchResult('pool', scores[m.id]?.sets, isFinal(scores[m.id]));
    if (!r) continue;
    played++;
    const a = rec[m.t1];
    const b = rec[m.t2];
    a.sw += r.s1; a.sl += r.s2; a.pf += r.p1; a.pa += r.p2;
    b.sw += r.s2; b.sl += r.s1; b.pf += r.p2; b.pa += r.p1;
    const [w, l] = r.winner === 1 ? [m.t1, m.t2] : [m.t2, m.t1];
    rec[w].mw++;
    rec[l].ml++;
    h2h[`${w}|${l}`] = true;
  }
  for (const r of Object.values(rec)) r.pd = r.pf - r.pa;

  // Group by (match wins, set %). Two-way ties break on head-to-head first.
  const rows = Object.values(rec).sort((a, b) => b.mw - a.mw || setPct(b) - setPct(a));
  const out = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j].mw === rows[i].mw && setPct(rows[j]) === setPct(rows[i])) j++;
    const group = rows.slice(i, j);
    if (group.length === 2 && (h2h[`${group[0].team}|${group[1].team}`] || h2h[`${group[1].team}|${group[0].team}`])) {
      if (h2h[`${group[1].team}|${group[0].team}`]) group.reverse();
    } else {
      group.sort(compareRecords);
      for (let k = 1; k < group.length; k++) {
        const p = group[k - 1];
        const c = group[k];
        if (p.pd === c.pd && p.pf === c.pf) p.tie = c.tie = true;
      }
    }
    out.push(...group);
    i = j;
  }
  out.forEach((r, i) => (r.rank = i + 1));
  return { rows: out, complete: played === matches.length, played };
}

/** Standings for every pool. */
export function allStandings(pools, poolMatches, scores) {
  return Object.fromEntries(
    Object.entries(pools).map(([key, p]) => [
      key,
      poolStandings(p.teams, poolMatches.filter((m) => m.pool === key), scores),
    ]),
  );
}

/**
 * Auto seeds for a division: seeds 1–6 are teams finishing ranks[0] in their pool,
 * 7–12 finish ranks[1]; each group ordered across pools by record.
 * Returns null until every pool is complete.
 */
export function autoSeeds(standings, ranks) {
  const all = Object.values(standings);
  if (!all.every((s) => s.complete)) return null;
  return ranks.flatMap((rank) =>
    all.map((s) => s.rows[rank - 1]).sort(compareRecords).map((r) => r.team),
  );
}

/** Seeds in effect: a valid 12-team override wins over auto seeds. */
export function effectiveSeeds(auto, override) {
  if (override?.order?.length === 12 && override.order.every(Boolean)) {
    return { seeds: override.order, source: 'override' };
  }
  return { seeds: auto, source: auto ? 'auto' : 'pending' };
}

/** Human label for a bracket ref like S8, W6, L12. */
export function refLabel(ref, divisionName) {
  const n = ref.slice(1);
  if (ref[0] === 'S') return `Seed ${n}`;
  return `${divisionName} ${n} ${ref[0] === 'W' ? 'winner' : 'loser'}`;
}

/**
 * Resolve a division bracket into concrete team names where known.
 * @param {object[]} matches playoff matches for one division, sorted by n
 * @param {string[]|null} seeds
 * @param {object} scores
 * @returns {object[]} matches with {team1, team2, worker, result, winnerTeam, loserTeam}
 */
export function resolveBracket(matches, seeds, scores) {
  const byN = {};
  const resolve = (ref) => {
    const n = Number(ref.slice(1));
    if (ref[0] === 'S') return seeds?.[n - 1] ?? null;
    const m = byN[n];
    if (!m) return null;
    return ref[0] === 'W' ? m.winnerTeam : m.loserTeam;
  };
  const sorted = [...matches].sort((a, b) => a.n - b.n);
  const out = [];
  for (const m of sorted) {
    const team1 = resolve(m.t1);
    const team2 = resolve(m.t2);
    const result = team1 && team2 ? matchResult('playoff', scores[m.id]?.sets, isFinal(scores[m.id])) : null;
    const r = {
      ...m,
      team1,
      team2,
      result,
      winnerTeam: result ? (result.winner === 1 ? team1 : team2) : null,
      loserTeam: result ? (result.winner === 1 ? team2 : team1) : null,
    };
    byN[m.n] = r;
    out.push(r);
  }
  for (const r of out) r.worker = resolve(r.work);
  return out;
}

/** Place finishes derived from a resolved bracket. */
export function placements(resolved) {
  const by = Object.fromEntries(resolved.map((m) => [m.n, m]));
  return {
    first: by[15]?.winnerTeam ?? null,
    second: by[15]?.loserTeam ?? null,
    third: by[16]?.winnerTeam ?? null,
  };
}
