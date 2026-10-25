const API_KEY = "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs";
const PROJECT_ID = "lagos-life-a8706";
const DATABASE_ID = "(default)"; 
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

async function getAuthToken() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST', body: JSON.stringify({ returnSecureToken: true }), headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.idToken;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { reference, userId, amount } = req.body;
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  if (!PAYSTACK_SECRET_KEY) {
    console.error("MISSING PAYSTACK_SECRET_KEY IN VERCEL ENV");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    // 1. Verify payment with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
    });
    
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      console.error("Paystack verify failed:", paystackData);
      return res.status(400).json({ error: "Payment verification failed", details: paystackData });
    }

    // 2. Fetch user to add to existing balance
    const token = await getAuthToken();
    const userRes = await fetch(`${BASE_URL}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const userData = await userRes.json();
    
    // Handle both integer and double just in case
    const currentReal = Number(userData.fields?.real?.integerValue || userData.fields?.real?.doubleValue || 0);
    const newReal = currentReal + Number(amount);

    // 3. Save new balance to Firebase (Using integerValue to match frontend)
    const updateRes = await fetch(`${BASE_URL}/users/${userId}?updateMask.fieldPaths=real`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fields: { 
          real: { integerValue: String(newReal) } 
        } 
      })
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error("Firebase Update Failed:", errorText);
      throw new Error("Failed to update Firebase balance");
    }

    res.status(200).json({ success: true, message: "Payment verified and balance updated!" });
  } catch (error) {
    console.error("PAYSTACK ERROR:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
