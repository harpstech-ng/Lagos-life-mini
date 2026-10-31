const API_KEY = "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs";
const PROJECT_ID = "lagos-life-a8706";
const DATABASE_ID = "(default)"; 
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

async function getAuthToken() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in Vercel env");
  }

  // Sign in as the Admin user
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (data.error) throw new Error("Admin Auth Failed: " + data.error.message);
  return data.idToken;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { reference, userId } = req.body || {};
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  if (!PAYSTACK_SECRET_KEY) {
    console.error("MISSING PAYSTACK_SECRET_KEY IN VERCEL ENV");
    return res.status(500).json({ error: "Server configuration error: Missing Secret Key" });
  }
  if (!reference || !userId) {
    return res.status(400).json({ error: "Missing reference or userId" });
  }

  try {
    // 1. LOG IN AS ADMIN
    const token = await getAuthToken();

    // 2. VERIFY PAYMENT WITH PAYSTACK
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
    });
    
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      console.error("Paystack verify failed:", paystackData);
      return res.status(400).json({ error: "Payment verification failed with Paystack" });
    }

    // 3. GET THE VERIFIED AMOUNT
    const verifiedAmount = paystackData.data.amount / 100;

    // 4. FETCH USER & CHECK FOR REPLAY ATTACK
    const userRes = await fetch(`${BASE_URL}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const userData = await userRes.json();
    
    // Safe check for used references
    const usedRefs = userData.fields?.usedReferences?.arrayValue?.values || [];
    const isAlreadyUsed = usedRefs.some(ref => ref.stringValue === reference);
    
    if (isAlreadyUsed) {
      return res.status(400).json({ error: "This transaction reference has already been used" });
    }

    const currentReal = Number(userData.fields?.real?.integerValue || userData.fields?.real?.doubleValue || 0);
    const newReal = currentReal + verifiedAmount;

    // 5. UPDATE FIREBASE
    const updateRes = await fetch(`${BASE_URL}/users/${userId}?updateMask.fieldPaths=real&updateMask.fieldPaths=usedReferences`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fields: { 
          real: { integerValue: String(newReal) },
          usedReferences: { 
            arrayValue: { 
              values: [...usedRefs, { stringValue: reference }] 
            } 
          }
        } 
      })
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error("Firebase Update Failed:", errorText);
      throw new Error("Failed to update Firebase balance");
    }

    res.status(200).json({ success: true, amount: verifiedAmount, message: "Payment verified and balance updated!" });
  } catch (error) {
    console.error("PAYSTACK BACKEND ERROR:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
