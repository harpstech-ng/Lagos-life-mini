const API_KEY = "AIzaSyBf2lWdtfpQe-h3bMpdHqsHR4SuQHICOZs";
const PROJECT_ID = "lagos-life-a8706";
const DATABASE_ID = "(default)"; 
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

function genCode() {
  const C = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => C[Math.floor(Math.random() * C.length)]).join('');
  return 'LGM-' + seg() + '-' + seg() + '-' + seg();
}

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = {};
  for (const [key, val] of Object.entries(doc.fields)) {
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = Number(val.integerValue);
    else if (val.doubleValue !== undefined) obj[key] = Number(val.doubleValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.nullValue !== undefined) obj[key] = null;
  }
  if (doc.name) {
    const parts = doc.name.split('/');
    obj.id = parts[parts.length - 1];
  }
  return obj;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null || key === 'id') continue;
    if (typeof val === 'number') {
      fields[key] = { integerValue: String(Math.round(val)) };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else {
      fields[key] = { stringValue: String(val) };
    }
  }
  return fields;
}

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

    // Check if this transaction is for a gift card
    const isGift = reference.startsWith('LGS_GIFT_') || 
                   req.body?.type === 'gift_card' || 
                   req.body?.type === 'gift' || 
                   paystackData.data?.metadata?.type === 'gift_card';

    if (isGift) {
      const docId = reference.replace(/[^a-zA-Z0-9_-]/g, '_');

      // 1. Check if card was already created by document ID
      try {
        const checkRes = await fetch(`${BASE_URL}/gift_cards/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (checkRes.ok) {
          const doc = await checkRes.json();
          const card = parseFirestoreDoc(doc);
          if (card) {
            return res.status(200).json({ success: true, isGift: true, card });
          }
        }
      } catch (e) {
        console.warn("Direct card check failed:", e.message);
      }

      // 2. Check if card was created with another ID using runQuery
      try {
        const queryRes = await fetch(`${BASE_URL}:runQuery`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'gift_cards' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'paystackRef' },
                  op: 'EQUAL',
                  value: { stringValue: reference }
                }
              },
              limit: 1
            }
          })
        });
        if (queryRes.ok) {
          const queryData = await queryRes.json();
          const found = Array.isArray(queryData) && queryData.find(item => item.document && item.document.fields);
          if (found) {
            const card = parseFirestoreDoc(found.document);
            if (card) {
              return res.status(200).json({ success: true, isGift: true, card });
            }
          }
        }
      } catch (e) {
        console.warn("Firestore runQuery check failed:", e.message);
      }

      // 3. Construct new card from metadata / client data
      const meta = paystackData.data.metadata || {};
      const clientCard = req.body.cardData || {};

      const amountPaid = Number(clientCard.amountPaid || meta.amountPaid || verifiedAmount);
      const feeAmount = Number(clientCard.feeAmount || meta.feeAmount || Math.round(amountPaid * 0.20));
      const redeemValue = Number(clientCard.redeemValue || meta.redeemValue || (amountPaid - feeAmount));
      const code = clientCard.code || meta.giftCode || genCode();
      const createdAt = Number(clientCard.createdAt || Date.now());
      const expiresAt = Number(clientCard.expiresAt || (createdAt + 90 * 86400000));

      const newCard = {
        code,
        productId: String(clientCard.productId || meta.productId || 'gift'),
        productName: String(clientCard.productName || meta.productName || 'Gift Card'),
        emoji: String(clientCard.emoji || meta.emoji || '🎁'),
        cat: String(clientCard.cat || meta.cat || 'luxury'),
        amountPaid,
        feeAmount,
        redeemValue,
        buyerId: String(clientCard.buyerId || meta.buyerId || userId),
        buyerName: String(clientCard.buyerName || meta.buyerName || 'A friend'),
        recipientName: String(clientCard.recipientName || meta.recipientName || ''),
        message: String(clientCard.message || meta.message || ''),
        status: 'active',
        createdAt,
        expiresAt,
        paystackRef: reference
      };

      // 4. Save to Firestore via Admin API using PATCH with docId (creates or updates)
      const saveRes = await fetch(`${BASE_URL}/gift_cards/${docId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(newCard) })
      });

      if (!saveRes.ok) {
        const errorText = await saveRes.text();
        console.error("Failed to save gift card to Firestore:", errorText);
        throw new Error("Failed to save gift card document");
      }

      newCard.id = docId;

      // 5. Safely record used reference on user document if possible
      try {
        const buyerId = newCard.buyerId || userId;
        const userRes = await fetch(`${BASE_URL}/users/${buyerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          const usedRefs = userData.fields?.usedReferences?.arrayValue?.values || [];
          const isAlreadyUsed = usedRefs.some(ref => ref.stringValue === reference);
          if (!isAlreadyUsed) {
            await fetch(`${BASE_URL}/users/${buyerId}?updateMask.fieldPaths=usedReferences`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  usedReferences: {
                    arrayValue: {
                      values: [...usedRefs, { stringValue: reference }]
                    }
                  }
                }
              })
            });
          }
        }
      } catch (err) {
        console.warn("Could not append usedReference to user:", err.message);
      }

      return res.status(200).json({
        success: true,
        isGift: true,
        card: newCard,
        message: "Gift card payment verified and card created!"
      });
    }

    // 4. FETCH USER & CHECK FOR REPLAY ATTACK (NORMAL TOP-UP FLOW)
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

    // 5. UPDATE FIREBASE (NORMAL TOP-UP FLOW)
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
