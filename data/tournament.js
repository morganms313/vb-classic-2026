// Static tournament facts, transcribed from
// references/2026 Valencia Frosh-Soph Classic Schedule.pdf
// Only scores and seed overrides live in the database; everything else is here.

export const EVENT = {
  name: 'Valencia Frosh-Soph Classic',
  subtitle: "23rd Annual · Girls' Volleyball",
  date: '2026-09-26',
  dateLabel: 'Saturday, September 26, 2026',
  timeline: [
    { time: '7:00 AM', label: 'Teams check in' },
    { time: '7:30 AM', label: 'Spectator doors open · coaches’ & officials’ meeting' },
    { time: '8:00 AM', label: 'Pool play begins' },
    { time: '1:00 PM', label: 'Last pool round' },
    { time: '3:00 PM', label: 'Gold & Purple playoffs begin' },
    { time: '6:00 PM', label: 'Awards (Valencia)' },
  ],
  tickets: {
    url: 'https://www.zeffy.com/en-US/ticketing/valencia-classic-volleyball-tournaments',
    price: '$10',
    notes: [
      'Cashless — buy online before you arrive (gym WiFi is spotty)',
      'Kids 5 & under and seniors 65+ are free',
      'One ticket covers all three gyms for the whole day',
    ],
  },
  contact: {
    name: 'Jim Shiraishi',
    role: 'Tournament Director · Lady Vikings Volleyball Boosters',
    email: 'jlda5678@aol.com',
    phone: '661-478-8980',
    classicEmail: 'ladyvikingsvbclassic@gmail.com',
  },
  format: [
    'Six pools of four. Every team plays three best-of-three pool matches and works (refs) matches too.',
    '1st & 2nd in each pool → Gold Division playoffs at Valencia.',
    '3rd & 4th in each pool → Purple Division playoffs at Golden Valley.',
    'Playoffs are single elimination, one set to 25, with consolation matches and a 3rd-place match.',
  ],
};

export const VENUES = {
  VHS: {
    name: 'Valencia High School',
    short: 'Valencia',
    north: 'https://maps.app.goo.gl/jYy8uPLQrHUGuNMg8',
    south: 'https://maps.app.goo.gl/bK5wWYTGbX287zAJ8',
    parking: 'From Smyth Drive, turn northeast into the student lot. The gym is visible from the lot.',
    hosts: 'Pools A & B (Courts 1–2) · Gold playoffs (Courts 1–3) · Awards',
  },
  GVHS: {
    name: 'Golden Valley High School',
    short: 'Golden Valley',
    north: 'https://maps.app.goo.gl/WRUJ717jT4cCz5y47',
    south: 'https://maps.app.goo.gl/G8r1o93vdZSp3Gr26',
    parking:
      'From Golden Valley Road, turn north onto Robert C. Lee Parkway, go all the way to the end (before the mountain), turn left, and follow the northernmost lane of the parking lot to the gym.',
    hosts: 'Pools C & D (Courts 4–5) · Purple playoffs (Courts 4–6)',
  },
  CHS: {
    name: 'Castaic High School',
    short: 'Castaic',
    north: 'https://maps.app.goo.gl/aSMfQ8KBtohkU2vf7',
    south: 'https://maps.app.goo.gl/6MF8hoMuZEoKLNbJ8',
    parking:
      'Canyon Hills Road ends at the school entrance. Enter the driveway and turn left into the parking lot. The gym is to your right, up a short flight of stairs.',
    hosts: 'Pools E & F (Courts 7–8)',
  },
};

export const POOLS = {
  A: { venue: 'VHS', court: 1, teams: ['Valencia', 'Birmingham', 'SCCS', 'Santa Paula'] },
  B: { venue: 'VHS', court: 2, teams: ['Canyon', 'Kennedy', 'Trinity', 'Newbury Park'] },
  C: { venue: 'GVHS', court: 4, teams: ['Golden Valley', 'Granada Hills', 'Providence', 'Royal'] },
  D: { venue: 'GVHS', court: 5, teams: ['Saugus', 'Buena', 'Quartz Hill', 'Moorpark'] },
  E: { venue: 'CHS', court: 7, teams: ['Castaic', 'El Camino Real', 'Alemany 1', 'Rosamond'] },
  F: { venue: 'CHS', court: 8, teams: ['Burroughs', 'Ventura', 'Alemany 2', 'Village Christian'] },
};

const POOL_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'];

// [team1, team2, working] per time slot, verbatim from the flyer.
const POOL_ROWS = {
  A: [
    ['Valencia', 'SCCS', 'Santa Paula'],
    ['Birmingham', 'Santa Paula', 'SCCS'],
    ['Valencia', 'Santa Paula', 'Birmingham'],
    ['Birmingham', 'SCCS', 'Santa Paula'],
    ['SCCS', 'Santa Paula', 'Valencia'],
    ['Valencia', 'Birmingham', 'SCCS'],
  ],
  B: [
    ['Canyon', 'Trinity', 'Newbury Park'],
    ['Kennedy', 'Newbury Park', 'Trinity'],
    ['Canyon', 'Newbury Park', 'Kennedy'],
    ['Kennedy', 'Trinity', 'Newbury Park'],
    ['Trinity', 'Newbury Park', 'Canyon'],
    ['Canyon', 'Kennedy', 'Trinity'],
  ],
  C: [
    ['Golden Valley', 'Providence', 'Royal'],
    ['Granada Hills', 'Royal', 'Providence'],
    ['Golden Valley', 'Royal', 'Granada Hills'],
    ['Granada Hills', 'Providence', 'Royal'],
    ['Providence', 'Royal', 'Golden Valley'],
    ['Golden Valley', 'Granada Hills', 'Providence'],
  ],
  D: [
    ['Saugus', 'Quartz Hill', 'Moorpark'],
    ['Buena', 'Moorpark', 'Quartz Hill'],
    ['Saugus', 'Moorpark', 'Buena'],
    ['Buena', 'Quartz Hill', 'Moorpark'],
    ['Quartz Hill', 'Moorpark', 'Saugus'],
    ['Saugus', 'Buena', 'Quartz Hill'],
  ],
  E: [
    ['Castaic', 'Alemany 1', 'Rosamond'],
    ['El Camino Real', 'Rosamond', 'Alemany 1'],
    ['Castaic', 'Rosamond', 'El Camino Real'],
    ['El Camino Real', 'Alemany 1', 'Rosamond'],
    ['Alemany 1', 'Rosamond', 'Castaic'],
    ['Castaic', 'El Camino Real', 'Alemany 1'],
  ],
  F: [
    ['Burroughs', 'Alemany 2', 'Village Christian'],
    ['Ventura', 'Village Christian', 'Alemany 2'],
    ['Burroughs', 'Village Christian', 'Ventura'],
    ['Ventura', 'Alemany 2', 'Village Christian'],
    ['Alemany 2', 'Village Christian', 'Burroughs'],
    ['Burroughs', 'Ventura', 'Alemany 2'],
  ],
};

export const POOL_MATCHES = Object.entries(POOL_ROWS).flatMap(([pool, rows]) =>
  rows.map(([t1, t2, work], i) => ({
    id: `${pool}${i + 1}`,
    kind: 'pool',
    pool,
    venue: POOLS[pool].venue,
    court: POOLS[pool].court,
    time: POOL_TIMES[i],
    slot: i,
    t1,
    t2,
    work,
  })),
);

// Bracket template, identical for Gold and Purple.
// Refs: S<n> = seed n, W<n>/L<n> = winner/loser of match n in the same division.
// courtIdx 0/1/2 → Gold courts 1/2/3, Purple courts 4/5/6.
const BRACKET = [
  { n: 1, time: '3:00 PM', courtIdx: 0, t1: 'S8', t2: 'S9', work: 'S1', round: 'Opening round' },
  { n: 2, time: '3:00 PM', courtIdx: 1, t1: 'S5', t2: 'S12', work: 'S4', round: 'Opening round' },
  { n: 3, time: '3:30 PM', courtIdx: 0, t1: 'S7', t2: 'S10', work: 'S2', round: 'Opening round' },
  { n: 4, time: '3:30 PM', courtIdx: 1, t1: 'S6', t2: 'S11', work: 'S3', round: 'Opening round' },
  { n: 5, time: '3:30 PM', courtIdx: 2, t1: 'L1', t2: 'L2', work: 'W1', round: 'Consolation' },
  { n: 6, time: '4:00 PM', courtIdx: 0, t1: 'S1', t2: 'W1', work: 'S2', round: 'Quarterfinal' },
  { n: 7, time: '4:00 PM', courtIdx: 1, t1: 'S4', t2: 'W2', work: 'S3', round: 'Quarterfinal' },
  { n: 8, time: '4:00 PM', courtIdx: 2, t1: 'L3', t2: 'L4', work: 'W5', round: 'Consolation' },
  { n: 9, time: '4:30 PM', courtIdx: 0, t1: 'S2', t2: 'W3', work: 'W6', round: 'Quarterfinal' },
  { n: 10, time: '4:30 PM', courtIdx: 1, t1: 'S3', t2: 'W4', work: 'W7', round: 'Quarterfinal' },
  { n: 11, time: '4:30 PM', courtIdx: 2, t1: 'L6', t2: 'L7', work: 'W8', round: 'Consolation' },
  { n: 12, time: '5:00 PM', courtIdx: 0, t1: 'W6', t2: 'W7', work: 'L6', round: 'Semifinal' },
  { n: 13, time: '5:00 PM', courtIdx: 1, t1: 'W9', t2: 'W10', work: 'L10', round: 'Semifinal',
    note: 'Flyer lists the Match 10 loser as working, but that team also plays Match 14 at 5:00. Check with the director.' },
  { n: 14, time: '5:00 PM', courtIdx: 2, t1: 'L9', t2: 'L10', work: 'W11', round: 'Consolation' },
  { n: 15, time: '5:30 PM', courtIdx: 0, t1: 'W12', t2: 'W13', work: 'L12', round: 'Championship',
    note: 'Flyer lists the Match 12 loser as working, but that team also plays the 3rd-place match at 5:30. Check with the director.' },
  { n: 16, time: '5:30 PM', courtIdx: 2, t1: 'L12', t2: 'L13', work: 'W14', round: '3rd place' },
];

export const DIVISIONS = {
  gold: { key: 'gold', name: 'Gold', prefix: 'G', venue: 'VHS', courts: [1, 2, 3], ranks: [1, 2] },
  // Flyer bracket page says Courts 1–3 for Purple; the schedule table says 4–6. Using 4–6.
  purple: { key: 'purple', name: 'Purple', prefix: 'P', venue: 'GVHS', courts: [4, 5, 6], ranks: [3, 4] },
};

export const PLAYOFF_MATCHES = Object.values(DIVISIONS).flatMap((d) =>
  BRACKET.map((b) => ({
    id: `${d.prefix}${b.n}`,
    kind: 'playoff',
    division: d.key,
    n: b.n,
    venue: d.venue,
    court: d.courts[b.courtIdx],
    time: b.time,
    round: b.round,
    t1: b.t1,
    t2: b.t2,
    work: b.work,
    note: b.note,
  })),
);

export const ALL_TEAMS = Object.values(POOLS)
  .flatMap((p) => p.teams)
  .sort((a, b) => a.localeCompare(b));

export const TIME_ORDER = [...POOL_TIMES, '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'];
