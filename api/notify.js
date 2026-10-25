import { Telegraf } from "telegraf";
const bot = new Telegraf(process.env.BOT_TOKEN);

const fmt = (n) => {
  n = Math.floor(Number(n) || 0);
  if (n >= 1e12) return "₦" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return "₦" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "₦" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "₦" + (n / 1e3).toFixed(1) + "K";
  return "₦" + n.toLocaleString();
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { chatId, type, amount, senderName, message } = req.body;

  try {
    if (!chatId) {
      console.log("No chatId provided");
      return res.status(400).json({ error: "No chatId provided" });
    }
    
    let text = "";
    let button = null;

    if (type === "transfer") {
      text = `💰 *MONEY ALERT!* 💰\n\n*${senderName}* just sent you *${fmt(amount)}* Lagos Cash!\n\nOpen the app to flex your new money. 🤑`;
    } else if (type === "ritual") {
      text = `🩸 *WAHALA!* 🩸\n\n*${senderName}* just used you for money ritual! You lost *₦1,000,000*.\n\nOpen the app to see your account. 😭`;
    } else if (type === "marriage_proposal") {
      text = `💍 *PROPOSAL ALERT!* 💍\n\n*${senderName}* just proposed to you! Open the Marriage page to accept or reject. ❤️`;
    } else if (type === "wedding") {
      text = `💍 *WEDDING BELLS!* 💍\n\nYou are officially married to *${senderName}*! Open the app to start enjoying married life (and cheating 😈).`;
    } else if (type === "kidnapped") {
      text = `🚐 *ONE CHANCE! KIDNAPPED!* 🚐\n\nYou have been kidnapped! Go to the Madness page immediately to pay ransom or fight back before you lose ₦500k!`;
    } else if (type === "raid") {
      text = `🚔 *POLICE RAID!* 🚔\n\nEFCC or Police just raided you! Go to the app to pay your bail before you lose all your money!`;
    } else if (type === "caught_cheating") {
      text = `😱 *YOU GOT CAUGHT!* 😱\n\n*${senderName}* caught you cheating! You are now in Divorce Court. Open the app to face the judge.`;
    } else if (type === "spouse_cheated") {
      text = `💔 *HEARTBREAK!* 💔\n\nYour spouse, *${senderName}*, just cheated on you! Open the Marriage page to drag them to court.`;
    } else if (type === "vip") {
      text = `👑 *WELCOME TO VIP!* 👑\n\nYou are now a Big Boy! Enjoy 2x Hustle speed, Gold Name, and exclusive chat. 🥂`;
    } else {
      text = message || "You have a new notification from Lagos Life Mini!";
    }

    const opts = { parse_mode: "Markdown" };
    if (type === "marriage_proposal") opts.reply_markup = { inline_keyboard: [[{ text: "💍 View Proposal", web_app: { url: "https://lagos-life-mini.vercel.app/marriage.html" } }]] };
    if (type === "kidnapped") opts.reply_markup = { inline_keyboard: [[{ text: "🚐 Pay Ransom", web_app: { url: "https://lagos-life-mini.vercel.app/madness.html" } }]] };
    if (type === "raid") opts.reply_markup = { inline_keyboard: [[{ text: "🚔 Pay Bail", web_app: { url: "https://lagos-life-mini.vercel.app/street.html" } }]] };
    if (type === "caught_cheating" || type === "spouse_cheated") opts.reply_markup = { inline_keyboard: [[{ text: "⚖️ Go to Court", web_app: { url: "https://lagos-life-mini.vercel.app/marriage.html" } }]] };

    await bot.telegram.sendMessage(String(chatId), text, opts);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Notify Error:", error.message);
    res.status(500).json({ error: "Failed", details: error.message });
  }
}
