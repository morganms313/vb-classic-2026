# Valencia Frosh-Soph Classic 2026 — Parent Site

Mobile-friendly schedule, live scores, pool standings, and Gold/Purple brackets for the
Sept 26, 2026 tournament. Anyone can view; signing in with Google is required to enter scores.

Static site (no build step) + Firebase (Firestore + Google sign-in), hosted on GitHub Pages.
Design: [docs/superpowers/specs/2026-09-21-parent-tourney-site-design.md](docs/superpowers/specs/2026-09-21-parent-tourney-site-design.md)

## Run locally

```
npm run serve     # http://localhost:8080
npm test          # standings / seeding / bracket logic
```

Until `js/firebase-config.js` has a real config the site runs in **demo mode** (scores saved in
this browser only). Add `?now=2026-09-26T09:15` to the URL to preview "Now" markers.

## Firebase setup (one time)

1. console.firebase.google.com → **Add project** (Analytics off).
2. **Build → Firestore Database → Create database** → production mode, region `us-west2` (or any US).
3. **Firestore → Rules**: paste `firestore.rules` → Publish.
4. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
5. **Authentication → Settings → Authorized domains → Add** `morganms313.github.io`.
6. **Project settings → Your apps → Web (`</>`)** → register → copy the `firebaseConfig` values into `js/firebase-config.js`.

## Lock editing to named scorekeepers later

In `firestore.rules`, change `isEditor()` to check an email allowlist (example in the file), publish.

## Files

- `data/tournament.js` — teams, pools, schedules, bracket, venues (transcribed from the flyer PDF)
- `js/logic.js` — pure standings / seeding / bracket resolution (unit tested)
- `js/store.js` — Firestore + auth, or local demo store
- `js/app.js`, `css/style.css`, `index.html` — UI
- `sw.js` — offline app shell
- `firestore.rules` — database security rules

When changing site files, bump `CACHE` in `sw.js` so phones pick up the new version.
