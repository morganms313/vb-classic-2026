// Data + auth layer. Firestore when configured, otherwise a local demo store
// (localStorage + BroadcastChannel so multiple tabs on one device stay in sync).
//
// Interface:
//   store.mode                      'live' | 'demo'
//   store.onData(cb)                cb({scores, seeds}) on every change
//   store.signInMethods            e.g. ['google', 'apple', 'guest'] (from firebase-config.js)
//   store.onUser(cb)                cb(user|null), user = {name, email, guest}
//   store.signIn(method, name?)     method: 'google' | 'apple' | 'guest' (guest requires name)
//   store.setName(name)             for accounts with no display name (e.g. Apple with hidden name)
//   store.signOut()
//   store.saveScore(id, sets, final) / store.clearScore(id)
//   store.saveSeeds(div, order)     / store.clearSeeds(div)

import { firebaseConfig, signInMethods } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.3.0';
const isConfigured = !firebaseConfig.apiKey.startsWith('PASTE');

export async function createStore() {
  if (isConfigured) {
    try {
      return await firestoreStore();
    } catch (err) {
      console.error('Firebase failed to load, falling back to demo mode', err);
    }
  }
  return demoStore();
}

async function firestoreStore() {
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-firestore.js`),
    import(`${SDK}/firebase-auth.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  const auth = au.getAuth(app);
  const data = { scores: {}, seeds: {} };
  const listeners = [];
  const emit = () => listeners.forEach((cb) => cb(data));
  const toMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now());

  const watch = (col, key) =>
    fs.onSnapshot(fs.collection(db, col), (snap) => {
      const next = {};
      snap.forEach((d) => {
        const v = d.data({ serverTimestamps: 'estimate' });
        next[d.id] = { ...v, updatedAt: toMs(v.updatedAt), pending: d.metadata.hasPendingWrites };
      });
      data[key] = next;
      emit();
    }, (err) => console.error(`${col} listener`, err));
  watch('scores', 'scores');
  watch('seeds', 'seeds');

  let user = null;
  let userCb = () => {};
  const toUser = (u) => (u ? { name: u.displayName || '', email: u.email || '', guest: u.isAnonymous } : null);
  const stamp = () => ({ by: byLine(user), uid: auth.currentUser.uid, updatedAt: fs.serverTimestamp() });
  const requireUser = () => {
    if (!auth.currentUser) throw new Error('Sign in with Google to make changes.');
  };

  return {
    mode: 'live',
    onData(cb) { listeners.push(cb); cb(data); },
    signInMethods,
    onUser(cb) {
      userCb = cb;
      au.onAuthStateChanged(auth, (u) => { user = toUser(u); cb(user); });
    },
    async signIn(method, name) {
      if (method === 'guest') {
        const cred = await au.signInAnonymously(auth);
        await au.updateProfile(cred.user, { displayName: name });
      } else {
        const provider = method === 'apple' ? new au.OAuthProvider('apple.com') : new au.GoogleAuthProvider();
        if (method === 'apple') { provider.addScope('email'); provider.addScope('name'); }
        await au.signInWithPopup(auth, provider);
      }
      user = toUser(auth.currentUser);
      userCb(user);
    },
    async setName(name) {
      await au.updateProfile(auth.currentUser, { displayName: name });
      user = toUser(auth.currentUser);
      userCb(user);
    },
    signOut: () => au.signOut(auth),
    // Writes resolve on server ack; offline they queue, so don't await them in the UI.
    saveScore(id, sets, final) {
      requireUser();
      // Firestore can't store nested arrays; store sets as [{a,b}, …].
      return fs.setDoc(fs.doc(db, 'scores', id), { sets: sets.map(([a, b]) => ({ a, b })), final: !!final, ...stamp() });
    },
    clearScore(id) { requireUser(); return fs.deleteDoc(fs.doc(db, 'scores', id)); },
    saveSeeds(div, order) { requireUser(); return fs.setDoc(fs.doc(db, 'seeds', div), { order, ...stamp() }); },
    clearSeeds(div) { requireUser(); return fs.deleteDoc(fs.doc(db, 'seeds', div)); },
  };
}

function demoStore() {
  const KEY = 'vfsc26-demo';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { scores: {}, seeds: {} }; }
    catch { return { scores: {}, seeds: {} }; }
  };
  let data = read();
  const listeners = [];
  const userListeners = [];
  let user = null;
  let bc = null;
  try { bc = new BroadcastChannel(KEY); } catch { /* unsupported */ }
  const emit = () => listeners.forEach((cb) => cb(data));
  const commit = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
    bc?.postMessage('changed');
    emit();
  };
  if (bc) bc.onmessage = () => { data = read(); emit(); };
  const requireUser = () => { if (!user) throw new Error('Sign in to make changes.'); };
  const stamp = () => ({ by: byLine(user), updatedAt: Date.now() });

  return {
    mode: 'demo',
    onData(cb) { listeners.push(cb); cb(data); },
    signInMethods,
    onUser(cb) { userListeners.push(cb); cb(user); },
    async signIn(method, name) {
      user = { name: method === 'guest' ? name : 'Demo scorekeeper', email: '', guest: method === 'guest' };
      userListeners.forEach((cb) => cb(user));
    },
    async setName(name) { user = { ...user, name }; userListeners.forEach((cb) => cb(user)); },
    async signOut() { user = null; userListeners.forEach((cb) => cb(user)); },
    async saveScore(id, sets, final) { requireUser(); data.scores[id] = { sets: sets.map(([a, b]) => ({ a, b })), final: !!final, ...stamp() }; commit(); },
    async clearScore(id) { requireUser(); delete data.scores[id]; commit(); },
    async saveSeeds(div, order) { requireUser(); data.seeds[div] = { order, ...stamp() }; commit(); },
    async clearSeeds(div) { requireUser(); delete data.seeds[div]; commit(); },
  };
}

/** Name shown next to a score. Guests are labeled; firestore.rules enforces the suffix. */
export function byLine(user) {
  if (!user) return '';
  const name = (user.name || user.email || 'Parent').slice(0, 60);
  return user.guest ? `${name} (guest)` : name;
}

/** Convert stored [{a,b}] sets back to [[a,b]] for logic.js. */
export function normalizeScores(scores) {
  return Object.fromEntries(
    Object.entries(scores).map(([id, v]) => [id, { ...v, sets: (v.sets || []).map((s) => [s.a, s.b]) }]),
  );
}
