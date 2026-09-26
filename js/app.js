import {
  EVENT, VENUES, POOLS, POOL_MATCHES, PLAYOFF_MATCHES, DIVISIONS, ALL_TEAMS, TIME_ORDER,
} from '../data/tournament.js';
import {
  validateSets, matchResult, isFinal, allStandings, autoSeeds, effectiveSeeds, resolveBracket, placements, refLabel,
} from './logic.js';
import { createStore, normalizeScores, byLine } from './store.js';

// Score entry, standings, and auto-seeding. Off since 2026-09-26: not enough parents
// entering scores. Flip to true to bring back sign-in, score sheets, standings, and seeds.
const SCORING = false;

// ---------- state ----------

const LS = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const state = {
  tab: LS.get('vfsc26-tab', 'schedule'),
  team: LS.get('vfsc26-team', ''),
  venue: LS.get('vfsc26-venue', ''),
  division: LS.get('vfsc26-div', 'gold'),
  scores: {},
  seedOverrides: {},
  user: null,
  store: null,
};

let derived = null;

function derive() {
  const scores = SCORING ? state.scores : {};
  const standings = allStandings(POOLS, POOL_MATCHES, scores);
  const divisions = {};
  for (const d of Object.values(DIVISIONS)) {
    const auto = autoSeeds(standings, d.ranks);
    const eff = effectiveSeeds(auto, SCORING ? state.seedOverrides[d.key] : null);
    const matches = PLAYOFF_MATCHES.filter((m) => m.division === d.key);
    const bracket = resolveBracket(matches, eff.seeds, scores);
    divisions[d.key] = { ...d, auto, ...eff, bracket, places: placements(bracket) };
  }
  derived = { standings, divisions };
}

// ---------- helpers ----------

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function ago(ms) {
  if (!ms) return '';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toMinutes(t) {
  const [, h, m, ap] = t.match(/(\d+):(\d+) (AM|PM)/);
  return ((Number(h) % 12) + (ap === 'PM' ? 12 : 0)) * 60 + Number(m);
}

// ?now=2026-09-26T09:15 lets you preview event-day behavior.
function nowDate() {
  const q = new URLSearchParams(location.search).get('now');
  const d = q ? new Date(q) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function isLive(m) {
  const now = nowDate();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (ymd !== EVENT.date) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(m.time);
  return mins >= start && mins < start + (m.kind === 'pool' ? 60 : 30);
}

const teamSpan = (name, placeholder) => {
  if (!name) return `<span class="tbd">${esc(placeholder)}</span>`;
  return `<span class="tn${name === state.team ? ' me' : ''}">${esc(name)}</span>`;
};

function matchLabel(m) {
  if (m.kind === 'pool') return `Pool ${m.pool}`;
  return `${DIVISIONS[m.division].name} ${m.n}`;
}

// Normalize any match into {t1Name, t2Name, t1Ph, t2Ph, workName, workPh}
function sides(m) {
  if (m.kind === 'pool') return { a: m.t1, b: m.t2, aPh: '', bPh: '', w: m.work, wPh: '' };
  const d = DIVISIONS[m.division].name;
  const r = derived.divisions[m.division].bracket.find((x) => x.n === m.n);
  const seedTag = (ref) => (ref[0] === 'S' ? `${ref.slice(1)}` : '');
  return {
    a: r.team1, b: r.team2, w: r.worker,
    aPh: refLabel(m.t1, d), bPh: refLabel(m.t2, d), wPh: refLabel(m.work, d),
    aSeed: seedTag(m.t1), bSeed: seedTag(m.t2),
  };
}

// ---------- match card ----------

function matchCard(m, opts = {}) {
  const sc = SCORING ? state.scores[m.id] : undefined;
  const res = sc ? matchResult(m.kind, sc.sets, isFinal(sc)) : null;
  const inProgress = !!sc && !isFinal(sc);
  const s = sides(m);
  const mine = state.team && [s.a, s.b].includes(state.team);
  const working = state.team && s.w === state.team;
  const live = inProgress || (!res && isLive(m));
  const sets = sc?.sets ?? [];
  const setCells = (i) =>
    sets.map((set) => {
      const won = set[i] > set[1 - i];
      return `<span class="set${won ? ' won' : ''}">${set[i]}</span>`;
    }).join('');
  const row = (name, ph, seed, i) => {
    const won = res && res.winner === i + 1;
    return `<div class="side${won ? ' winner' : ''}${res && !won ? ' loser' : ''}">
      ${seed ? `<span class="seed">${esc(seed)}</span>` : ''}
      ${teamSpan(name, ph)}
      <span class="sets">${m.kind === 'playoff'
        ? (sets.length ? `<span class="tot pts">${sets[0][i]}</span>` : '')
        : `${setCells(i)}${res ? `<span class="tot">${i === 0 ? res.s1 : res.s2}</span>` : ''}`}</span>
    </div>`;
  };
  const canTap = SCORING && (m.kind === 'pool' || !!(s.a && s.b));
  const meta = opts.showWhen ? `${esc(m.time)} · Ct ${m.court}` : `Court ${m.court}`;
  const stamp = sc ? `${sc.by ? ` · ${esc(sc.by)}` : ''} · ${ago(sc.updatedAt)}${sc.pending ? ' · <b>syncing…</b>' : ''}` : '';
  const status = res ? `Final${stamp}`
    : inProgress ? `<b class="inprog">In progress</b>${stamp}`
    : canTap ? 'Tap to enter score' : SCORING ? 'Waiting on earlier results' : '';
  return `<button type="button" class="match${mine ? ' mine' : ''}${working ? ' working' : ''}${live ? ' live' : ''}${res ? ' done' : ''}" data-match="${m.id}" ${canTap ? '' : 'aria-disabled="true"'}>
    <div class="mhead"><span class="mlabel">${esc(matchLabel(m))}${m.round && (!opts.showWhen || opts.showRound) ? ` · ${esc(m.round)}` : ''}</span><span class="mmeta">${live ? `<span class="now">${inProgress ? 'Live' : 'Now'}</span>` : ''}${meta}</span></div>
    ${row(s.a, s.aPh, s.aSeed, 0)}
    ${row(s.b, s.bPh, s.bSeed, 1)}
    <div class="mfoot"><span class="work">Work: ${teamSpan(s.w, s.wPh)}${m.note ? ' <span class="flag" title="' + esc(m.note) + '">⚠︎</span>' : ''}</span><span class="status">${status}</span></div>
  </button>`;
}

// ---------- my team ----------

function myTeamCard() {
  const t = state.team;
  if (!t) {
    return `<section class="card hint"><p><b>Tip:</b> pick your daughter’s team under <b>Following</b> up top to highlight every match she plays and works.</p></section>`;
  }
  const pool = Object.entries(POOLS).find(([, p]) => p.teams.includes(t));
  const [poolKey, p] = pool;
  const st = derived.standings[poolKey];
  const row = st.rows.find((r) => r.team === t);
  const items = [];
  for (const m of POOL_MATCHES) if (m.t1 === t || m.t2 === t || m.work === t) items.push(m);
  for (const d of Object.values(derived.divisions)) {
    for (const r of d.bracket) {
      if (r.team1 === t || r.team2 === t || r.worker === t) items.push(PLAYOFF_MATCHES.find((m) => m.id === r.id));
    }
  }
  items.sort((a, b) => TIME_ORDER.indexOf(a.time) - TIME_ORDER.indexOf(b.time));

  let playoff = '';
  for (const d of Object.values(derived.divisions)) {
    const i = d.seeds ? d.seeds.indexOf(t) : -1;
    if (i >= 0) {
      playoff = `<span class="pill ${d.key}">${d.name} · Seed ${i + 1}</span>`;
      const pl = d.places;
      if (pl.first === t) playoff += ' <span class="pill trophy">🏆 Champions</span>';
      else if (pl.second === t) playoff += ' <span class="pill trophy">2nd place</span>';
      else if (pl.third === t) playoff += ' <span class="pill trophy">3rd place</span>';
    }
  }
  if (!playoff && st.complete) {
    const d = row.rank <= 2 ? DIVISIONS.gold : DIVISIONS.purple;
    playoff = `<span class="pill ${d.key}">Headed to ${d.name}</span>`;
  }

  const lines = items.map((m) => {
    const s = sides(m);
    const plays = s.a === t || s.b === t;
    const opp = plays ? (s.a === t ? s.b : s.a) : null;
    const sc = SCORING ? state.scores[m.id] : undefined;
    const res = sc ? matchResult(m.kind, sc.sets, isFinal(sc)) : null;
    let outcome = '';
    if (plays && sc) {
      const mineIdx = s.a === t ? 1 : 2;
      const setsTxt = sc.sets.map((x) => (mineIdx === 1 ? x : [x[1], x[0]]).join('–')).join(', ');
      if (res) {
        const w = res.winner === mineIdx;
        outcome = `<span class="res ${w ? 'w' : 'l'}">${w ? 'W' : 'L'}</span> <span class="muted">${setsTxt}</span>`;
      } else {
        outcome = `<span class="now">Live</span> <span class="muted">${setsTxt}</span>`;
      }
    }
    return `<li class="${plays ? 'play' : 'workrow'}${!res && isLive(m) ? ' live' : ''}">
      <span class="when">${esc(m.time.replace(':00', ''))}</span>
      <span class="what">${plays ? `vs ${esc(opp ?? 'TBD')}` : `Working ${esc(matchLabel(m))}`}
        <small>${esc(VENUES[m.venue].short)} · Court ${m.court}${m.kind === 'playoff' ? ` · ${esc(matchLabel(m))}` : ''}</small></span>
      <span class="out">${outcome}</span>
    </li>`;
  }).join('');

  return `<section class="card myteam">
    <div class="myhead">
      <div><div class="kicker">Pool ${poolKey} · ${esc(VENUES[p.venue].short)}</div><h2>${esc(t)}</h2></div>
      ${SCORING ? `<div class="rec"><b>${row.mw}–${row.ml}</b><small>#${row.rank} in pool</small></div>` : ''}
    </div>
    ${playoff ? `<div class="pills">${playoff}</div>` : ''}
    <ul class="agenda">${lines}</ul>
    ${!Object.values(derived.divisions).some((d) => d.seeds?.includes(t))
      ? '<p class="muted small">Playoffs start at 3:00 PM: top two in each pool go to Gold at Valencia, bottom two go to Purple at Golden Valley.</p>' : ''}
  </section>`;
}

// ---------- tabs ----------

function renderSchedule() {
  const followedVenue = state.team ? POOLS[Object.keys(POOLS).find((k) => POOLS[k].teams.includes(state.team))].venue : '';
  const venue = state.venue || followedVenue || 'VHS';
  const seg = Object.entries(VENUES).map(([k, v]) =>
    `<button type="button" class="seg-btn${k === venue ? ' on' : ''}" data-venue="${k}">${esc(v.short)}</button>`).join('');
  const pool = POOL_MATCHES.filter((m) => m.venue === venue);
  const playoff = PLAYOFF_MATCHES.filter((m) => m.venue === venue);
  const byTime = (list) => {
    const times = [...new Set(list.map((m) => m.time))];
    return times.map((t) => `<div class="slot"><h3 class="slot-time">${esc(t)}</h3><div class="grid">${list.filter((m) => m.time === t).sort((a, b) => a.court - b.court).map((m) => matchCard(m)).join('')}</div></div>`).join('');
  };
  const pools = Object.entries(POOLS).filter(([, p]) => p.venue === venue).map(([k, p]) => `Pool ${k} on Court ${p.court}`).join(' · ');
  const div = Object.values(DIVISIONS).find((d) => d.venue === venue);
  return `${myTeamCard()}
    <div class="seg" role="tablist" aria-label="Gym">${seg}</div>
    <p class="venue-note">${esc(VENUES[venue].name)} · ${esc(pools)} · <a href="#info" data-goto="info">directions</a></p>
    <h2 class="section-title">Pool play</h2>
    ${byTime(pool)}
    ${div ? `<h2 class="section-title">${esc(div.name)} playoffs <span class="muted">· one set to 25</span></h2>${byTime(playoff)}` : '<p class="muted small center">No playoffs at this gym. Gold playoffs are at Valencia and Purple playoffs are at Golden Valley.</p>'}`;
}

function renderPools() {
  if (!SCORING) return renderPoolLists();
  return Object.entries(POOLS).map(([k, p]) => {
    const st = derived.standings[k];
    const rows = st.rows.map((r) => {
      const dest = st.complete ? (r.rank <= 2 ? '<span class="dot gold" title="Gold">G</span>' : '<span class="dot purple" title="Purple">P</span>') : '';
      return `<tr class="${r.team === state.team ? 'me-row' : ''}">
        <td class="rk">${r.rank}</td>
        <td class="tm">${esc(r.team)}${r.tie ? ' <span class="muted" title="Tied on every tiebreaker">*</span>' : ''}</td>
        <td>${r.mw}–${r.ml}</td><td>${r.sw}–${r.sl}</td><td>${r.pd > 0 ? '+' : ''}${r.pd}</td><td class="dest">${dest}</td>
      </tr>`;
    }).join('');
    return `<section class="card pool">
      <div class="pool-head"><h2>Pool ${k}</h2><span class="muted small">${esc(VENUES[p.venue].short)} · Court ${p.court} · ${st.played}/6 played</span></div>
      <table><thead><tr><th></th><th class="tm">Team</th><th>Match</th><th>Sets</th><th>+/−</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
  }).join('') + `<p class="muted small center">Ranked by match wins, then set win %, then head-to-head (two-way ties), then point differential.<br>
    <span class="dot gold">G</span> Gold (1st/2nd) · <span class="dot purple">P</span> Purple (3rd/4th)</p>`;
}

// Pools without standings: each pool's teams and its six matches.
function renderPoolLists() {
  return Object.entries(POOLS).map(([k, p]) => {
    const teams = p.teams.map((t) => `<li class="${t === state.team ? 'me-row' : ''}">${esc(t)}</li>`).join('');
    const games = POOL_MATCHES.filter((m) => m.pool === k).map((m) =>
      `<tr class="${[m.t1, m.t2, m.work].includes(state.team) ? 'me-row' : ''}"><td class="rk">${esc(m.time.replace(':00', ''))}</td><td class="tm">${teamSpan(m.t1)} <span class="muted">vs</span> ${teamSpan(m.t2)}</td><td class="muted small">Work: ${esc(m.work)}</td></tr>`).join('');
    return `<section class="card pool">
      <div class="pool-head"><h2>Pool ${k}</h2><span class="muted small">${esc(VENUES[p.venue].short)} · Court ${p.court}</span></div>
      <ul class="pool-teams">${teams}</ul>
      <table><tbody>${games}</tbody></table>
    </section>`;
  }).join('') + `<p class="muted small center"><span class="dot gold">G</span> 1st &amp; 2nd in each pool play Gold at Valencia · <span class="dot purple">P</span> 3rd &amp; 4th play Purple at Golden Valley</p>`;
}

function renderBracket() {
  const d = derived.divisions[state.division];
  const seg = Object.values(DIVISIONS).map((x) =>
    `<button type="button" class="seg-btn ${x.key}${x.key === d.key ? ' on' : ''}" data-div="${x.key}">${x.name}</button>`).join('');
  const byN = (n) => PLAYOFF_MATCHES.find((m) => m.division === d.key && m.n === n);
  const col = (title, ns) => `<div class="round"><h3>${title}</h3><div class="round-body">${ns.map((n) => matchCard(byN(n), { showWhen: true })).join('')}</div></div>`;
  const seedSrc = {
    pending: 'Seeds fill in automatically once all 36 pool matches have scores.',
    auto: 'Seeded automatically from pool results.',
    override: `Seeds set by hand${state.seedOverrides[d.key]?.by ? ` by ${esc(state.seedOverrides[d.key].by)}` : ''}.`,
  }[d.source];
  const seedList = Array.from({ length: 12 }, (_, i) => {
    const t = d.seeds?.[i];
    return `<li${t && t === state.team ? ' class="me-row"' : ''}><span class="seed">${i + 1}</span>${t ? esc(t) : '<span class="tbd">—</span>'}</li>`;
  }).join('');
  const pl = d.places;
  const podium = pl.first ? `<section class="card podium ${d.key}">
      <div><small>Champion</small><b>🏆 ${esc(pl.first)}</b></div>
      <div><small>2nd</small><b>${esc(pl.second)}</b></div>
      <div><small>3rd</small><b>${esc(pl.third ?? 'TBD')}</b></div></section>` : '';
  return `<div class="seg" aria-label="Division">${seg}</div>
    <p class="venue-note">${esc(VENUES[d.venue].name)} · Courts ${d.courts.join(', ')} · single set to 25</p>
    ${podium}
    <div class="bracket ${d.key}">
      ${col('Opening round', [1, 2, 3, 4])}
      ${col('Quarterfinals', [6, 7, 9, 10])}
      ${col('Semifinals', [12, 13])}
      ${col('Championship', [15])}
    </div>
    <p class="muted small center swipe-hint">Swipe sideways to see every round →</p>
    <h2 class="section-title">Consolation &amp; 3rd place</h2>
    <div class="grid">${[5, 8, 11, 14, 16].map((n) => matchCard(byN(n), { showWhen: true, showRound: true })).join('')}</div>
    ${SCORING ? `<section class="card seeds">
      <div class="pool-head"><h2>${esc(d.name)} seeds</h2><button type="button" class="link-btn" data-edit-seeds="${d.key}">Edit seeds</button></div>
      <p class="muted small">${seedSrc}</p>
      <ol class="seed-list">${seedList}</ol>
    </section>` : `<p class="muted small center">Seeds 1–12 are set from pool results after pool play. Check with your coach or the bracket posted at the gym.</p>`}`;
}

function renderInfo() {
  const venues = Object.values(VENUES).map((v) => `<section class="card venue">
    <h2>${esc(v.name)}</h2>
    <p class="muted small">${esc(v.hosts)}</p>
    <div class="btn-row"><a class="btn" href="${esc(v.north)}" target="_blank" rel="noopener">Directions from the north</a><a class="btn" href="${esc(v.south)}" target="_blank" rel="noopener">Directions from the south</a></div>
    <p class="small">${esc(v.parking)}</p>
  </section>`).join('');
  return `<section class="card hero">
      <div class="kicker">${esc(EVENT.subtitle)}</div>
      <h2>${esc(EVENT.dateLabel)}</h2>
      <ul class="timeline">${EVENT.timeline.map((t) => `<li><b>${esc(t.time)}</b><span>${esc(t.label)}</span></li>`).join('')}</ul>
    </section>
    <section class="card tickets">
      <div class="pool-head"><h2>Tickets · ${esc(EVENT.tickets.price)}</h2></div>
      <ul class="bullets">${EVENT.tickets.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <a class="btn primary" href="${esc(EVENT.tickets.url)}" target="_blank" rel="noopener">Buy tickets</a>
    </section>
    ${venues}
    <section class="card">
      <h2>Format</h2>
      <ul class="bullets">${EVENT.format.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    </section>
    <section class="card">
      <h2>Questions</h2>
      <p><b>${esc(EVENT.contact.name)}</b><br><span class="muted small">${esc(EVENT.contact.role)}</span></p>
      <div class="btn-row"><a class="btn" href="tel:${esc(EVENT.contact.phone.replace(/\D/g, ''))}">Call ${esc(EVENT.contact.phone)}</a><a class="btn" href="mailto:${esc(EVENT.contact.email)}">Email</a></div>
    </section>
    ${SCORING ? `<section class="card">
      <h2>Entering scores</h2>
      <p class="small">Anyone can follow along. To enter a score, tap a match and sign in with Google or continue as a guest with your name. Your name is shown next to each score you enter. Scores entered with no signal are saved on your phone and sync when you’re back online.</p>
    </section>` : ''}
    <p class="muted small center">Unofficial parent site. The tournament director’s schedule is the official one.</p>`;
}

// ---------- render ----------

function render() {
  derive();
  const view = $('#view');
  const y = window.scrollY;
  const bracketScroll = $('.bracket')?.scrollLeft ?? 0;
  view.innerHTML = { schedule: renderSchedule, pools: renderPools, bracket: renderBracket, info: renderInfo }[state.tab]();
  if ($('.bracket')) $('.bracket').scrollLeft = bracketScroll;
  window.scrollTo(0, y);
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  const btn = $('#authBtn');
  btn.hidden = !SCORING;
  btn.textContent = state.user ? 'Sign out' : 'Sign in';
  btn.title = state.user ? `Signed in as ${byLine(state.user)}` : 'Sign in to enter scores';
}

function setTab(tab) {
  state.tab = tab;
  LS.set('vfsc26-tab', tab);
  render();
  window.scrollTo(0, 0);
}

// ---------- sheets ----------

const sheet = $('#sheet');
function openSheet(html, onReady) {
  sheet.innerHTML = `<form method="dialog" class="sheet-inner">${html}</form>`;
  sheet.showModal();
  onReady?.(sheet);
}
function closeSheet() { sheet.close(); }
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

// Action to resume after a successful sign-in (e.g. reopen the score sheet).
let afterSignIn = null;

function signInPrompt(msg) {
  const methods = state.store?.signInMethods ?? ['google'];
  const buttons = [];
  if (methods.includes('google')) buttons.push('<button type="button" class="btn primary" data-signin="google">Sign in with Google</button>');
  if (methods.includes('apple')) buttons.push('<button type="button" class="btn apple" data-signin="apple"> Sign in with Apple</button>');
  const guest = methods.includes('guest')
    ? `<div class="or"><span>or</span></div>
       <label class="name-field"><span>Your name</span><input name="personName" maxlength="40" autocomplete="name" placeholder="e.g. Jamie (Canyon parent)"></label>
       <button type="button" class="btn" data-guest>Continue as guest</button>
       <p class="muted small">Guest scores are labeled “(guest)”.</p>`
    : '';
  return `<div class="signin-box"><p>${esc(msg)}</p>${buttons.join('')}${guest}<p class="err" role="alert"></p></div>`;
}

function namePrompt() {
  return `<div class="signin-box"><p>What name should show next to scores you enter?</p>
    <label class="name-field"><span>Your name</span><input name="personName" maxlength="40" autocomplete="name" placeholder="e.g. Jamie (Canyon parent)"></label>
    <button type="button" class="btn primary" data-setname>Save name</button><p class="err" role="alert"></p></div>`;
}

/** Returns true if the user can edit now; otherwise shows sign-in (or name) and resumes `resume` afterwards. */
function requireEditor(title, resume) {
  if (state.user?.name) return true;
  afterSignIn = resume;
  openSheet(`<h2>${esc(title)}</h2>${state.user ? namePrompt() : signInPrompt('Anyone can view scores. Sign in to enter or fix one.')}`, (el) => {
    const input = $('[name=personName]', el);
    // Enter in the name field acts like the name/guest button instead of closing the dialog.
    $('form', el).addEventListener('submit', (e) => {
      e.preventDefault();
      $('[data-setname],[data-guest]', el)?.click();
    });
    if (state.user) input?.focus();
  });
  return false;
}

function openScoreSheet(id) {
  const m = POOL_MATCHES.find((x) => x.id === id) || PLAYOFF_MATCHES.find((x) => x.id === id);
  const s = sides(m);
  if (m.kind === 'playoff' && !(s.a && s.b)) return;
  const existing = state.scores[id]?.sets ?? [];
  const nSets = m.kind === 'pool' ? 3 : 1;
  const inputs = Array.from({ length: nSets }, (_, i) => {
    const v = existing[i] ?? ['', ''];
    return `<div class="set-row"><span class="set-label">${m.kind === 'pool' ? `Set ${i + 1}${i === 2 ? ' <small>(if needed)</small>' : ''}` : 'Score'}</span>
      <input inputmode="numeric" pattern="[0-9]*" maxlength="2" name="a${i}" value="${esc(v[0])}" aria-label="${esc(s.a)} set ${i + 1}">
      <input inputmode="numeric" pattern="[0-9]*" maxlength="2" name="b${i}" value="${esc(v[1])}" aria-label="${esc(s.b)} set ${i + 1}">
    </div>`;
  }).join('');
  if (!requireEditor(`${matchLabel(m)} · ${s.a} vs ${s.b}`, () => openScoreSheet(id))) return;
  const body = `<div class="set-row head"><span></span><span class="tn">${esc(s.a)}</span><span class="tn">${esc(s.b)}</span></div>
       ${inputs}
       <label class="final-box"><input type="checkbox" name="final" ${isFinal(state.scores[id]) ? 'checked' : ''}> <span><b>Match is final</b><br><small class="muted">Leave unchecked to save the score so far. Standings and the bracket update once it’s final.</small></span></label>
       <p class="err" role="alert"></p>
       <div class="btn-row">
         ${existing.length ? '<button type="button" class="btn danger" data-clear>Clear score</button>' : ''}
         <button type="button" class="btn" data-cancel>Cancel</button>
         <button type="submit" class="btn primary">Save</button>
       </div>
       <p class="muted small">Signed in as ${esc(byLine(state.user))}. Your name will show next to this score.</p>`;
  openSheet(`<h2>${esc(matchLabel(m))} · ${esc(m.time)} · ${esc(VENUES[m.venue].short)} Court ${m.court}</h2>
    <p class="vs">${teamSpan(s.a, s.aPh)} <span class="muted">vs</span> ${teamSpan(s.b, s.bPh)}</p>${body}`, (el) => {
    const form = $('form', el);
    $('input', el)?.focus();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const sets = [];
      for (let i = 0; i < nSets; i++) {
        const a = form[`a${i}`].value.trim();
        const b = form[`b${i}`].value.trim();
        if (a === '' && b === '') continue;
        sets.push([Number(a || 0), Number(b || 0)]);
      }
      const final = form.final.checked;
      const err = validateSets(m.kind, sets, final);
      if (err) { $('.err', el).textContent = err; return; }
      save(() => state.store.saveScore(id, sets, final));
    });
    $('[data-clear]', el)?.addEventListener('click', () => {
      if (confirm('Clear this score?')) save(() => state.store.clearScore(id));
    });
  });
}

function openSeedSheet(divKey) {
  const d = derived.divisions[divKey];
  if (!requireEditor(`Edit ${d.name} seeds`, () => openSeedSheet(divKey))) return;
  const current = d.seeds ?? [];
  // Suggest the teams that finished in this division's ranks first.
  const eligible = Object.values(derived.standings).every((s) => s.complete)
    ? Object.values(derived.standings).flatMap((s) => d.ranks.map((r) => s.rows[r - 1].team))
    : [];
  const options = (sel) => `<option value="">—</option>` +
    (eligible.length ? `<optgroup label="${esc(d.name)} teams">${eligible.sort().map((t) => `<option${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('')}</optgroup>` : '') +
    `<optgroup label="All teams">${ALL_TEAMS.filter((t) => !eligible.includes(t)).map((t) => `<option${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('')}</optgroup>`;
  const rows = Array.from({ length: 12 }, (_, i) =>
    `<label class="seed-row"><span class="seed">${i + 1}</span><select name="s${i}">${options(current[i])}</select></label>`).join('');
  openSheet(`<h2>Edit ${esc(d.name)} seeds</h2>
    <p class="muted small">Your seeds replace the automatic ones and stay put even if a pool score changes. Use “Reset to automatic” to undo.</p>
    <div class="seed-grid">${rows}</div>
    <p class="err" role="alert"></p>
    <div class="btn-row">
      ${d.source === 'override' ? '<button type="button" class="btn danger" data-reset>Reset to automatic</button>' : ''}
      <button type="button" class="btn" data-cancel>Cancel</button>
      <button type="submit" class="btn primary">Save seeds</button>
    </div>`, (el) => {
    const form = $('form', el);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const order = Array.from({ length: 12 }, (_, i) => form[`s${i}`].value);
      if (order.some((t) => !t)) { $('.err', el).textContent = 'Pick a team for all 12 seeds.'; return; }
      if (new Set(order).size !== 12) { $('.err', el).textContent = 'Each team can only have one seed.'; return; }
      save(() => state.store.saveSeeds(divKey, order));
    });
    $('[data-reset]', el)?.addEventListener('click', () => save(() => state.store.clearSeeds(divKey)));
  });
}

// Writes are optimistic: Firestore applies them locally at once (and queues offline),
// so close the sheet immediately and only surface a rejection.
function save(fn) {
  try {
    const p = fn();
    closeSheet();
    Promise.resolve(p).catch((err) => toast(`Couldn’t save: ${err.message}`));
  } catch (err) {
    const box = $('.err', sheet);
    if (box) box.textContent = err.message;
  }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 5000);
}

const SIGNIN_ERRORS = {
  'auth/operation-not-allowed': 'That sign-in option isn’t turned on yet.',
  'auth/admin-restricted-operation': 'That sign-in option isn’t turned on yet.',
  'auth/unauthorized-domain': 'Sign-in isn’t set up for this web address yet.',
  'auth/network-request-failed': 'No connection. Try again when you have signal.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
};

async function signIn(method, name) {
  try {
    await state.store.signIn(method, name);
    const next = afterSignIn;
    afterSignIn = null;
    if (sheet.open) closeSheet();
    if (next && state.user?.name) next();
    else if (next) requireEditor('One more thing', next);
  } catch (err) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
    const msg = SIGNIN_ERRORS[err?.code] ?? `Sign-in failed: ${err.message}`;
    const box = $('.err', sheet);
    if (sheet.open && box) box.textContent = msg; else toast(msg);
  }
}

function nameFromSheet() {
  const v = $('[name=personName]', sheet)?.value.trim() ?? '';
  if (v.length < 2) { $('.err', sheet).textContent = 'Please enter your name.'; return null; }
  return v;
}

async function setName() {
  const name = nameFromSheet();
  if (!name) return;
  try {
    await state.store.setName(name);
    const next = afterSignIn;
    afterSignIn = null;
    closeSheet();
    next?.();
  } catch (err) {
    $('.err', sheet).textContent = `Couldn’t save your name: ${err.message}`;
  }
}

// ---------- events ----------

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-venue],[data-div],[data-match],[data-edit-seeds],[data-goto],[data-signin],[data-guest],[data-setname],[data-cancel]');
  if (!t) return;
  if (t.dataset.tab) setTab(t.dataset.tab);
  else if (t.dataset.goto) { e.preventDefault(); setTab(t.dataset.goto); }
  else if (t.dataset.venue) { state.venue = t.dataset.venue; LS.set('vfsc26-venue', state.venue); render(); }
  else if (t.dataset.div) { state.division = t.dataset.div; LS.set('vfsc26-div', state.division); render(); }
  else if (t.dataset.match) { if (t.getAttribute('aria-disabled') !== 'true') openScoreSheet(t.dataset.match); }
  else if (t.dataset.editSeeds) openSeedSheet(t.dataset.editSeeds);
  else if (t.dataset.signin) signIn(t.dataset.signin);
  else if ('guest' in t.dataset) { const name = nameFromSheet(); if (name) signIn('guest', name); }
  else if ('setname' in t.dataset) setName();
  else if ('cancel' in t.dataset) closeSheet();
});

$('#authBtn').addEventListener('click', () => {
  if (state.user) { if (confirm(`Sign out ${byLine(state.user)}?`)) state.store.signOut(); }
  else requireEditor('Sign in to enter scores', null);
});

const pick = $('#teamPick');
pick.innerHTML = `<option value="">Everyone</option>` + Object.entries(POOLS).map(([k, p]) =>
  `<optgroup label="Pool ${k}">${[...p.teams].sort().map((t) => `<option>${esc(t)}</option>`).join('')}</optgroup>`).join('');
pick.value = state.team;
pick.addEventListener('change', () => {
  state.team = pick.value;
  LS.set('vfsc26-team', state.team);
  state.venue = '';
  LS.set('vfsc26-venue', '');
  render();
});

function updateBanner() {
  const b = $('#banner');
  const msgs = [];
  if (state.store?.mode === 'demo') msgs.push('<b>Demo mode:</b> scores are saved only on this device until Firebase is connected.');
  if (!navigator.onLine) msgs.push('<b>Offline:</b> showing the last scores we saw. New scores will sync when you reconnect.');
  b.hidden = msgs.length === 0;
  b.innerHTML = msgs.join('<br>');
}
window.addEventListener('online', updateBanner);
window.addEventListener('offline', updateBanner);

// ---------- boot ----------

render();
setInterval(render, 60_000); // refresh "x min ago" and Now markers

if (SCORING) createStore().then((store) => {
  state.store = store;
  updateBanner();
  store.onUser((u) => { state.user = u; render(); });
  store.onData(({ scores, seeds }) => {
    state.scores = normalizeScores(scores);
    state.seedOverrides = seeds;
    if (!sheet.open) render();
    else pendingRender = true;
  });
});

let pendingRender = false;
sheet.addEventListener('close', () => { if (pendingRender) { pendingRender = false; render(); } });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
