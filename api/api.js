// Helper untuk mengekstrak JSON secara tangguh dari teks respon AI
function extractJSON(text) {
  if (!text) throw new Error("Teks respon kosong dari penyedia AI.");

  // Hapus blok berpikir (thinking block) jika ada
  let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  
  // Hapus markdown code blocks jika ada
  cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

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

// Helper untuk membangun prompt
function buildPrompts(activeName) {
  const systemPrompt = `Anda adalah asisten produser konten audio visual profesional yang sangat berpengalaman. 
Anda harus selalu merespon dengan format JSON yang valid dan lengkap.`;

  const userPrompt = `Analisis judul audio berikut: "${activeName}".
Deteksi apakah file ini lebih cocok dikategorikan sebagai "music" (lagu/musik) atau "edu" (diskusi, podcast edukasi, pembahasan coding, sains, keilmuan).

Berikan respon terstruktur dalam format JSON dengan kunci berikut:
{
  "contentType": "music" atau "edu",
  "keyword": "Kata kunci gambar/video latar belakang estetik dalam bahasa inggris (2-3 kata)",
  "hexColor": "Satu kode hex warna yang cocok untuk visualisasi waveform (contoh: #4A90E2)",
  "caption": "Satu kalimat caption promosi media sosial estetik bahasa indonesia lengkap dengan tagar (maks 280 karakter)",
  
  "musicData": {
    "title": "Nama judul lagu fiktif/asli yang cocok",
    "singer": "Nama penyanyi yang cocok",
    "composer": "Nama pencipta lagu/komposer",
    "album": "Nama album",
    "genre": "Genre musik (contoh: Pop, Rock, Jazz, Electronic, Classical)",
    "releaseYear": "Tahun rilis (contoh: 2024)",
    "lyrics": "Dua baris lirik lagu puitis bahasa indonesia yang indah sesuai getaran judul lagu"
  },
  
  "eduData": {
    "topic": "Nama topik diskusi pendidikan/coding/keilmuan fiktif/asli yang cocok",
    "category": "Kategori keilmuan (misal: Kecerdasan Buatan, Desain Grafis, Pemrograman Web, Data Science)",
    "links": [
      { "name": "Nama situs web edukasi terkenal terkait", "url": "https://contoh.com" },
      { "name": "Nama forum komunitas diskusi/wiki terkait", "url": "https://contoh-forum.com" }
    ]
  }
}

PENTING: 
1. Jika contentType = "music", isi musicData dengan lengkap, dan eduData boleh null atau tidak perlu ada
2. Jika contentType = "edu", isi eduData dengan lengkap, dan musicData boleh null atau tidak perlu ada
3. HANYA BALAS DENGAN JSON VALID, tidak ada teks lain di luar JSON
4. Pastikan JSON valid (tidak ada trailing comma, semua string pakai double quote)`;

  return { systemPrompt, userPrompt };
}

// Helper untuk validasi response AI
function validateAIResponse(data) {
  if (!data.contentType || !['music', 'edu'].includes(data.contentType)) {
    throw new Error('contentType harus "music" atau "edu"');
  }
  
  if (!data.keyword || typeof data.keyword !== 'string') {
    throw new Error('keyword harus berupa string');
  }
  
  if (!data.hexColor || !/^#[0-9A-Fa-f]{6}$/.test(data.hexColor)) {
    throw new Error('hexColor harus format hex color valid (contoh: #4A90E2)');
  }
  
  if (!data.caption || typeof data.caption !== 'string') {
    throw new Error('caption harus berupa string');
  }
  
  if (data.contentType === 'music') {
    if (!data.musicData || typeof data.musicData !== 'object') {
      throw new Error('musicData harus diisi untuk tipe music');
    }
    const requiredMusicFields = ['title', 'singer', 'composer', 'album', 'genre', 'releaseYear', 'lyrics'];
    for (const field of requiredMusicFields) {
      if (!data.musicData[field]) {
        throw new Error(`musicData.${field} harus diisi`);
      }
    }
  } else if (data.contentType === 'edu') {
    if (!data.eduData || typeof data.eduData !== 'object') {
      throw new Error('eduData harus diisi untuk tipe edu');
    }
    if (!data.eduData.topic || !data.eduData.category) {
      throw new Error('eduData.topic dan eduData.category harus diisi');
    }
    if (!Array.isArray(data.eduData.links) || data.eduData.links.length < 2) {
      throw new Error('eduData.links harus berupa array dengan minimal 2 item');
    }
  }
  
  return true;
}

// Provider implementations
const providers = {
  async gemini(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: fullPrompt }] 
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiResponse) {
      throw new Error('Gemini mengembalikan response kosong');
    }
    
    return aiResponse;
  },
  
  async deepseek(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('DeepSeek mengembalikan response kosong');
    }
    
    return aiResponse;
  },
  
  async claude(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ 
          role: "user", 
          content: userPrompt 
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.content?.[0]?.text;
    
    if (!aiResponse) {
      throw new Error('Claude mengembalikan response kosong');
    }
    
    return aiResponse;
  },
  
  async grok(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('Grok mengembalikan response kosong');
    }
    
    return aiResponse;
  },
  
  async openai(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('OpenAI mengembalikan response kosong');
    }
    
    return aiResponse;
  },
  
  async mistral(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('Mistral mengembalikan response kosong');
    }
    
    return aiResponse;
  },
  
  async cohere(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    
    const response = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "command-r-plus",
        message: userPrompt,
        preamble: systemPrompt,
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cohere API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.text;
    
    if (!aiResponse) {
      throw new Error('Cohere mengembalikan response kosong');
    }
    
    return aiResponse;
  },
  
  async perplexity(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('Perplexity mengembalikan response kosong');
    }
    
    return aiResponse;
  },
  
  async together(activeName, apiKey) {
    const { systemPrompt, userPrompt } = buildPrompts(activeName);
    
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "meta-llama/Llama-3-70b-chat-hf",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Together API error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('Together mengembalikan response kosong');
    }
    
    return aiResponse;
  }
};

// Main handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' });
  }
  
  const { activeName, provider = 'gemini' } = req.body;
  
  if (!activeName || typeof activeName !== 'string' || activeName.trim() === '') {
    return res.status(422).json({ error: 'Nama audio aktif wajib disertakan dan harus berupa string valid.' });
  }
  
  // Map provider names to environment variables
  const providerConfig = {
    gemini: { key: process.env.GEMINI_API_KEY, name: 'Gemini' },
    deepseek: { key: process.env.DEEPSEEK_API_KEY, name: 'DeepSeek' },
    claude: { key: process.env.CLAUDE_API_KEY, name: 'Claude' },
    grok: { key: process.env.GROK_API_KEY, name: 'Grok' },
    openai: { key: process.env.OPENAI_API_KEY, name: 'OpenAI' },
    mistral: { key: process.env.MISTRAL_API_KEY, name: 'Mistral' },
    cohere: { key: process.env.COHERE_API_KEY, name: 'Cohere' },
    perplexity: { key: process.env.PERPLEXITY_API_KEY, name: 'Perplexity' },
    together: { key: process.env.TOGETHER_API_KEY, name: 'Together' }
  };
  
  const config = providerConfig[provider.toLowerCase()];
  
  if (!config) {
    return res.status(400).json({ 
      error: `Provider "${provider}" tidak didukung. Gunakan: ${Object.keys(providerConfig).join(', ')}` 
    });
  }
  
  if (!config.key) {
    return res.status(500).json({ 
      error: `${config.name} API key belum diatur di environment variables.` 
    });
  }
  
  try {
    console.log(`Memproses dengan provider: ${config.name} untuk audio: "${activeName}"`);
    
    // Panggil provider yang sesuai
    const providerFn = providers[provider.toLowerCase()];
    if (!providerFn) {
      throw new Error(`Provider ${provider} tidak ditemukan`);
    }
    
    const aiResponseText = await providerFn(activeName.trim(), config.key);
    
    console.log(`Response diterima dari ${config.name}, panjang: ${aiResponseText.length} karakter`);
    
    // Ekstrak JSON dari response
    let aiData;
    try {
      aiData = extractJSON(aiResponseText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response (first 500 chars):', aiResponseText.substring(0, 500));
      throw new Error(`Gagal parsing JSON dari response AI: ${parseError.message}`);
    }
    
    // Validasi struktur data
    try {
      validateAIResponse(aiData);
    } catch (validationError) {
      console.error('Validation Error:', validationError);
      console.error('Invalid data structure:', JSON.stringify(aiData, null, 2));
      throw new Error(`Response AI tidak valid: ${validationError.message}`);
    }
    
    // Fetch video dari Pexels (opsional)
    let pexelsVideos = [];
    const pexelsApiKey = process.env.PEXELS_API_KEY;
    
    if (pexelsApiKey && aiData.keyword) {
      try {
        console.log(`Mencari video Pexels dengan keyword: "${aiData.keyword}"`);
        const pexelsEndpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(aiData.keyword)}&per_page=6&orientation=landscape`;
        
        const pexelsResponse = await fetch(pexelsEndpoint, {
          headers: { 
            'Authorization': pexelsApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5 second timeout
        });
        
        if (pexelsResponse.ok) {
          const pexelsData = await pexelsResponse.json();
          pexelsVideos = (pexelsData.videos || [])
            .filter(v => v.video_files && v.video_files.length > 0)
            .map(v => ({
              id: v.id,
              image: v.image,
              duration: v.duration,
              videoUrl: v.video_files.find(f => f.quality === 'sd' || f.width <= 1280)?.link || v.video_files[0]?.link,
              videoFiles: v.video_files // tambahkan untuk opsi lebih banyak
            }))
            .filter(v => v.videoUrl); // hanya yang punya video url
          
          console.log(`Ditemukan ${pexelsVideos.length} video dari Pexels`);
        } else {
          console.warn(`Pexels API error: ${pexelsResponse.status}`);
        }
      } catch (err) {
        console.error("Kesalahan fetch Pexels:", err.message);
        // Tidak throw error, lanjutkan tanpa video
      }
    }
    
    // Return success response
    return res.status(200).json({ 
      success: true,
      provider: config.name,
      data: aiData, 
      pexelsVideos: pexelsVideos,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Error detail:', {
      message: err.message,
      stack: err.stack,
      provider: provider
    });
    
    return res.status(500).json({ 
      success: false,
      error: `Kesalahan Pemrosesan AI: ${err.message}`,
      provider: provider,
      timestamp: new Date().toISOString()
    });
  }
}