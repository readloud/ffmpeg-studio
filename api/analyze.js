// Helper untuk mengekstrak JSON secara tangguh dari teks respon AI
function extractJSON(text) {
    if (!text) throw new Error("Teks respon kosong dari penyedia AI.");
    
    // Hapus blok berpikir (thinking block) milik DeepSeek R1 jika ada
    let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    try {
        // Coba parsing langsung jika teks sudah bersih
        return JSON.parse(cleanText);
    } catch (e) {
        // Jika gagal, cari pola kurung kurawal terluar menggunakan regex
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (innerError) {
                throw new Error("Gagal mengurai struktur JSON meskipun pola ditemukan.");
            }
        }
        throw new Error("Respon tidak mengandung format JSON yang valid { ... }.");
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(455).json({ error: 'Metode tidak diizinkan. Gunakan POST.' });
    }

    const { activeName, provider = 'gemini' } = req.body;
    if (!activeName) {
        return res.status(400).json({ error: 'Nama audio aktif wajib disertakan.' });
    }

    const aiSystemPrompt = `
        Anda adalah asisten produser konten audio visual profesional. Analisis judul audio berikut: "${activeName}".
        Deteksi apakah file ini lebih cocok dikategorikan sebagai "music" (lagu/musik) atau "edu" (diskusi, podcast edukasi, pembahasan coding, sains, keilmuan).
        
        Berikan respon terstruktur dalam format JSON dengan kunci berikut:
        {
          "contentType": "music" atau "edu",
          "keyword": "Kata kunci gambar/video latar belakang estetik dalam bahasa inggris",
          "hexColor": "Satu kode hex warna yang cocok untuk visualisasi waveform",
          "caption": "Satu kalimat caption promosi media sosial estetik bahasa indonesia lengkap dengan tagar",
          
          "musicData": {
            "title": "Nama judul lagu fiktif/asli yang cocok",
            "singer": "Nama penyanyi yang cocok",
            "composer": "Nama pencipta lagu/komposer",
            "album": "Nama album",
            "genre": "Genre musik",
            "releaseYear": "Tahun rilis",
            "lyrics": "Dua baris lirik lagu puitis bahasa indonesia yang indah sesuai getaran judul lagu"
          },
          
          "eduData": {
            "topic": "Nama topik diskusi pendidikan/coding/keilmuan fiktif/asli yang cocok",
            "category": "Kategori keilmuan (misal: Kecerdasan Buatan, Desain Grafis, Pemrograman)",
            "links": [
              { "name": "Nama situs web edukasi terkenal fiktif/asli terkait", "url": "Alamat url situs tersebut" },
              { "name": "Nama forum komunitas diskusi/wiki terkait", "url": "Alamat url forum diskusi/wiki terkait" }
            ]
          }
        }
        
        Respon HANYA berupa teks JSON bersih tanpa markdown tag atau karakter lain.
    `;

    try {
        let aiResponseText = "";

        switch (provider.toLowerCase()) {
            case 'deepseek': {
                const apiKey = process.env.DEEPSEEK_API_KEY;
                if (!apiKey) throw new Error("DEEPSEEK_API_KEY belum diatur di dashboard Vercel.");
                
                const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        messages: [{ role: "user", content: aiSystemPrompt }],
                        response_format: { type: "json_object" }
                    })
                });
                const result = await response.json();
                aiResponseText = result.choices?.[0]?.message?.content;
                break;
            }

            case 'claude': {
                const apiKey = process.env.CLAUDE_API_KEY;
                if (!apiKey) throw new Error("CLAUDE_API_KEY belum diatur di dashboard Vercel.");
                
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: "claude-3-5-sonnet-20241022",
                        max_tokens: 1024,
                        messages: [{ role: "user", content: aiSystemPrompt }]
                    })
                });
                const result = await response.json();
                aiResponseText = result.content?.[0]?.text;
                break;
            }

            case 'grok': {
                const apiKey = process.env.GROK_API_KEY;
                if (!apiKey) throw new Error("GROK_API_KEY belum diatur di dashboard Vercel.");
                
                const response = await fetch('https://api.x.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "grok-beta",
                        messages: [{ role: "user", content: aiSystemPrompt }]
                    })
                });
                const result = await response.json();
                aiResponseText = result.choices?.[0]?.message?.content;
                break;
            }

            case 'qwen': {
                const apiKey = process.env.QWEN_API_KEY;
                if (!apiKey) throw new Error("QWEN_API_KEY belum diatur di dashboard Vercel.");
                
                const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "qwen-turbo",
                        messages: [{ role: "user", content: aiSystemPrompt }]
                    })
                });
                const result = await response.json();
                aiResponseText = result.choices?.[0]?.message?.content;
                break;
            }

            case 'moonshot': {
                const apiKey = process.env.MOONSHOT_API_KEY;
                if (!apiKey) throw new Error("MOONSHOT_API_KEY belum diatur di dashboard Vercel.");
                
                const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "moonshot-v1-8k",
                        messages: [{ role: "user", content: aiSystemPrompt }]
                    })
                });
                const result = await response.json();
                aiResponseText = result.choices?.[0]?.message?.content;
                break;
            }

            case 'gemini':
            default: {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) throw new Error("GEMINI_API_KEY belum diatur di dashboard Vercel.");
                
                // MENGGUNAKAN STABLE GA MODEL UNTUK PRODUKSI (gemini-2.5-flash)
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: aiSystemPrompt }] }]
                    })
                });
                const result = await response.json();
                aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                break;
            }
        }

        if (!aiResponseText) {
            return res.status(500).json({ error: `Penyedia layanan ${provider.toUpperCase()} mengembalikan respon kosong.` });
        }

        // Jalankan extractor JSON tangguh
        const aiData = extractJSON(aiResponseText);

        // Ambil data video tambahan dari Pexels secara otomatis jika dikonfigurasi
        let pexelsVideos = [];
        const pexelsApiKey = process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY;
        
        if (pexelsApiKey && aiData.keyword) {
            try {
                const pexelsEndpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(aiData.keyword)}&per_page=6`;
                const pexelsResponse = await fetch(pexelsEndpoint, {
                    headers: { 'Authorization': pexelsApiKey }
                });
                if (pexelsResponse.ok) {
                    const pexelsData = await pexelsResponse.json();
                    pexelsVideos = (pexelsData.videos || []).map(v => ({
                        id: v.id,
                        image: v.image,
                        videoUrl: v.video_files.find(f => f.quality === 'sd' || f.width < 1280)?.link || v.video_files[0]?.link
                    }));
                }
            } catch (err) {
                console.error("Kesalahan API Pexels diabaikan:", err);
            }
        }

        // Kembalikan langsung objek data murni tanpa stringify berulang
        return res.status(200).json({ 
            data: aiData, 
            pexelsVideos: pexelsVideos 
        });

    } catch (err) {
        return res.status(500).json({ error: `Kesalahan Pemrosesan AI: ${err.message}` });
    }
}
