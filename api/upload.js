// /api/upload.js
import { put } from '@vercel/blob';

export const config = {
  api: { bodyParser: false }, // Wajib untuk menangani file stream
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { filename } = req.query;
    const blob = await put(filename, req, { access: 'public' });
    return res.status(200).json(blob);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
