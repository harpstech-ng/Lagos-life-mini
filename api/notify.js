import { Telegraf } from "telegraf";

const bot = new Telegraf(process.env.BOT_TOKEN);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { toTelegramId, amount, senderName } = req.body;

  try {
    if (toTelegramId && amount) {
      await bot.telegram.sendMessage(
        toTelegramId,
        `💰 *Money Received!*\n\n*${senderName}* sent you *₦${amount.toLocaleString()}* Lagos Cash!\n\nOpen Lagos Life to flex 💪`,
        { parse_mode: "Markdown" }
      );
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Notify Error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
}