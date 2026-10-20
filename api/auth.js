import admin from "firebase-admin";
import crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { initData } = req.body;
  if (!initData) return res.status(400).json({ error: "Missing initData" });

  // Validate Telegram
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort().map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto.createHash("sha256").update(process.env.BOT_TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (hmac !== hash) return res.status(401).json({ error: "Invalid initData" });

  const user = JSON.parse(params.get("user"));
  const uid = String(user.id);

  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      telegramId: user.id,
      username: user.username || `user_${uid}`,
      displayName: user.first_name || "Hustler",
      cash: 25000, real: 0, energy: 100, lastEnergy: Date.now(),
      businesses: {}, assets: {}, travels: [], street: {}, taps: 0, clout: 0, goldName: false,
      createdAt: Date.now(), lastSeen: Date.now(),
    });
  }

  const token = await admin.auth().createCustomToken(uid);
  res.json({ token, uid });
}