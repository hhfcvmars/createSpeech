import React, { useState, useEffect } from 'react';
import { GeneratedAudio, CozeVoice } from './types';
import { generateSpeech, fetchVoices } from './services/geminiService';
import VoiceSelector from './components/VoiceSelector';
import AudioPlayer from './components/AudioPlayer';
import { Sparkles, History, Trash2, Wand2, KeyRound, Mic } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState('pat_SNrKGWEvavVbQ8zEPxnX157xeHcMBkeWW23Az6N1gvSbB9CBV6EtlUJ8Zrr6gh1R');
  const [text, setText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [voices, setVoices] = useState<CozeVoice[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [history, setHistory] = useState<GeneratedAudio[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch voices when token changes
  useEffect(() => {
    const loadVoices = async () => {
      if (!token || token.length < 10) {
        setVoices([]);
        return;
      }

      setIsLoadingVoices(true);
      setError(null);
      try {
        const fetchedVoices = await fetchVoices(token);
        setVoices(fetchedVoices);
        if (fetchedVoices.length > 0) {
          setSelectedVoiceId(fetchedVoices[0].voice_id);
        }
      } catch (err: any) {
        console.error(err);
        // Don't set global error immediately for voice fetch, just log it and clear voices
        // Maybe show a small warning near token input if needed
      } finally {
        setIsLoadingVoices(false);
      }
    };

    const timeoutId = setTimeout(() => {
      loadVoices();
    }, 800); // Debounce token input

    return () => clearTimeout(timeoutId);
  }, [token]);

  const handleGenerate = async () => {
    if (!token) {
      setError("请输入身份令牌 (Identity Token)");
      return;
    }
    if (!text.trim()) {
      setError("请输入需要合成的文本");
      return;
    }
    if (!selectedVoiceId) {
      setError("请选择一个音色");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const audioBlob = await generateSpeech(text, selectedVoiceId, token);
      const audioUrl = URL.createObjectURL(audioBlob);

      const selectedVoiceObj = voices.find(v => v.voice_id === selectedVoiceId);

      const newAudio: GeneratedAudio = {
        id: crypto.randomUUID(),
        text: text,
        voice_name: selectedVoiceObj?.name || 'Unknown',
        voice_id: selectedVoiceId,
        blob: audioBlob,
        url: audioUrl,
        timestamp: Date.now(),
      };

      setHistory((prev) => [newAudio, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "合成失败，请检查 Token 或网络设置");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearHistory = () => {
    history.forEach(item => URL.revokeObjectURL(item.url));
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Sparkles className="text-white h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">新手教程 语音工作室</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
              <span className="font-mono text-xs">API: api.coze.cn</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Controls */}
          <div className="lg:col-span-7 space-y-6">

            {/* Input Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">

              {/* Token Input */}
              <div className="space-y-3">
                <label htmlFor="token-input" className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <KeyRound size={14} />
                  身份令牌 (Identity Token)
                </label>
                <input
                  type="password"
                  id="token-input"
                  className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-3 bg-gray-50"
                  placeholder="请输入您的 Coze API Token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>

              {/* Text Input */}
              <div className="space-y-3">
                <label htmlFor="text-input" className="block text-sm font-medium text-gray-700">
                  文本输入 (Input Text)
                </label>
                <div className="relative">
                  <textarea
                    id="text-input"
                    rows={5}
                    className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base resize-none p-4 bg-gray-50"
                    placeholder="在此输入您想要合成语音的文本..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    {text.length} 字符
                  </div>
                </div>
              </div>

              {/* Voice Selection */}
              <VoiceSelector
                voices={voices}
                selectedVoiceId={selectedVoiceId}
                onSelect={setSelectedVoiceId}
                disabled={isGenerating || isLoadingVoices}
                isLoading={isLoadingVoices}
              />

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                  <div className="mt-0.5 font-bold">!</div>
                  <div>{error}</div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim() || !token}
                className={`
                  w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-white font-medium text-lg shadow-md transition-all
                  ${isGenerating || !text.trim() || !token
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.99]'}
                `}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    合成中 (Synthesizing)...
                  </>
                ) : (
                  <>
                    <Wand2 size={20} />
                    生成语音 (Generate)
                  </>
                )}
              </button>
            </div>

            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <h3 className="text-sm font-semibold text-indigo-900 mb-1">提示 (Tips)</h3>
              <p className="text-sm text-indigo-700">
                请确保您的 Token 具有 Audio 权限。不同的音色可能支持不同的语言，请尝试输入匹配的语言文本。
              </p>
            </div>
          </div>

          {/* Right Column: Results & History */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <History size={20} className="text-gray-500" />
                生成记录 (History)
              </h2>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                >
                  <Trash2 size={12} />
                  清空 (Clear)
                </button>
              )}
            </div>

            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                  <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-gray-300">
                    <Mic size={24} />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">暂无生成记录</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    输入 Token，选择音色并生成语音。
                  </p>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in-up">
                  {history.map((item) => (
                    <AudioPlayer key={item.id} audio={item} />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}