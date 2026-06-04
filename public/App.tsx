import React, { useState } from 'react';
import { Send, Bot, Loader2, Sparkles } from 'lucide-react';

export default function App() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      // Simulasi panggilan ke backend Multi-Engine Anda
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setResponse(`Hasil analisis AI untuk: "${input}" menggunakan engine terbaru.`);
    } catch (error) {
      setResponse("Terjadi kesalahan saat memproses data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border p-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="text-blue-600" /> Multi-Engine AI Dashboard
        </h1>
        <textarea
          className="w-full p-4 border rounded-xl mb-4 h-32 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Masukkan prompt Anda di sini..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
          Jalankan Analisis
        </button>
        {response && (
          <div className="mt-6 p-4 bg-gray-100 rounded-xl border">
            <p className="flex items-center gap-2 font-medium mb-2"><Bot size={16}/> AI Response:</p>
            <p className="text-gray-700">{response}</p>
          </div>
        )}
      </div>
    </div>
  );
}