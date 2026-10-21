import { Telegraf } from "telegraf";

const API_KEY = "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs";
const PROJECT_ID = "lagos-life-a8706";
const DATABASE_ID = "(default)";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🚨 FUNNY PUSH NOTIFICATIONS POOL 🚨
const MESSAGES = [
  "🥷 *WAHALA DON HAPPEN!*\n\nArea boys just robbed you for Mushin! They took some of your Lagos Cash. Enter the app make we go find them! 🏃🏾‍♂️💨",
  "🚀 *MARKET ALERT!*\n\nElon Musk just landed in the Lagos Market! Price: ₦50 Trillion. Do you have the money to buy him? Check the Market now! 🤑",
  "🏪 *ODOGWU ALERT!*\n\nOga, your Danfo drivers are slacking! You have uncollected income waiting. Open the app to collect your fake money before they run away with it. 🚌💸",
  "⚡ *ENERGY DON FULL!*\n\nYour energy is at 100! No more excuses. Enter Lagos Life Mini and start tapping hustle before another person takes your shine. 👊🏾",
  "😭 *YOU DEY SLEEP?*\n\nYour net worth is looking like a joke. Even your village people are laughing at you. Come and tap HUSTLE make you no fall hand! 🏃🏾‍♂️",
  "🥷 *ROBBERY GONE WRONG!*\n\nSomebody tried to rob you but you overpowered them. Enter the app to see if you got lucky or you lost energy. 😂",
  "🏆 *YOU DON FALL BACK!*\n\nSomeone just passed you on the Top 100 Billionaires leaderboard. Are you going to let them shine? Open the app and climb back up! 📈",
  "🍾 *CLUB DEY HOT!*\n\nThe party don start for Lekki Lounge. People dey spray money anyhow. Come and show them say you be Big Boy! 💸",
  "🎰 *BET9JA TICKET!*\n\nYour ticket just dey play! Enter the app to cash out your winnings before the bookie runs away. 💰",
  "✈️ *JAPA PLANS!*\n\nUK dey call your name! Your ticket is ready but you need more Lagos Cash. Open the app to hustle and japa! 🇬🇧"
];

// Helper to chunk array into batches
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

    // 2. Fetch active users (Limit to 150 per run to stay within Vercel timeout limits)
    // Fetching from highest to lowest so it cycles through top players
    const usersRes = await fetch(`${BASE_URL}/users?pageSize=150`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const usersData = await usersRes.json();

    if (!usersData.documents) {
      return res.status(200).json({ status: "No users found" });
    }

    // 3. Filter users who have finished onboarding and have a telegramId
    const validUsers = usersData.documents.filter(user => {
      const tgId = user.fields?.telegramId?.integerValue || user.fields?.telegramId?.stringValue;
      const step = user.fields?.onboardingStep?.integerValue;
      return tgId && step === "5";
    }).map(user => ({
      tgId: user.fields.telegramId.integerValue || user.fields.telegramId.stringValue
    }));

    // 4. Batch and Send using Promise.all
    let sentCount = 0;
    const batches = chunkArray(validUsers, 28); // Telegram allows 30/sec. We use 28 to be safe.

    for (const batch of batches) {
      const promises = batch.map(u => {
        const randomMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        return bot.telegram.sendMessage(u.tgId, randomMsg, { parse_mode: "Markdown" })
          .then(() => { sentCount++; })
          .catch(err => { console.log(`Failed to send to ${u.tgId}:`, err.message); }); // Catch errors so 1 blocked user doesn't break the batch
      });

      await Promise.all(promises); // Send the batch
      await new Promise(r => setTimeout(r, 1100)); // Wait 1.1 seconds before the next batch
    }

    res.status(200).json({ success: true, totalUsersFetched: validUsers.length, messagesSent: sentCount });
  } catch (error) {
    console.error("CRON ERROR:", error);
    res.status(500).json({ error: error.message });
  }
}
