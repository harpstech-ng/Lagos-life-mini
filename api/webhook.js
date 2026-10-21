import { Telegraf, Markup } from "telegraf";

const API_KEY = "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs";
const PROJECT_ID = "lagos-life-a8706";
const DATABASE_ID = "(default)"; 

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- HELPERS ---
async function getAuthToken() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST', body: JSON.stringify({ returnSecureToken: true }), headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.idToken;
}

async function getUser(tgId, token) {
  const res = await fetch(`${BASE_URL}/users/${tgId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  const data = await res.json();
  return data;
}

async function saveUser(tgId, userData, token, updateMask = "") {
  const fields = {};
  for (const [k, v] of Object.entries(userData)) {
    if (typeof v === 'number') fields[k] = { integerValue: String(v) };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
  }

  let url = `${BASE_URL}/users/${tgId}`;
  if (updateMask) url += `?updateMask.fieldPaths=${updateMask}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  return await res.json();
}

// --- BOT LOGIC ---

// 1. Handle /start
bot.start(async (ctx) => {
  try {
    const token = await getAuthToken();
    const tgId = String(ctx.from.id);
    const doc = await getUser(tgId, token);

    if (!doc || !doc.fields || doc.fields.onboardingStep?.integerValue === "5") {
      // New user or already finished onboarding
      if (!doc) {
        const defaultData = {
          name: ctx.from.first_name || 'Hustler',
          telegramId: ctx.from.id,
          cash: 25000, real: 0, energy: 100, taps: 0, clout: 0,
          onboardingStep: 1, // Start at step 1
          createdAt: Date.now()
        };
        await saveUser(tgId, defaultData, token);
        await ctx.reply(`🇳🇬 *Welcome to Lagos Life!*\n\nMake we know you small. What name do you want to use in the game?`, { parse_mode: "Markdown", ...Markup.forceReply() });
      } else {
        // Already onboarded
        await sendPlayButton(ctx, doc.fields.name.stringValue);
      }
    } else {
      // User started but didn't finish, resume them
      const step = doc.fields.onboardingStep.integerValue;
      if (step === "2") await ctx.reply("Abeg, wetin be your hustle for Lagos? (e.g. Tech Bro, Agbero, Yahoo Boy, Hustler)", Markup.forceReply());
      if (step === "3") await ctx.reply("Where you dey stay for Lagos? (e.g. Lekki, Mushin, Ikeja)", Markup.forceReply());
      if (step === "4") await ctx.reply("Drop one sharp Lagos motto for us!", Markup.forceReply());
    }
  } catch (error) {
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// 2. Handle Text Replies (The State Machine)
bot.on("text", async (ctx, next) => {
  try {
    if (!ctx.message.reply_to_message) return next(); // Ignore random chats

    const token = await getAuthToken();
    const tgId = String(ctx.from.id);
    const text = ctx.message.text.trim().slice(0, 30);
    const doc = await getUser(tgId, token);

    if (!doc || !doc.fields) return next();

    const step = doc.fields.onboardingStep?.integerValue || "1";

    if (step === "1") {
      // Save Name, move to Step 2
      await saveUser(tgId, { name: text, onboardingStep: 2 }, token, "name,onboardingStep");
      await ctx.reply(`Sharp! *${text}*, na correct name. 💪\n\nAbeg, wetin be your hustle for Lagos? (e.g. Tech Bro, Agbero, Hustler, Musician)`, { parse_mode: "Markdown", ...Markup.forceReply() });
    
    } else if (step === "2") {
      // Save Hustle, move to Step 3
      await saveUser(tgId, { hustle: text, onboardingStep: 3 }, token, "hustle,onboardingStep");
      await ctx.reply(`Odogwu! 💼\n\nWhere you dey stay for Lagos? (e.g. Lekki, Mushin, Ikeja)`, Markup.forceReply());
    
    } else if (step === "3") {
      // Save Location, move to Step 4
      await saveUser(tgId, { location: text, onboardingStep: 4 }, token, "location,onboardingStep");
      await ctx.reply(`I know that place! 📍\n\nDrop one sharp Lagos motto for us! (e.g. God When, No Gree For Anybody)`, Markup.forceReply());
    
    } else if (step === "4") {
      // Save Motto, Finish Onboarding
      await saveUser(tgId, { motto: text, onboardingStep: 5 }, token, "motto,onboardingStep");
      await ctx.reply(`E choke! 🔥 You are officially a Lagosian.`);
      await sendPlayButton(ctx, doc.fields.name.stringValue);
    }
  } catch (error) {
    console.error(error);
  }
});

function sendPlayButton(ctx, name) {
  return ctx.reply(`Ready to hustle, *${name}*? 👊🏾\n\nTap below to open Lagos Life:`, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([Markup.button.webApp("🎮 Open Lagos Life", process.env.MINI_APP_URL)]),
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ status: "Alive" });
  try { await bot.handleUpdate(req.body); res.status(200).send("OK"); } 
  catch (err) { res.status(500).send("Error"); }
}
