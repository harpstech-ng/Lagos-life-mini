import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, onSnapshot, updateDoc, increment,
  serverTimestamp, collection, addDoc, query, where, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs",
  authDomain: "lagos-life-a8706.firebaseapp.com",
  projectId: "lagos-life-a8706",
  storageBucket: "lagos-life-a8706.firebasestorage.app",
  messagingSenderId: "187884589425",
  appId: "1:187884589425:web:07383ff1a19edbb751a6d0",
  measurementId: "G-DDMJTH2WY7"
};

const fbApp = initializeApp(firebaseConfig);
export const db = getFirestore(fbApp);
export const auth = getAuth(fbApp);

export async function bootstrapAuth() {
  const tg = window.Telegram?.WebApp;
  if (!tg) throw new Error("Open this inside Telegram");
  tg.ready(); tg.expand();

  if (auth.currentUser) return auth.currentUser;
  const initData = tg.initData;
  if (!initData) throw new Error("No initData — open inside Telegram");

  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  if (!res.ok) throw new Error("Auth failed");
  const { token, uid } = await res.json();
  
  const cred = await signInWithCustomToken(auth, token);
  sessionStorage.setItem("fb_uid", uid);
  return cred.user;
}

export function getUid() { return sessionStorage.getItem("fb_uid"); }

export function watchUser(uid, onChange) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (snap.exists()) onChange({ id: snap.id, ...snap.data() });
  });
}

export async function tapHustle(uid, amount) {
  return updateDoc(doc(db, "users", uid), {
    cash: increment(amount), energy: increment(-1), taps: increment(1), lastSeen: serverTimestamp(),
  });
}

export async function sendMoneyToUser(fromUid, toUsername, amount) {
  const clean = toUsername.replace(/^@/, "");
  const snap = await getDocs(query(collection(db, "users"), where("username", "==", clean)));
  if (snap.empty) throw new Error("Username not found");
  
  const recipient = snap.docs[0];
  if (recipient.id === fromUid) throw new Error("Cannot send to yourself");

  await updateDoc(doc(db, "users", fromUid), { cash: increment(-amount) });
  await updateDoc(recipient.ref, { cash: increment(amount) });

  fetch("/api/notify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "transfer", amount, toTelegramId: recipient.data().telegramId, fromTelegramId: Number(fromUid) })
  });
  return recipient.data().displayName || recipient.data().username;
}

export const fmt = (n) => {
  n = Math.floor(n || 0);
  if (n >= 1e12) return "₦" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return "₦" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "₦" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "₦" + (n / 1e3).toFixed(1) + "K";
  return "₦" + n.toLocaleString();
};
export const fmtReal = (n) => "₦" + (n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ═══════════════════════════════════════════════════════════
   AUDIO ENGINE (Afrobeat + SFX)
   ═══════════════════════════════════════════════════════════ */
export const AudioEngine = (() => {
  let ctx = null; let musicGain, sfxGain, musicPlaying = false, musicTimer, step = 0;
  const STEP_MS = 300;
  const bassPattern = [65.41, null, 65.41, null, 73.42, null, 87.31, null];
  const penta = [523.25, 587.33, 659.25, 783.99, 880.0];

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    let master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.15; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
  }
  function tone(f, d, t, dest, w=0, g=0.3) {
    if (!ctx) return; const start = ctx.currentTime + w;
    const o = ctx.createOscillator(), gain = ctx.createGain();
    o.type = t; o.frequency.value = f;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(g, start+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start+d);
    o.connect(gain); gain.connect(dest); o.start(start); o.stop(start+d+0.05);
  }
  function kick() { if(!ctx) return; const t=ctx.currentTime; const o=ctx.createOscillator(), g=ctx.createGain(); o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(40,t+0.14); g.gain.setValueAtTime(0.8,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t+0.22); }
  function hat() { if(!ctx) return; const t=ctx.currentTime; const b=ctx.createBuffer(1, ctx.sampleRate*0.04, ctx.sampleRate); const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; const s=ctx.createBufferSource(); s.buffer=b; const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=6000; const g=ctx.createGain(); g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.04); s.connect(hp); hp.connect(g); g.connect(musicGain); s.start(t); }
  
  function tick() {
    if (!musicPlaying) return;
    const s = step % 8;
    if (s===0||s===3||s===4) kick();
    hat();
    if (bassPattern[s]) tone(bassPattern[s], 0.3, "sine", musicGain, 0, 0.4);
    if (s===2||s===6) [329.63,415.3,493.88].forEach(f => tone(f, 0.3, "triangle", musicGain, 0, 0.06));
    step++;
  }

  return {
    startMusic: () => { init(); if(ctx.state==="suspended") ctx.resume(); if(musicPlaying) return; musicPlaying=true; tick(); musicTimer=setInterval(tick, STEP_MS); },
    stopMusic: () => { musicPlaying=false; clearInterval(musicTimer); },
    toggle: () => { musicPlaying ? AudioEngine.stopMusic() : AudioEngine.startMusic(); return musicPlaying; },
    tap: () => { init(); if(ctx.state==="suspended") ctx.resume(); tone(880, 0.09, "triangle", sfxGain, 0, 0.28); },
    coin: () => { init(); tone(1046, 0.08, "square", sfxGain, 0, 0.15); tone(1318, 0.15, "square", sfxGain, 0.07, 0.15); },
    error: () => { init(); tone(220, 0.15, "sawtooth", sfxGain, 0, 0.25); tone(165, 0.25, "sawtooth", sfxGain, 0.1, 0.25); },
    purchase: () => { init(); tone(523, 0.1, "triangle", sfxGain, 0, 0.2); tone(659, 0.1, "triangle", sfxGain, 0.07, 0.2); tone(783, 0.2, "triangle", sfxGain, 0.14, 0.2); },
    isPlaying: () => musicPlaying
  };
})();