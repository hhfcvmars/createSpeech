import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { GeneratedAudio } from '../types';

interface AudioPlayerProps {
  audio: GeneratedAudio;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audio }) => {
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
    a.download = `coze-speech-${audio.id.slice(0, 8)}.mp3`;
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 w-full animate-fade-in">
      <audio ref={audioRef} src={audio.url} />
      
      <div className="flex items-start justify-between mb-4">
        <div className="w-full">
           <div className="flex items-center gap-2 mb-1">
             <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 uppercase tracking-wide truncate max-w-[150px]">
               {audio.voice_name}
             </span>
             <span className="text-xs text-gray-500">
               {new Date(audio.timestamp).toLocaleTimeString()}
             </span>
           </div>
           <p className="text-sm text-gray-700 line-clamp-1 font-medium w-full" title={audio.text}>
             {audio.text}
           </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
        </button>

        <div className="flex-1 flex flex-col justify-center">
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
          className="flex-shrink-0 p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="下载 MP3"
        >
          <Download size={20} />
        </button>
      </div>
    </div>
  );
};

export default AudioPlayer;