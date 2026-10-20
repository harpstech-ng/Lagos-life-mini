import { Telegraf, Markup } from "telegraf";
import admin from "firebase-admin";

// Initialize Firebase Admin safely
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase Admin Init Error:", error);
  }
}

const db = admin.firestore();
const bot = new Telegraf(process.env.BOT_TOKEN);

// 1. Handle /start command
bot.start(async (ctx) => {
  const tgId = String(ctx.from.id);
  const userRef = db.collection("users").doc(tgId);
  const doc = await userRef.get();

  if (!doc.exists) {
    // New user! Create their default account in Firebase
    const defaultData = {
      name: ctx.from.first_name || 'Aje Butler',
      username: ctx.from.username || '',
      telegramId: ctx.from.id,
      cash: 25000,
      real: 0,
      energy: 100,
      lastEnergy: Date.now(),
      businesses: {},
      assets: {},
      travels: [],
      street: {},
      taps: 0,
      clout: 0,
      goldName: false,
      lastSeen: Date.now(),
    };
    await userRef.set(defaultData);

    // Ask for in-game name
    await ctx.reply(
      `🇳🇬 *Welcome to Lagos Life!*\n\nThe hustle starts now.\n\nWhat name do you want to use in the game?\n_(Reply with your preferred name — e.g. "Aje Butler")_`,
      { parse_mode: "Markdown", ...Markup.forceReply() }
    );
  } else {
    // Existing user
    await sendPlayButton(ctx, doc.data().name);
  }
});

// 2. Handle user replying with their name
bot.on("text", async (ctx, next) => {
  if (ctx.message.reply_to_message && ctx.message.text) {
    const tgId = String(ctx.from.id);
    const newName = ctx.message.text.trim().slice(0, 20);

    // Save the name to Firebase
    await db.collection("users").doc(tgId).update({ name: newName });
    
    await ctx.reply(`Sharp! Your Lagos name is now *${newName}* 💪`, { parse_mode: "Markdown" });
    await sendPlayButton(ctx, newName);
  } else {
    return next();
  }
});

// Helper to send the Mini App button
function sendPlayButton(ctx, name) {
  return ctx.reply(`Ready to hustle, *${name}*? 👊🏾\n\nTap below to open Lagos Life:`, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      Markup.button.webApp("🎮 Open Lagos Life", process.env.MINI_APP_URL),
    ]),
  });
}

// 3. Export the Vercel Serverless Function
export default async function handler(req, res) {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("Error");
  }
}