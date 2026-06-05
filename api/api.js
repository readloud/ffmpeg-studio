// Fungsi Serverless Vercel untuk memproses request AI & API pihak ketiga secara aman
export default async function handler(req, res) {
    // Hanya izinkan metode POST demi keamanan data
    if (req.method !== 'POST') {
        return res.status(455).json({ error: 'Metode tidak diizinkan. Gunakan POST.' });
    }

    const { activeName, customProvider, customApiKeyManual } = req.body;
    if (!activeName) {
        return res.status(400).json({ error: 'Nama audio aktif wajib disertakan.' });
    }

    // 1. Mengambil default API Keys dari Environment Variable Vercel (Sisi Server)
    const envApiKeys = {
        GEMINI: process.env.GEMINI_API_KEY,
        PEXELS: process.env.PEXELS_API_KEY,
        PIXABAY: process.env.PIXABAY_API_KEY,
        DEEPSEEK: process.env.DEEPSEEK_API_KEY,
        MIMO: process.env.MIMO_API_KEY,
        OPENAI: process.env.OPENAI_API_KEY,
        CLAUDE: process.env.CLAUDE_API_KEY,
        POLLINATIONS: process.env.POLLINATIONS_API_KEY,
        AIHUBMIX: process.env.AIHUBMIX_API_KEY,
        MOONSHOT: process.env.MOONSHOT_API_KEY,
        AZURE: process.env.AZURE_API_KEY,
        GROK: process.env.GROK_API_KEY,
        QWEN: process.env.QWEN_API_KEY,
        MINIMAX: process.env.MINIMAX_API_KEY,
        MODELSCOPE: process.env.MODELSCOPE_API_KEY,
        HUGHINGFACE: process.env.HUGHINGFACE_API_KEY
    };

    // Tentukan provider aktif (jika tidak dikirim dari front-end, default ke HUGHINGFACE)
    const selectedProvider = customProvider || 'HUGHINGFACE';

    // Prioritaskan API Key manual yang dimasukkan user dari front-end. Jika kosong, gunakan default server env
    const activeApiKeyForAnalysis = (customApiKeyManual && customApiKeyManual.trim() !== "") 
        ? customApiKeyManual 
        : envApiKeys[selectedProvider] || envApiKeys['GEMINI']; // Fallback global ke Gemini untuk fungsi analisis dasar

    if (!activeApiKeyForAnalysis) {
        return res.status(500).json({ 
            error: `Kunci API untuk provider ${selectedProvider} belum dikonfigurasi di client maupun server environment.` 
        });
    }

    // End-point konstruksi default menggunakan Google Gemini API Core Engine
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${envApiKeys['GEMINI'] || activeApiKeyForAnalysis}`;
    
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
            "topic": "Nama topik diskusi pendidikan/coding/keilmuan",
            "category": "Kategori bidang ilmu"
          }
        }
        Pastikan output hanya mengembalikan objek JSON valid tanpa Markdown backticks.
    `;

    let aiResultText = "";
    try {
        const aiResponse = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: aiSystemPrompt }] }]
            })
        });

        if (aiResponse.ok) {
            const aiDataJson = await aiResponse.json();
            aiResultText = aiDataJson.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Gagal melakukan panggilan API Generative.");
        }
    } catch (err) {
        // Fallback data jika request AI gagal terhubung
        aiResultText = JSON.stringify({
            contentType: "music",
            keyword: "lofi aesthetic",
            hexColor: "#a5b4fc",
            caption: "Menikmati harmoni melodi kehidupan digital ✨ #lofi #ambient #waveform",
            musicData: {
                title: "Aura Nostalgia",
                singer: "Rian Pratama",
                composer: "Dian Lesmana",
                album: "Gema Angkasa",
                genre: "Lofi / Ambient",
                releaseYear: "2026",
                lyrics: "Melangkah sunyi di antara gemintang senja\nMenanti rasa yang tertinggal di sana"
            }
        });
    }

    // 2. Bersihkan output text menjadi JSON valid objek
    let aiData = {};
    try {
        const cleanedJson = aiResultText.replace(/```json/g, '').replace(/```/g, '').trim();
        aiData = JSON.parse(cleanedJson);
    } catch (e) {
        try {
            aiData = JSON.parse(aiResultText);
        } catch (err) {
            return res.status(200).json({ data: { contentType: "music", keyword: "retro" }, pexelsVideos: [] });
        }
    }

    // 3. Pemanggilan ke API Pexels secara otomatis jika pencarian video dipicu
    let pexelsVideos = [];
    const pexelsKeyActive = envApiKeys['PEXELS'];
    if (pexelsKeyActive && aiData.keyword) {
        try {
            const pexelsEndpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(aiData.keyword)}&per_page=6`;
            const pexelsResponse = await fetch(pexelsEndpoint, {
                headers: { 'Authorization': pexelsKeyActive }
            });
            if (pexelsResponse.ok) {
                const pexelsData = await pexelsResponse.json();
                pexelsVideos = (pexelsData.videos || []).map(v => ({
                    id: v.id,
                    image: v.image,
                    videoUrl: v.video_files.find(f => f.quality === 'sd' || f.width < 1280)?.link || v.video_files[0]?.link
                }));
            }
        } catch (pexelsError) {
            console.error("Kesalahan API Pexels diabaikan agar proses AI tetap berjalan:", pexelsError);
        }
    }

    // 4. Kirimkan gabungan hasil akhir ke klien front-end
    return res.status(200).json({
        data: aiData,
        pexelsVideos: pexelsVideos,
        providerUsed: selectedProvider
    });
}
