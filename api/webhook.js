import { Telegraf, Markup } from "telegraf";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs",
  authDomain: "lagos-life-a8706.firebaseapp.com",
  projectId: "lagos-life-a8706",
  storageBucket: "lagos-life-a8706.firebasestorage.app",
  messagingSenderId: "187884589425",
  appId: "1:187884589425:web:07383ff1a19edbb751a6d0",
  measurementId: "G-DDMJTH2WY7"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

const bot = new Telegraf(process.env.BOT_TOKEN);

async function ensureAuth() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}

bot.start(async (ctx) => {
  try {
    await ensureAuth(); // Login to Firebase
    const tgId = String(ctx.from.id);
    const userRef = doc(db, "users", tgId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      const defaultData = {
        name: ctx.from.first_name || 'Aje Butler',
        username: ctx.from.username || '',
        telegramId: ctx.from.id,
        cash: 25000, real: 0, energy: 100, lastEnergy: Date.now(),
        businesses: {}, assets: {}, travels: [], street: {},
        taps: 0, clout: 0, goldName: false, lastSeen: Date.now(),
      };
      await setDoc(userRef, defaultData);
      await ctx.reply(`🇳🇬 *Welcome to Lagos Life!*\n\nThe hustle starts now.\n\nWhat name do you want to use in the game?`, { parse_mode: "Markdown", ...Markup.forceReply() });
    } else {
      await sendPlayButton(ctx, docSnap.data().name);
    }
  } catch (error) {
    console.error("Error in /start:", error);
    // THIS WILL SHOW US THE REAL ERROR IN TELEGRAM
    await ctx.reply(`❌ Firebase Error:\n${error.message}\n\nCode: ${error.code || 'unknown'}`);
  }
});

bot.on("text", async (ctx, next) => {
  try {
    if (ctx.message.reply_to_message && ctx.message.text) {
      await ensureAuth();
      const tgId = String(ctx.from.id);
      const newName = ctx.message.text.trim().slice(0, 20);
      await setDoc(doc(db, "users", tgId), { name: newName }, { merge: true });
      await ctx.reply(`Sharp! Your Lagos name is now *${newName}* 💪`, { parse_mode: "Markdown" });
      await sendPlayButton(ctx, newName);
    } else {
      return next();
    }
  } catch (error) {
    await ctx.reply(`❌ Name Save Error:\n${error.message}`);
  }
});

function sendPlayButton(ctx, name) {
  return ctx.reply(`Ready to hustle, *${name}*? 👊🏾\n\nTap below to open Lagos Life:`, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([Markup.button.webApp("🎮 Open Lagos Life", process.env.MINI_APP_URL)]),
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "Vercel is alive", hasBotToken: !!process.env.BOT_TOKEN });
  }
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send("Error");
  }
}
