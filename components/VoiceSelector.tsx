import React, { useState, useRef } from 'react';
import { CozeVoice } from '../types';
import { Check, Mic, Loader2, Play, Square } from 'lucide-react';

interface VoiceSelectorProps {
  voices: CozeVoice[];
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ 
  voices, 
  selectedVoiceId, 
  onSelect, 
  disabled,
  isLoading 
}) => {
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPreview = (e: React.MouseEvent, voice: CozeVoice) => {
    e.stopPropagation(); // Prevent selecting the voice when clicking play
    
    if (!voice.preview_audio) return;

    if (playingPreviewId === voice.voice_id) {
      // Stop playing
      audioRef.current?.pause();
      setPlayingPreviewId(null);
    } else {
      // Start playing new preview
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(voice.preview_audio);
      audio.onended = () => setPlayingPreviewId(null);
      audio.play().catch(err => console.error("Preview play failed", err));
      audioRef.current = audio;
      setPlayingPreviewId(voice.voice_id);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          选择音色 (Select Voice)
        </label>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-indigo-600">
            <Loader2 size={12} className="animate-spin" />
            <span>加载音色列表中...</span>
          </div>
        )}
      </div>
      
      {voices.length === 0 && !isLoading ? (
         <div className="p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center text-sm text-gray-500">
           <p>暂无可用音色</p>
           <p className="text-xs text-gray-400 mt-1">请确保 Token 正确且拥有 Audio 权限</p>
         </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {voices.map((voice) => (
            <div
              key={voice.voice_id}
              onClick={() => !disabled && onSelect(voice.voice_id)}
              className={`
                relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center group
                ${selectedVoiceId === voice.voice_id
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-600' 
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center justify-between w-full mb-2">
                 {/* Icon */}
                <div className={`p-1.5 rounded-full ${selectedVoiceId === voice.voice_id ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                  <Mic size={14} />
                </div>

                {/* Preview Button */}
                {voice.preview_audio && (
                  <button
                    onClick={(e) => handlePlayPreview(e, voice)}
                    className={`
                      p-1.5 rounded-full transition-colors
                      ${playingPreviewId === voice.voice_id 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600'}
                    `}
                    title="试听音色"
                  >
                    {playingPreviewId === voice.voice_id ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                  </button>
                )}
              </div>
              
              <span className="text-sm font-medium line-clamp-1 w-full text-left" title={voice.name}>
                {voice.name}
              </span>
              
              <div className="flex items-center justify-between w-full mt-1">
                 <span className="text-[10px] text-gray-400 border border-gray-100 px-1 rounded bg-gray-50">
                   {voice.language_code === 'zh' ? '中文' : voice.language_code === 'en' ? '英文' : voice.language_code || '未知'}
                 </span>
                 {selectedVoiceId === voice.voice_id && (
                    <div className="text-indigo-600">
                      <Check size={14} />
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VoiceSelector;