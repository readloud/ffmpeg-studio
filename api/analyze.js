// Helper untuk mengekstrak JSON secara tangguh dari teks respon AI
function extractJSON(text) {
  if (!text) throw new Error("Teks respon kosong dari penyedia AI.");

  // Hapus blok berpikir (thinking block) jika ada
  let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Coba parsing langsung dulu
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Lakukan scanning untuk menemukan JSON terluar (objek atau array) menggunakan bracket balancing
    const startChars = ['{', '['];
    const endMap = { '{': '}', '[': ']' };
    let startIdx = -1;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < cleanText.length; i++) {
      const ch = cleanText[i];

      if (!inString) {
        if (startIdx === -1 && startChars.includes(ch)) {
          startIdx = i;
          depth = 1;
          continue;
        } else if (startIdx !== -1 && ch === endMap[cleanText[startIdx]]) {
          depth--;
          if (depth === 0) {
            const candidate = cleanText.slice(startIdx, i + 1);
            try {
              return JSON.parse(candidate);
            } catch (innerErr) {
              // continue searching in case there's another JSON later
              startIdx = -1;
              depth = 0;
            }
          }
        } else if (startIdx !== -1 && startChars.includes(ch)) {
          depth++;
        }
      }

      // Handle string state and escapes to avoid miscounting brackets inside strings
      if (ch === '"' && !escape) {
        inString = !inString;
      }
      if (ch === '\\' && !escape) {
        escape = true;
      } else {
        escape = false;
      }
    }

    // Jika tidak ditemukan, coba regex non-greedy sebagai fallback untuk pertama objek/array
    const nonGreedyMatch = cleanText.match(/(\{[\s\S]*?\}|\[[\s\S]*?\])/);
    if (nonGreedyMatch) {
      try {
        return JSON.parse(nonGreedyMatch[0]);
      } catch (err) {
        throw new Error("Gagal mengurai JSON dari teks meskipun pola ditemukan.");
      }
    }

    throw new Error("Respon tidak mengandung format JSON yang valid { ... } atau [ ... ].");
  }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' });
    }

    const { activeName, provider = 'gemini' } = req.body;
    if (!activeName) {
        return res.status(422).json({ error: 'Nama audio aktif wajib disertakan.' });
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

			  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
				method: 'POST',
				headers: {
				  'Content-Type': 'application/json',
				  'Accept': 'application/json, text/plain',
				  'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
				  model: "deepseek-chat",
				  messages: [{ role: "user", content: aiSystemPrompt }],
				  response_format: { type: "json_object" }
				}),
				// optional: signal for timeout if you implement AbortController
			  });

			  // Log status & headers for debugging (hapus token jika log)
			  console.log('Deepseek status:', res.status, Object.fromEntries(res.headers.entries()));

			  let raw;
			  try {
				raw = await res.text(); // fallback ke text dulu
				// Jika kosong, tunjukkan info dan keluar
				if (!raw) throw new Error(`Empty response body (status ${res.status})`);
				// Coba parse JSON, tapi aman jika provider returns plain text
				let parsed;
				try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
				if (parsed) {
				  aiResponseText = parsed.choices?.[0]?.message?.content ?? parsed.output ?? JSON.stringify(parsed);
				} else {
				  aiResponseText = raw; // plain text
				}
			  } catch (err) {
				// capture body + status for support
				console.error('Deepseek parse error:', err, 'raw:', raw);
				throw err;
			  }

			  break;
			}

            case 'haiku': {
			  const apiKey = process.env.DEEPSEEK_API_KEY;
			  if (!apiKey) throw new Error("DEEPSEEK_API_KEY belum diatur di dashboard Vercel.");

			  const res = await fetch('https://api.deepseek.com/anthropic', {
				method: 'POST',
				headers: {
				  'Content-Type': 'application/json',
				  'Accept': 'application/json, text/plain',
				  'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
				  model: "deepseekv4-flash",
				  messages: [{ role: "user", content: aiSystemPrompt }],
				  response_format: { type: "json_object" }
				}),
				// optional: signal for timeout if you implement AbortController
			  });

			  // Log status & headers for debugging (hapus token jika log)
			  console.log('Deepseek status:', res.status, Object.fromEntries(res.headers.entries()));

			  let raw;
			  try {
				raw = await res.text(); // fallback ke text dulu
				// Jika kosong, tunjukkan info dan keluar
				if (!raw) throw new Error(`Empty response body (status ${res.status})`);
				// Coba parse JSON, tapi aman jika provider returns plain text
				let parsed;
				try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
				if (parsed) {
				  aiResponseText = parsed.choices?.[0]?.message?.content ?? parsed.output ?? JSON.stringify(parsed);
				} else {
				  aiResponseText = raw; // plain text
				}
			  } catch (err) {
				// capture body + status for support
				console.error('Deepseek parse error:', err, 'raw:', raw);
				throw err;
			  }

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

            case 'mimo': {
                const apiKey = process.env.MIMO_API_KEY;
                if (!apiKey) throw new Error("ANTHROPIC_AUTH_TOKEN belum diatur di dashboard Vercel.");
                
                const response = await fetch('https://api.mimo.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "mimo-v1",
                        messages: [{ role: "user", content: aiSystemPrompt }],
                        response_format: { type: "json_object" }
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
