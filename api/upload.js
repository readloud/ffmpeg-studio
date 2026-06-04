import { put } from '@vercel/blob';

// Nonaktifkan body parser default untuk menerima raw file stream
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
        const filename = searchParams.get('filename');
        
        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        // Baca stream request body
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Upload ke Vercel Blob
        const blob = await put(filename, buffer, {
            access: 'public',
            contentType: req.headers['content-type'] || 'audio/mpeg',
        });

        return res.status(200).json(blob);
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Upload gagal: ' + error.message });
    }
}
