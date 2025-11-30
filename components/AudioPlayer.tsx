import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, Plus } from 'lucide-react';
import { GeneratedAudio } from '../types';

interface AudioPlayerProps {
  audio: GeneratedAudio;
  onAddToTimeline?: (audio: GeneratedAudio) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audio, onAddToTimeline }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const updateTime = () => {
      if (audioElement.duration) {
        setDuration(audioElement.duration);
        setProgress((audioElement.currentTime / audioElement.duration) * 100);
        // 更新 audio 对象的 duration
        if (audio.duration !== audioElement.duration) {
          (audio as any).duration = audioElement.duration;
        }
      }
    };

    const handleEnded = () => setIsPlaying(false);

    audioElement.addEventListener('timeupdate', updateTime);
    audioElement.addEventListener('loadedmetadata', updateTime);
    audioElement.addEventListener('ended', handleEnded);

    return () => {
      audioElement.removeEventListener('timeupdate', updateTime);
      audioElement.removeEventListener('loadedmetadata', updateTime);
      audioElement.removeEventListener('ended', handleEnded);
    };
  }, [audio]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekTime = (Number(e.target.value) / 100) * duration;
    audioRef.current.currentTime = seekTime;
    setProgress(Number(e.target.value));
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = audio.url;
    a.download = `coze-speech-${audio.id.slice(0, 8)}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleAddToTimeline = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发拖拽
    // 确保 audio 对象有 duration
    const audioToAdd = {
      ...audio,
      duration: duration || audio.duration || 0
    };

    if (onAddToTimeline) {
      onAddToTimeline(audioToAdd);
    } else if ((window as any).__timelineAddAudio) {
      (window as any).__timelineAddAudio(audioToAdd);
    } else {
      console.warn('Timeline add function not available');
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 w-full animate-fade-in cursor-move hover:border-indigo-300 hover:shadow-md transition-all"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('audio/json', JSON.stringify(audio));
      }}
      title="拖拽到时间线进行编辑"
    >
      <audio ref={audioRef} src={audio.url} />

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-700 uppercase tracking-wide truncate max-w-[120px]">
              {audio.voice_name}
            </span>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {new Date(audio.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed" title={audio.text}>
            {audio.text}
          </p>
        </div>
        <button
          onClick={handleAddToTimeline}
          onMouseDown={(e) => e.stopPropagation()} // 阻止拖拽
          className="flex-shrink-0 p-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-all hover:scale-105 shadow-sm"
          title="添加到时间线"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col justify-center min-w-0">
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
            <span>{formatTime(duration || 0)}</span>
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="flex-shrink-0 p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title="下载音频"
        >
          <Download size={16} />
        </button>
      </div>
    </div>
  );
};

export default AudioPlayer;