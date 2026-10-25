export default async function handler(req, res) {
  res.status(200).json({ 
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || "pk_test_xxxxxxxxxxxx" // Fallback in case ENV fails
  });
}
