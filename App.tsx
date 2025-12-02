import React, { useState, useEffect } from 'react';
import { GeneratedAudio, CozeVoice } from './types';
import { generateSpeech, fetchVoices } from './services/geminiService';
import VoiceSelector from './components/VoiceSelector';
import AudioPlayer from './components/AudioPlayer';
import Timeline from './components/Timeline';
import BatchImport, { BatchImportItem } from './components/BatchImport';
import { Sparkles, History, Trash2, Wand2, KeyRound, Mic, FileText, Download } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState('pat_chAECYsULaJhdJgXCpSfvilGnRSTtJnHv8iMPfFlQGPxXPTWtnwpbi7Mv2fq5rJv');
  const [text, setText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [voices, setVoices] = useState<CozeVoice[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [history, setHistory] = useState<GeneratedAudio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [batchImportProgress, setBatchImportProgress] = useState<{ current: number; total: number } | null>(null);

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

  // 导出所有生成记录
  const exportAllHistory = async () => {
    if (history.length === 0) {
      setError('没有可导出的记录');
      return;
    }

    try {
      // 创建一个 zip 文件或者分别下载每个音频
      // 这里我们采用简单的方式：为每个音频创建下载链接
      for (let i = 0; i < history.length; i++) {
        const item = history[i];
        const link = document.createElement('a');
        link.href = item.url;
        // 使用时间戳和音色名称作为文件名
        const timestamp = new Date(item.timestamp).toLocaleString('zh-CN').replace(/[/:]/g, '-');
        link.download = `${item.voice_name}_${timestamp}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 添加延迟避免浏览器阻止多个下载
        if (i < history.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (err: any) {
      console.error('导出失败:', err);
      setError('导出失败，请重试');
    }
  };

  // 批量导入处理
  const handleBatchImport = async (items: BatchImportItem[]) => {
    if (!token) {
      setError("请输入身份令牌 (Identity Token)");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setBatchImportProgress({ current: 0, total: items.length });

    const generatedAudios: GeneratedAudio[] = [];
    let currentTimelineTime = 0; // 当前时间线位置

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`处理第 ${i + 1} 个语音项:`, {
          text: item.text.substring(0, 20) + '...',
          voiceName: item.voiceName,
          breakTime: item.breakTime
        });
        setBatchImportProgress({ current: i + 1, total: items.length });

        try {
          // 生成语音
          const audioBlob = await generateSpeech(item.text, item.voiceId, token);
          const audioUrl = URL.createObjectURL(audioBlob);

          // 获取音频时长
          const audioEl = new Audio(audioUrl);
          const duration = await new Promise<number>((resolve) => {
            audioEl.addEventListener('loadedmetadata', () => {
              resolve(audioEl.duration);
            });
            audioEl.addEventListener('error', () => resolve(0));
            audioEl.load();
          });

          const newAudio: GeneratedAudio = {
            id: crypto.randomUUID(),
            text: item.text,
            voice_name: item.voiceName,
            voice_id: item.voiceId,
            blob: audioBlob,
            url: audioUrl,
            timestamp: Date.now(),
            duration: duration,
          };

          generatedAudios.push(newAudio);

          // 添加到历史记录
          setHistory((prev) => [newAudio, ...prev]);

          // 添加到时间线（使用已加载的时长）
          if (duration > 0 && (window as any).__timelineAddAudioWithTime) {
            console.log(`添加语音到时间线: 位置=${currentTimelineTime.toFixed(2)}s, 时长=${duration.toFixed(2)}s, 间隔=${item.breakTime || 0}s`);
            (window as any).__timelineAddAudioWithTime(newAudio, currentTimelineTime);
            // 更新时间线位置：当前音频结束时间 + 间隔时间
            currentTimelineTime += duration + (item.breakTime || 0);
            console.log(`更新时间线位置: ${currentTimelineTime.toFixed(2)}s`);
          } else if ((window as any).__timelineAddAudio) {
            // 如果时间线不支持指定时间，使用默认方式
            (window as any).__timelineAddAudio(newAudio);
            // 尝试更新时间线位置（如果可能）
            if (duration > 0) {
              currentTimelineTime += duration + (item.breakTime || 0);
            }
          }

          // 添加一个小延迟，避免API请求过快
          if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (err: any) {
          console.error(`生成第 ${i + 1} 个语音失败:`, err);
          setError(`第 ${i + 1} 个语音生成失败: ${err.message || '未知错误'}`);
          // 继续处理下一个
        }
      }
    } finally {
      setIsGenerating(false);
      setBatchImportProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Sparkles className="text-white h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">新手教程 文本转语音</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
              <span className="font-mono text-xs">API: api.coze.cn</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-64">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Controls */}
          <div className="lg:col-span-8 space-y-6">

            {/* Input Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">

              {/* Batch Import Progress */}
              {batchImportProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">
                      批量生成进度
                    </span>
                    <span className="text-sm text-blue-700">
                      {batchImportProgress.current} / {batchImportProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(batchImportProgress.current / batchImportProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Token Input */}


              {/* Text Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="text-input" className="block text-sm font-medium text-gray-700">
                    文本输入 (Input Text)
                  </label>
                  <button
                    onClick={() => setIsBatchImportOpen(true)}
                    disabled={isGenerating || !token || voices.length === 0}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isGenerating || !token || voices.length === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    <FileText size={16} />
                    批量导入
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    id="text-input"
                    rows={4}
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


          </div>

          {/* Right Column: Results & History */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <History size={18} className="text-gray-500" />
                生成记录
              </h2>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                >
                  <Trash2 size={12} />
                  清空
                </button>
              )}
            </div>

            {/* 导出所有记录按钮 */}
            {history.length > 0 && (
              <button
                onClick={exportAllHistory}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Download size={16} />
                导出所有记录 ({history.length})
              </button>
            )}

            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                  <div className="mx-auto w-10 h-10 bg-white rounded-full flex items-center justify-center mb-2 shadow-sm text-gray-300">
                    <Mic size={20} />
                  </div>
                  <h3 className="text-xs font-medium text-gray-900">暂无生成记录</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    选择音色并生成语音
                  </p>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in-up max-h-[calc(100vh-350px)] overflow-y-auto pr-1">{history.map((item) => (
                  <AudioPlayer
                    key={item.id}
                    audio={item}
                    onAddToTimeline={(audio) => {
                      // 通过 window 对象调用 Timeline 的添加函数
                      if ((window as any).__timelineAddAudio) {
                        (window as any).__timelineAddAudio(audio);
                      }
                    }}
                  />
                ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Timeline */}
      <Timeline history={history} />

      {/* Batch Import Modal */}
      <BatchImport
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        voices={voices}
        onImport={handleBatchImport}
        token={token}
      />
    </div>
  );
}