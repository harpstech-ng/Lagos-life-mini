import { Telegraf, Markup } from "telegraf";

const API_KEY = "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs";
const PROJECT_ID = "lagos-life-a8706";
const DATABASE_ID = "(default)"; 

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const bot = new Telegraf(process.env.BOT_TOKEN);
const APP_URL = process.env.MINI_APP_URL || "https://lagos-life-mini.vercel.app";

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
  return await res.json();
}

async function saveUser(tgId, userData, token, updateMaskFields = []) {
  const fields = {};
  for (const [k, v] of Object.entries(userData)) {
    if (v === null) fields[k] = { nullValue: null };
    else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
  }

  let url = `${BASE_URL}/users/${tgId}`;
  if (updateMaskFields.length > 0) {
    url += '?' + updateMaskFields.map(f => `updateMask.fieldPaths=${f}`).join('&');
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  return await res.json();
}

const fmt = (n) => {
  n = Math.floor(Number(n) || 0);
  if (n >= 1e12) return "₦" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return "₦" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "₦" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "₦" + (n / 1e3).toFixed(1) + "K";
  return "₦" + n.toLocaleString();
};

// --- BOT LOGIC ---
bot.start(async (ctx) => {
  try {
    const token = await getAuthToken();
    const tgId = String(ctx.from.id);
    const doc = await getUser(tgId, token);

    if (doc && doc.fields) {
       await saveUser(tgId, { telegramId: ctx.from.id }, token, ["telegramId"]);
    }

    if (!doc || !doc.fields || !doc.fields.onboardingStep) {
      const defaultData = {
        name: ctx.from.first_name || 'Hustler',
        telegramId: ctx.from.id,
        cash: 25000, real: 0, energy: 100, taps: 0, clout: 0,
        onboardingStep: 1, createdAt: Date.now(), gender: 'boy'
      };
      await saveUser(tgId, defaultData, token); 
      await ctx.reply(`🇳🇬 *Welcome to Lagos Life Mini!*\n\nWhat name do you want to use in the game?`, { parse_mode: "Markdown", ...Markup.forceReply() });
    } else {
      const step = doc.fields.onboardingStep?.integerValue || "1";
      if (step === "6") {
        await sendPlayButton(ctx, doc.fields.name?.stringValue || ctx.from.first_name);
      } else {
        if (step === "1") await ctx.reply(`What name do you want to use in the game?`, Markup.forceReply());
        if (step === "2") await ctx.reply("Abeg, wetin be your hustle for Lagos?", Markup.forceReply());
        if (step === "3") await ctx.reply("Where you dey stay for Lagos?", Markup.forceReply());
        if (step === "4") await ctx.reply("Drop one sharp Lagos motto for us!", Markup.forceReply());
        if (step === "5") await ctx.reply("Are you a Boy or a Girl? (This is for the Dating feature)", Markup.inlineKeyboard([
          Markup.button.callback('👦 I am a Boy', 'gender_boy'),
          Markup.button.callback('👧 I am a Girl', 'gender_girl')
        ]));
      }
    }
  } catch (error) { await ctx.reply(`❌ Error: ${error.message}`); }
});

// Handle Gender Callback
bot.action(/gender_(.+)/, async (ctx) => {
  try {
    const gender = ctx.match[1];
    const token = await getAuthToken();
    const tgId = String(ctx.from.id);
    
    await saveUser(tgId, { gender, onboardingStep: 6 }, token, ["gender", "onboardingStep"]);
    
    await ctx.answerCbQuery(`Gender set to ${gender}! 🎉`);
    await ctx.editMessageText(`✅ You selected: *${gender.toUpperCase()}*`, { parse_mode: "Markdown" });
    await ctx.reply(`E choke! 🔥 You are officially a Lagosian.`);
    await sendPlayButton(ctx, ctx.from.first_name);
  } catch (error) { console.error("GENDER ERROR:", error); }
});

bot.on("text", async (ctx, next) => {
  try {
    if (!ctx.message.reply_to_message) return next(); 
    const token = await getAuthToken();
    const tgId = String(ctx.from.id);
    const text = ctx.message.text.trim().slice(0, 30);
    const doc = await getUser(tgId, token);
    if (!doc || !doc.fields) return next();

    const step = doc.fields.onboardingStep?.integerValue || "1";

    if (step === "1") {
      await saveUser(tgId, { name: text, onboardingStep: 2 }, token, ["name", "onboardingStep"]);
      await ctx.reply(`Sharp! *${text}*, na correct name. 💪\n\nWetin be your hustle?`, { parse_mode: "Markdown", ...Markup.forceReply() });
    } else if (step === "2") {
      await saveUser(tgId, { hustle: text, onboardingStep: 3 }, token, ["hustle", "onboardingStep"]);
      await ctx.reply(`Odogwu! 💼\n\nWhere you dey stay?`, Markup.forceReply());
    } else if (step === "3") {
      await saveUser(tgId, { location: text, onboardingStep: 4 }, token, ["location", "onboardingStep"]);
      await ctx.reply(`I know that place! 📍\n\nDrop one Lagos motto!`, Markup.forceReply());
    } else if (step === "4") {
      await saveUser(tgId, { motto: text, onboardingStep: 5 }, token, ["motto", "onboardingStep"]);
      await ctx.reply(`E choke! 🔥 Now, are you a Boy or a Girl? (For the dating feature)`, Markup.inlineKeyboard([
        Markup.button.callback('👦 I am a Boy', 'gender_boy'),
        Markup.button.callback('👧 I am a Girl', 'gender_girl')
      ]));
    }
  } catch (error) { console.error("TEXT ERROR:", error); }
});

// --- COMMANDS ---
bot.command("play", async (ctx) => await sendPlayButton(ctx, ctx.from.first_name));

bot.command("gender", async (ctx) => {
  await ctx.reply("Choose your gender:", Markup.inlineKeyboard([
    Markup.button.callback('👦 Boy', 'gender_boy'),
    Markup.button.callback('👧 Girl', 'gender_girl')
  ]));
});

bot.command("networth", async (ctx) => {
  try {
    const token = await getAuthToken();
    const doc = await getUser(String(ctx.from.id), token);
    if (!doc || !doc.fields) return ctx.reply("You need to /start first.");
    const cash = Number(doc.fields.cash?.integerValue || 0);
    await ctx.reply(`💰 *Your Lagos Cash*\n\nYou currently have *${fmt(cash)}* in your account.\n\nOpen the app to see your full Net Worth (Cash + Business + Assets)!`, { parse_mode: "Markdown" });
  } catch (e) { ctx.reply("Error fetching net worth."); }
});

bot.command("babe", async (ctx) => {
  await ctx.reply("💖 Ready to find love or cause wahala in Lagos? Tap below:", 
    Markup.inlineKeyboard([Markup.button.webApp("💖 Open Babe Wahala", APP_URL + "/babe.html")])
  );
});

bot.command("madness", async (ctx) => {
  await ctx.reply("🥵 Feeling crazy today? Enter the Madness zone:", 
    Markup.inlineKeyboard([Markup.button.webApp("🥵 Open Madness", APP_URL + "/madness.html")])
  );
});

bot.command("vip", async (ctx) => {
  await ctx.reply("👑 Big Boys Lounge dey wait for you. Enter VIP:", 
    Markup.inlineKeyboard([Markup.button.webApp("👑 Open Big Boys Lounge", APP_URL + "/vip.html")])
  );
});

bot.command("daily", async (ctx) => {
  try {
    const token = await getAuthToken();
    const tgId = String(ctx.from.id);
    const doc = await getUser(tgId, token);
    if (!doc || !doc.fields) return ctx.reply("Abeg do /start first oo.");

    const lastClaim = Number(doc.fields.lastDaily?.integerValue || 0);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (now - lastClaim < oneDay) {
      const timeLeft = oneDay - (now - lastClaim);
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const mins = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      return ctx.reply(`Oga, you don collect today's own. Come back in *${hours}h ${mins}m* ⏳`, { parse_mode: "Markdown" });
    }

    const reward = 50000;
    await saveUser(tgId, { cash: Number(doc.fields.cash?.integerValue || 0) + reward, lastDaily: now }, token, ["cash", "lastDaily"]);
    await ctx.reply(`🎁 *DAILY REWARD CLAIMED!*\n\nYou just collect *${fmt(reward)}* Lagos Cash. No sleep, just hustle! 💪`, { parse_mode: "Markdown" });
  } catch (e) { ctx.reply("Error claiming daily reward."); }
});

bot.command("profile", async (ctx) => {
  try {
    const token = await getAuthToken();
    const doc = await getUser(String(ctx.from.id), token);
    if (!doc || !doc.fields) return ctx.reply("You need to /start first.");
    const name = doc.fields.name?.stringValue || "Hustler";
    const hustle = doc.fields.hustle?.stringValue || "N/A";
    const location = doc.fields.location?.stringValue || "N/A";
    const gender = doc.fields.gender?.stringValue || "Unknown";
    const cash = Number(doc.fields.cash?.integerValue || 0);
    await ctx.reply(`👤 *Your Lagos Profile*\n\nName: *${name}*\nHustle: ${hustle}\nLocation: ${location}\nGender: ${gender}\n\n💰 Cash: ${fmt(cash)}`, { parse_mode: "Markdown" });
  } catch (e) { ctx.reply("Error getting profile."); }
});

bot.command("roast", (ctx) => {
  const roasts = [
    "Your net worth is so low, even area boys no wan collect tax from you. 😂",
    "You dey tap hustle all day but your bank account still dey cry. 😭",
    "The way you dey buy pure water, e be like say na water company you wan open. 💧",
    "Your girlfriend in the game don leave you because you no fit pay her bills. 💔😂"
  ];
  ctx.reply(`🔥 *Lagos Roast*\n\n${roasts[Math.floor(Math.random() * roasts.length)]}`, { parse_mode: "Markdown" });
});

function sendPlayButton(ctx, name) {
  return ctx.reply(`Ready to hustle, *${name}*? 👊🏾\n\nTap below to open Lagos Life Mini:`, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([Markup.button.webApp("🎮 Open Lagos Life Mini", APP_URL)]),
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ status: "Alive" });
  try { await bot.handleUpdate(req.body); res.status(200).send("OK"); } 
  catch (err) { console.error("TELEGRAF ERROR", err); res.status(500).send("Error"); }
}
