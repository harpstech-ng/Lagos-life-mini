import { Telegraf, Markup } from "telegraf";

const API_KEY = "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs";
const PROJECT_ID = "lagos-life-a8706";
const DATABASE_ID = "(default)";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const bot = new Telegraf(process.env.BOT_TOKEN);
const APP_URL = process.env.MINI_APP_URL || "https://lagos-life-mini.vercel.app";

const MESSAGES = [
  {
    text: "🥷 *WAHALA DON HAPPEN!*\n\nArea boys just robbed you for Mushin! They took some of your Lagos Cash. Enter the app make we go find them! 🏃🏾‍♂️💨",
    button: "🏃🏾‍♂️ Go to Street",
    page: "street.html"
  },
  {
    text: "🚀 *MARKET ALERT!*\n\nElon Musk just landed in the Lagos Market! Price: ₦50 Trillion. Do you have the money to buy him? Check the Market now! 🤑",
    button: "🛒 Open Market",
    page: "market.html"
  },
  {
    text: "🏪 *ODOGWU ALERT!*\n\nOga, your Danfo drivers are slacking! You have uncollected income waiting. Open the app to collect your fake money before they run away with it. 🚌💸",
    button: "🏪 Collect Vault",
    page: "business.html"
  },
  {
    text: "⚡ *ENERGY DON FULL!*\n\nYour energy is at 100! No more excuses. Enter Lagos Life Mini and start tapping hustle before another person takes your shine. 👊🏾",
    button: "👊🏾 Tap Hustle",
    page: "hustle.html"
  },
  {
    text: "😭 *YOU DEY SLEEP?*\n\nYour net worth is looking like a joke. Even your village people are laughing at you. Come and tap HUSTLE make you no fall hand! 🏃🏾‍♂️",
    button: "🏠 Open App",
    page: "index.html"
  },
  {
    text: "🍾 *CLUB DEY HOT!*\n\nThe party don start for Lekki Lounge. People dey spray money anyhow. Come and show them say you be Big Boy! 💸",
    button: "🎉 Enter Club",
    page: "club.html"
  },
  {
    text: "🎰 *BET9JA TICKET!*\n\nYour ticket just dey play! Enter the app to cash out your winnings before the bookie runs away. 💰",
    button: "🎰 Go to Bet Center",
    page: "bet.html"
  },
  {
    text: "✈️ *JAPA PLANS!*\n\nUK dey call your name! Your ticket is ready but you need more Lagos Cash. Open the app to hustle and japa! 🇬🇧",
    button: "✈️ Travel",
    page: "travel.html"
  },
  {
    text: "💖 *BABE WAHALA!*\n\nYour babe is waiting for you in the app. Don't let her down. She wants to go shopping! 🛍️",
    button: "💖 Check Babe",
    page: "babe.html"
  }
];

const chunkArray = (arr, size) => {
  const chunked = [];
  let index = 0;
  while (index < arr.length) {
    chunked.push(arr.slice(index, size + index));
    index += size;
  }
  return chunked;
};

export default async function handler(req, res) {
  try {
    // 1. Get Auth Token
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
      method: 'POST', body: JSON.stringify({ returnSecureToken: true }), headers: { 'Content-Type': 'application/json' }
    });
    const authData = await authRes.json();
    const token = authData.idToken;

    // 2. Fetch 100 users
    const usersRes = await fetch(`${BASE_URL}/users?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const usersData = await usersRes.json();

    if (!usersData.documents) {
      return res.status(200).json({ status: "No users found" });
    }

    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;

    // 3. Filter users
    const validUsers = usersData.documents.filter(user => {
      const tgId = user.fields?.telegramId?.integerValue || user.fields?.telegramId?.stringValue;
      const step = user.fields?.onboardingStep?.integerValue;
      const lastNotified = Number(user.fields?.lastNotified?.integerValue || 0);
      
      return tgId && step === "6" && (now - lastNotified > twoHours);
    }).map(user => ({
      id: user.name.split("/").pop(),
      tgId: user.fields.telegramId.integerValue || user.fields.telegramId.stringValue
    }));

    if (validUsers.length === 0) {
      return res.status(200).json({ success: true, messagesSent: 0, note: "No users due for a notification yet." });
    }

    // 4. Batch and Send
    let sentCount = 0;
    const batches = chunkArray(validUsers, 28);

    for (const batch of batches) {
      const promises = batch.map(u => {
        const msgObj = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        return bot.telegram.sendMessage(u.tgId, msgObj.text, { 
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: msgObj.button, web_app: { url: APP_URL + "/" + msgObj.page } }]]
          }
        })
          .then(() => { 
            sentCount++; 
            return fetch(`${BASE_URL}/users/${u.id}?updateMask.fieldPaths=lastNotified`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: { lastNotified: { integerValue: String(now) } } })
            });
          })
          .catch(err => { console.log(`Failed to send to ${u.tgId}:`, err.message); });
      });

      await Promise.all(promises);
      await new Promise(r => setTimeout(r, 1000));
    }

    res.status(200).json({ success: true, totalUsersFetched: usersData.documents.length, dueForNotification: validUsers.length, messagesSent: sentCount });
  } catch (error) {
    console.error("CRON ERROR:", error);
    res.status(500).json({ error: error.message });
  }
}
