import { Telegraf, Markup } from "telegraf";

// ═══ YOUR EXISTING FIREBASE CONFIG ═══
const API_KEY = "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs";
const PROJECT_ID = "lagos-life-a8706";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const bot = new Telegraf(process.env.BOT_TOKEN);

// Helper: Get Anonymous Auth Token via REST API
async function getAuthToken() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    body: JSON.stringify({ returnSecureToken: true }),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.idToken;
}

// Helper: Get User from Firestore via REST
async function getUser(tgId, token) {
  const res = await fetch(`${BASE_URL}/users/${tgId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) return null; // User doesn't exist
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// Helper: Create/Update User in Firestore via REST
async function saveUser(tgId, userData, token, updateMask = "") {
  const fields = {};
  for (const [k, v] of Object.entries(userData)) {
    if (typeof v === 'number') fields[k] = { integerValue: String(v) };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'object' && v !== null) fields[k] = { mapValue: { fields: {} } };
  }

  let url = `${BASE_URL}/users/${tgId}`;
  if (updateMask) url += `?updateMask.fieldPaths=${updateMask}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// 1. Handle /start command
bot.start(async (ctx) => {
  try {
    const token = await getAuthToken();
    const tgId = String(ctx.from.id);
    const doc = await getUser(tgId, token);

    if (!doc) {
      const defaultData = {
        name: ctx.from.first_name || 'Aje Butler',
        username: ctx.from.username || '',
        telegramId: ctx.from.id,
        cash: 25000, real: 0, energy: 100, lastEnergy: Date.now(),
        taps: 0, clout: 0, goldName: false, lastSeen: Date.now(),
      };
      await saveUser(tgId, defaultData, token);

      await ctx.reply(
        `🇳🇬 *Welcome to Lagos Life!*\n\nThe hustle starts now.\n\nWhat name do you want to use in the game?\n_(Reply with your preferred name — e.g. "Aje Butler")_`,
        { parse_mode: "Markdown", ...Markup.forceReply() }
      );
    } else {
      await sendPlayButton(ctx, doc.fields.name.stringValue);
    }
  } catch (error) {
    console.error("Error in /start:", error);
    await ctx.reply(`❌ Firebase Error:\n${error.message}`);
  }
});

// 2. Handle user replying with their name
bot.on("text", async (ctx, next) => {
  try {
    if (ctx.message.reply_to_message && ctx.message.text) {
      const token = await getAuthToken();
      const tgId = String(ctx.from.id);
      const newName = ctx.message.text.trim().slice(0, 20);

      await saveUser(tgId, { name: newName }, token, "name");
      
      await ctx.reply(`Sharp! Your Lagos name is now *${newName}* 💪`, { parse_mode: "Markdown" });
      await sendPlayButton(ctx, newName);
    } else {
      return next();
    }
  } catch (error) {
    console.error("Error in text handler:", error);
    await ctx.reply(`❌ Name Save Error:\n${error.message}`);
  }
});

function sendPlayButton(ctx, name) {
  return ctx.reply(`Ready to hustle, *${name}*? 👊🏾\n\nTap below to open Lagos Life:`, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      Markup.button.webApp("🎮 Open Lagos Life", process.env.MINI_APP_URL),
    ]),
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ status: "Vercel is alive" });
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("Error");
  }
}
