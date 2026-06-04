import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // Penting: Matikan body parser bawaan untuk file stream
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filename = req.query.filename || 'uploaded-file';
    
    // Gunakan req sebagai stream langsung
    const blob = await put(filename, req, {
      access: 'public',
    });

    return res.status(200).json(blob);
  } catch (error) {
    console.error("Vercel Blob Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
