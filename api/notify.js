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

  const { chatId, type, amount, senderName, userName, message } = req.body;

  try {
    if (!chatId) return res.status(400).json({ error: "No chatId provided" });

    let text = "";

    if (type === "transfer") {
      text = `💰 *MONEY ALERT!* 💰\n\n*${senderName}* just sent you *${fmt(amount)}* Lagos Cash!\n\nOpen the app to flex your new money. 🤑`;
    } 
    else if (type === "withdrawal") {
      text = `🎉 *WITHDRAWAL SUCCESSFUL!* 🎉\n\nOdogwu! You just withdraw *${fmt(amount)}* real cash to your account. Check your bank alert! 🏦💸`;
    }
    else if (type === "energy_full") {
      text = `⚡ *ENERGY DON FULL!* ⚡\n\n*${userName}*, your energy don reach 100. Enter the app and tap hustle before another person takes your shine! 🏃🏾‍♂️💨`;
    }
    else if (type === "reminder") {
      text = `📢 *LAGOS REMINDER*\n\n${message || "E don tey wey you hustle. Your customers dey wait for you oo! 🏃🏾‍♂️"}`;
    }
    else {
      text = message || "You have a new notification from Lagos Life Mini!";
    }

    await bot.telegram.sendMessage(chatId, text, { parse_mode: "Markdown" });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Notify Error:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
}
