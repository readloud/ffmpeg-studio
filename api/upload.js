import { put } from '@vercel/blob';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { filename } = req.query;
        
        // Mengunggah stream file ke Vercel Blob
        const blob = await put(filename, req, {
            access: 'public',
        });

        return res.status(200).json(blob);
    } catch (error) {
        return res.status(500).json({ error: 'Upload gagal: ' + error.message });
    }
}