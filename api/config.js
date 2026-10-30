export default async function handler(req, res) {
  // 1. Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publicKey = process.env.PAYSTACK_PUBLIC_KEY;

  // 2. If env is missing, throw an error instead of a fake key
  if (!publicKey) {
    console.error("MISSING PAYSTACK_PUBLIC_KEY IN VERCEL ENV");
    return res.status(500).json({ error: 'Payment configuration missing' });
  }

  res.status(200).json({ publicKey });
}
