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

  const { chatId, type, amount, senderName } = req.body;

  try {
    if (!chatId) {
      console.log("No chatId provided");
      return res.status(400).json({ error: "No chatId provided" });
    }
    
    let text = "";

    if (type === "transfer") {
      text = `💰 *MONEY ALERT!* 💰\n\n*${senderName}* just sent you *${fmt(amount)}* Lagos Cash!\n\nOpen the app to flex your new money. 🤑`;
    } else {
      text = "You have a new notification from Lagos Life Mini!";
    }

    await bot.telegram.sendMessage(String(chatId), text, { parse_mode: "Markdown" });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Notify Error:", error.message);
    res.status(500).json({ error: "Failed", details: error.message });
  }
}
