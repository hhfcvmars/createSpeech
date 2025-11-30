import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Trash2, Download, ZoomIn, ZoomOut, Move, CheckSquare, Square, AlertTriangle, X } from 'lucide-react';
import { GeneratedAudio, TimelineClip } from '../types';

interface TimelineProps {
  history: GeneratedAudio[];
  onExport?: (audioBlob: Blob) => void;
  onAddAudio?: (audio: GeneratedAudio) => void;
}

const PIXELS_PER_SECOND = 50; // 时间线缩放比例
const MIN_CLIP_WIDTH = 40; // 最小片段宽度（像素）

const Timeline: React.FC<TimelineProps> = ({ history, onExport, onAddAudio }) => {
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [draggedAudio, setDraggedAudio] = useState<GeneratedAudio | null>(null);
  const [draggedClip, setDraggedClip] = useState<TimelineClip | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [intervalSpacing, setIntervalSpacing] = useState(0); // 统一时间间隔（秒）
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // 显示删除确认对话框

  const timelineRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const playStartTimeRef = useRef<number>(0);
  const progressAnimationRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const clipsRef = useRef<TimelineClip[]>([]);
  const isDraggingRef = useRef<boolean>(false);

  // 同步 clips 到 ref
  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  // 初始化 AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // 加载音频为 AudioBuffer
  const loadAudioBuffer = useCallback(async (audio: GeneratedAudio): Promise<AudioBuffer> => {
    if (audioBuffersRef.current.has(audio.id)) {
      return audioBuffersRef.current.get(audio.id)!;
    }

    const arrayBuffer = await audio.blob.arrayBuffer();
    const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
    audioBuffersRef.current.set(audio.id, audioBuffer);
    return audioBuffer;
  }, []);

  // 从指定位置播放时间线
  const playTimelineFromTime = useCallback(async (startOffset: number = 0) => {
    if (!audioContextRef.current || clips.length === 0) return;

    try {
      // 恢复 AudioContext（如果被暂停）
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // 停止之前的播放
      sourceNodesRef.current.forEach(node => {
        try {
          node.stop();
        } catch (e) {
          // 忽略已停止的节点
        }
      });
      sourceNodesRef.current = [];

      const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
      const totalDuration = Math.max(...sortedClips.map(c => c.startTime + (c.audio.duration || 0)));
      
      // 限制起始位置在有效范围内
      const clampedStartOffset = Math.max(0, Math.min(startOffset, totalDuration));
      
      const audioContextTime = audioContextRef.current.currentTime;
      // 设置播放起始时间：当前 AudioContext 时间减去偏移量，这样计算出的 elapsed 就是实际播放位置
      playStartTimeRef.current = audioContextTime - clampedStartOffset;

      for (const clip of sortedClips) {
        const clipStartTime = clip.startTime;
        const clipDuration = clip.audio.duration || 0;
        const clipEndTime = clipStartTime + clipDuration;
        
        // 跳过完全在起始位置之前的片段
        if (clipEndTime <= clampedStartOffset) {
          continue;
        }
        
        const audioBuffer = await loadAudioBuffer(clip.audio);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        // 计算播放参数
        let playTime: number;
        let bufferOffset = 0;
        
        if (clampedStartOffset <= clipStartTime) {
          // 起始位置在片段开始之前或正好在开始位置，正常播放整个片段
          playTime = audioContextTime + (clipStartTime - clampedStartOffset);
        } else {
          // 起始位置在片段中间，从片段中间开始播放
          bufferOffset = clampedStartOffset - clipStartTime;
          playTime = audioContextTime; // 立即开始播放
        }

        source.start(playTime, bufferOffset);
        sourceNodesRef.current.push(source);

        source.onended = () => {
          // 检查是否所有音频都播放完毕
          const allEnded = sourceNodesRef.current.every(node => {
            try {
              return !node.buffer || node.playbackState === 'finished';
            } catch {
              return true;
            }
          });
          if (allEnded && isPlayingRef.current) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            setCurrentTime(0);
          }
        };
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
      setCurrentTime(clampedStartOffset);

      // 更新播放进度
      const updateProgress = () => {
        if (!audioContextRef.current || !isPlayingRef.current) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          return;
        }
        const elapsed = audioContextRef.current.currentTime - playStartTimeRef.current;

        if (elapsed < totalDuration) {
          setCurrentTime(Math.min(elapsed, totalDuration));
          progressAnimationRef.current = requestAnimationFrame(updateProgress);
        } else {
          setIsPlaying(false);
          isPlayingRef.current = false;
          setCurrentTime(0);
        }
      };
      progressAnimationRef.current = requestAnimationFrame(updateProgress);
    } catch (error) {
      console.error('播放失败:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  }, [clips, loadAudioBuffer]);

  // 播放时间线（从开始位置）
  const playTimeline = useCallback(async () => {
    await playTimelineFromTime(0);
  }, [playTimelineFromTime]);

  // 监听播放状态变化，更新进度
  useEffect(() => {
    if (!isPlaying && progressAnimationRef.current) {
      cancelAnimationFrame(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }
  }, [isPlaying]);

  // 停止播放
  const stopPlayback = useCallback(() => {
    sourceNodesRef.current.forEach(node => {
      try {
        node.stop();
      } catch (e) {
        // 忽略已停止的节点
      }
    });
    sourceNodesRef.current = [];
    if (progressAnimationRef.current) {
      cancelAnimationFrame(progressAnimationRef.current);
      progressAnimationRef.current = null;
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentTime(0);
  }, []);

  // 切换播放/暂停
  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      playTimeline();
    }
  };

  // 添加音频到时间线末尾
  const addAudioToTimeline = useCallback((audio: GeneratedAudio) => {
    console.log('Adding audio to timeline:', audio);

    // 使用 ref 获取最新的 clips，避免闭包问题
    const currentClips = clipsRef.current;

    // 计算应该添加的位置（最后一个片段结束的位置，或者0）
    const lastClipEnd = currentClips.length > 0
      ? Math.max(...currentClips.map(c => c.startTime + (c.audio.duration || 0)))
      : 0;

    // 获取音频时长
    const duration = audio.duration || 0;

    const addClip = (audioWithDuration: GeneratedAudio) => {
      const newClip: TimelineClip = {
        id: crypto.randomUUID(),
        audioId: audioWithDuration.id,
        startTime: lastClipEnd,
        audio: audioWithDuration,
      };
      setClips(prev => {
        const updated = [...prev, newClip].sort((a, b) => a.startTime - b.startTime);
        clipsRef.current = updated;
        console.log('Clip added, total clips:', updated.length);
        return updated;
      });
    };

    if (duration === 0 || isNaN(duration)) {
      // 如果还没有时长，创建一个临时音频元素来获取
      const audioEl = new Audio(audio.url);
      audioEl.addEventListener('loadedmetadata', () => {
        addClip({ ...audio, duration: audioEl.duration });
      });
      audioEl.addEventListener('error', () => {
        console.error('Failed to load audio metadata');
        // 即使失败也添加，使用默认时长
        addClip({ ...audio, duration: 0 });
      });
      audioEl.load();
    } else {
      addClip(audio);
    }
  }, []);

  // 添加音频到指定时间位置
  const addAudioToTimelineAtTime = useCallback((audio: GeneratedAudio, startTime: number) => {
    console.log('Adding audio to timeline at time:', startTime, audio);

    // 获取音频时长
    const duration = audio.duration || 0;

    const addClip = (audioWithDuration: GeneratedAudio) => {
      const newClip: TimelineClip = {
        id: crypto.randomUUID(),
        audioId: audioWithDuration.id,
        startTime: startTime,
        audio: audioWithDuration,
      };
      setClips(prev => {
        const updated = [...prev, newClip].sort((a, b) => a.startTime - b.startTime);
        clipsRef.current = updated;
        console.log('Clip added at time, total clips:', updated.length);
        return updated;
      });
    };

    if (duration === 0 || isNaN(duration)) {
      // 如果还没有时长，创建一个临时音频元素来获取
      const audioEl = new Audio(audio.url);
      audioEl.addEventListener('loadedmetadata', () => {
        addClip({ ...audio, duration: audioEl.duration });
      });
      audioEl.addEventListener('error', () => {
        console.error('Failed to load audio metadata');
        // 即使失败也添加，使用默认时长
        addClip({ ...audio, duration: 0 });
      });
      audioEl.load();
    } else {
      addClip(audio);
    }
  }, []);

  // 暴露添加函数给父组件
  useEffect(() => {
    // 始终暴露函数到 window，这样 AudioPlayer 可以调用
    (window as any).__timelineAddAudio = addAudioToTimeline;
    (window as any).__timelineAddAudioWithTime = addAudioToTimelineAtTime;
    return () => {
      delete (window as any).__timelineAddAudio;
      delete (window as any).__timelineAddAudioWithTime;
    };
  }, [addAudioToTimeline, addAudioToTimelineAtTime]);

  // 处理拖拽到时间线
  const handleTimelineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!timelineRef.current) return;

    // 尝试从 dataTransfer 获取音频数据
    let audio: GeneratedAudio | null = draggedAudio;

    try {
      const audioJson = e.dataTransfer.getData('audio/json');
      if (audioJson) {
        audio = JSON.parse(audioJson);
      }
    } catch (err) {
      console.error('Failed to parse audio data:', err);
    }

    if (!audio) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / (PIXELS_PER_SECOND * zoom));

    // 获取音频时长
    const duration = audio.duration || 0;
    if (duration === 0) {
      // 如果还没有时长，创建一个临时音频元素来获取
      const audioEl = new Audio(audio.url);
      audioEl.addEventListener('loadedmetadata', () => {
        const newClip: TimelineClip = {
          id: crypto.randomUUID(),
          audioId: audio.id,
          startTime: Math.max(0, time),
          audio: { ...audio, duration: audioEl.duration },
        };
        setClips(prev => [...prev, newClip].sort((a, b) => a.startTime - b.startTime));
      });
      audioEl.load();
    } else {
      const newClip: TimelineClip = {
        id: crypto.randomUUID(),
        audioId: audio.id,
        startTime: Math.max(0, time),
        audio: audio,
      };
      setClips(prev => [...prev, newClip].sort((a, b) => a.startTime - b.startTime));
    }

    setDraggedAudio(null);
  };

  // 处理片段拖拽开始
  const handleClipDragStart = (clip: TimelineClip, e: React.MouseEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true; // 标记开始拖拽
    
    // 如果拖拽的片段未选中，且没有按住 Command 键，先选中它
    if (!selectedClips.has(clip.id) && !e.metaKey && !e.ctrlKey) {
      setSelectedClips(new Set([clip.id]));
    }
    setDraggedClip(clip);
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x / (PIXELS_PER_SECOND * zoom));
      setDragOffset(time - clip.startTime);
    }
  };

  // 处理片段拖拽
  const handleClipDrag = (e: React.MouseEvent) => {
    if (!draggedClip || !timelineRef.current) return;
    e.preventDefault();

    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const time = (x / (PIXELS_PER_SECOND * zoom)) - dragOffset;

    setClips(prev => prev.map(c =>
      c.id === draggedClip.id
        ? { ...c, startTime: Math.max(0, time) }
        : c
    ).sort((a, b) => a.startTime - b.startTime));
  };

  // 处理片段拖拽结束
  const handleClipDragEnd = () => {
    setDraggedClip(null);
    setDragOffset(0);
    // 延迟重置拖拽标志，避免触发点击事件
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  // 处理时间线点击（切换播放位置）
  const handleTimelineClick = (e: React.MouseEvent) => {
    // 如果正在拖拽片段，不处理点击
    if (draggedClip || isDraggingRef.current) {
      return;
    }

    // 如果点击的是片段本身，不处理（让片段自己的点击事件处理）
    if ((e.target as HTMLElement).closest('[data-clip]')) {
      return;
    }

    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedTime = Math.max(0, x / (PIXELS_PER_SECOND * zoom));

    // 计算总时长
    const totalDuration = clips.length > 0
      ? Math.max(...clips.map(c => c.startTime + (c.audio.duration || 0)))
      : 0;

    // 限制点击位置在有效范围内
    const clampedTime = Math.min(clickedTime, totalDuration);

    // 更新播放位置
    if (isPlaying) {
      // 如果正在播放，从新位置重新开始播放
      playTimelineFromTime(clampedTime);
    } else {
      // 如果未播放，只更新位置
      setCurrentTime(clampedTime);
    }
  };

  // 处理片段点击选中（支持 Command/Ctrl 键多选）
  const handleClipClick = (clip: TimelineClip, e: React.MouseEvent) => {
    e.stopPropagation();
    // 如果是拖拽操作，不处理点击
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    
    const isCommandKey = e.metaKey || e.ctrlKey;
    
    if (isCommandKey) {
      // Command/Ctrl 键：切换选中状态
      setSelectedClips(prev => {
        const newSet = new Set(prev);
        if (newSet.has(clip.id)) {
          newSet.delete(clip.id);
        } else {
          newSet.add(clip.id);
        }
        return newSet;
      });
    } else {
      // 普通点击：单选
      setSelectedClips(new Set([clip.id]));
    }
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedClips.size === clips.length && clips.length > 0) {
      // 如果已全部选中，则取消全选
      setSelectedClips(new Set());
    } else {
      // 全选所有片段
      setSelectedClips(new Set(clips.map(c => c.id)));
    }
  };

  // 显示删除确认对话框
  const handleDeleteClick = () => {
    if (selectedClips.size > 0) {
      setShowDeleteConfirm(true);
    }
  };

  // 确认删除选中的片段（支持多选）
  const confirmDeleteSelectedClips = () => {
    if (selectedClips.size > 0) {
      setClips(prev => prev.filter(c => !selectedClips.has(c.id)));
      setSelectedClips(new Set());
    }
    setShowDeleteConfirm(false);
  };

  // 取消删除
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // 统一调整选中片段的时间间隔
  const applyIntervalSpacing = () => {
    if (selectedClips.size === 0) return;
    
    const sortedSelectedClips = clips
      .filter(c => selectedClips.has(c.id))
      .sort((a, b) => a.startTime - b.startTime);
    
    if (sortedSelectedClips.length === 0) return;
    
    setClips(prev => {
      // 创建一个映射来存储每个片段的新位置
      const newPositions = new Map<string, number>();
      
      // 第一个片段位置保持不变
      const firstClip = sortedSelectedClips[0];
      let currentEndTime = firstClip.startTime + (firstClip.audio.duration || 0);
      newPositions.set(firstClip.id, firstClip.startTime);
      
      // 从第二个片段开始，依次计算新位置
      for (let i = 1; i < sortedSelectedClips.length; i++) {
        const clip = sortedSelectedClips[i];
        const newStartTime = currentEndTime + intervalSpacing;
        newPositions.set(clip.id, Math.max(0, newStartTime));
        currentEndTime = newStartTime + (clip.audio.duration || 0);
      }
      
      // 更新所有片段的位置
      const updated = prev.map(clip => {
        if (newPositions.has(clip.id)) {
          return {
            ...clip,
            startTime: newPositions.get(clip.id)!
          };
        }
        return clip;
      });
      
      return updated.sort((a, b) => a.startTime - b.startTime);
    });
    
    setIntervalSpacing(0); // 重置间隔输入
  };



  // 合成音频
  const exportAudio = async () => {
    if (clips.length === 0) return;

    try {
      const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
      const totalDuration = Math.max(...sortedClips.map(c => c.startTime + (c.audio.duration || 0)));

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const sampleRate = audioContextRef.current.sampleRate;
      const totalSamples = Math.ceil(totalDuration * sampleRate);
      const audioBuffer = audioContextRef.current.createBuffer(1, totalSamples, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // 填充静音
      channelData.fill(0);

      // 将每个片段添加到对应位置
      for (const clip of sortedClips) {
        const sourceBuffer = await loadAudioBuffer(clip.audio);
        const startSample = Math.floor(clip.startTime * sampleRate);
        const sourceData = sourceBuffer.getChannelData(0);
        const length = Math.min(sourceData.length, totalSamples - startSample);

        for (let i = 0; i < length; i++) {
          if (startSample + i < channelData.length) {
            channelData[startSample + i] += sourceData[i];
          }
        }
      }

      // 转换为 MP3（如果失败则使用 WAV）
      console.log('开始转换为 MP3 格式...');
      const audioBlob = await audioBufferToMp3(audioBuffer);
      const isMp3 = audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3');
      console.log(`${isMp3 ? 'MP3' : 'WAV'} 转换完成，文件大小:`, audioBlob.size, 'bytes, MIME 类型:', audioBlob.type);
      
      if (onExport) {
        onExport(audioBlob);
      } else {
        // 默认下载，根据实际格式设置文件扩展名
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `合成音频-${Date.now()}.${isMp3 ? 'mp3' : 'wav'}`;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`${isMp3 ? 'MP3' : 'WAV'} 文件下载已触发，文件名:`, a.download);
      }
    } catch (error) {
      console.error('合成失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`音频合成失败: ${errorMessage}\n请检查浏览器控制台获取详细信息。`);
    }
  };

  // AudioBuffer 转 MP3（如果失败则回退到 WAV）
  const audioBufferToMp3 = async (buffer: AudioBuffer): Promise<Blob> => {
    try {
      // 动态加载 lamejs（使用 CDN）
      let lamejs: any;
      
      // 检查全局变量（如果已经通过 script 标签加载）
      if (typeof window !== 'undefined' && (window as any).Lame) {
        lamejs = (window as any).Lame;
      } else {
        // 通过 script 标签加载 CDN 版本
        await new Promise<void>((resolve, reject) => {
          // 检查是否已经加载
          if ((window as any).Lame) {
            lamejs = (window as any).Lame;
            resolve();
            return;
          }
          
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.0/lame.min.js';
          script.onload = () => {
            lamejs = (window as any).Lame;
            if (!lamejs) {
              reject(new Error('lamejs 加载失败：全局对象 Lame 不存在'));
              return;
            }
            resolve();
          };
          script.onerror = () => {
            reject(new Error('无法从 CDN 加载 lamejs'));
          };
          document.head.appendChild(script);
        });
      }

      // 检查 lamejs 是否可用
      if (!lamejs || !lamejs.Mp3Encoder) {
        throw new Error('lamejs MP3 encoder not available');
      }

      const numberOfChannels = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const length = buffer.length;
      
      // 将 AudioBuffer 转换为 Int16Array（PCM 数据）
      const samples: Int16Array[] = [];
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        const int16Array = new Int16Array(length);
        for (let i = 0; i < length; i++) {
          // 将浮点数 (-1.0 到 1.0) 转换为 16 位整数 (-32768 到 32767)
          const s = Math.max(-1, Math.min(1, channelData[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        samples.push(int16Array);
      }

      // 配置 MP3 编码器
      const kbps = 128; // 比特率
      const mp3encoder = new lamejs.Mp3Encoder(numberOfChannels, sampleRate, kbps);
      const sampleBlockSize = 1152; // MP3 编码的块大小
      const mp3Data: Int8Array[] = [];

      // 编码音频数据
      if (numberOfChannels === 1) {
        // 单声道
        for (let i = 0; i < samples[0].length; i += sampleBlockSize) {
          const sampleChunk = samples[0].subarray(i, i + sampleBlockSize);
          const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
        }
      } else {
        // 立体声
        for (let i = 0; i < samples[0].length; i += sampleBlockSize) {
          const leftChunk = samples[0].subarray(i, i + sampleBlockSize);
          const rightChunk = samples[1].subarray(i, i + sampleBlockSize);
          const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
        }
      }

      // 完成编码（刷新缓冲区）
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }

      // 检查是否有编码数据
      if (mp3Data.length === 0 || mp3Data.reduce((sum, arr) => sum + arr.length, 0) === 0) {
        throw new Error('MP3 encoding produced no data');
      }

      // 合并所有 MP3 数据块
      const totalLength = mp3Data.reduce((sum, arr) => sum + arr.length, 0);
      const result = new Int8Array(totalLength);
      let offset = 0;
      for (const arr of mp3Data) {
        result.set(arr, offset);
        offset += arr.length;
      }

      // 确保返回 MP3 格式的 Blob
      return new Blob([result], { type: 'audio/mpeg' });
    } catch (error) {
      console.error('MP3 encoding error:', error);
      // 如果 MP3 编码失败，回退到 WAV
      console.log('MP3 编码失败，回退到 WAV 格式');
      return audioBufferToWav(buffer);
    }
  };

  // AudioBuffer 转 WAV（备选方案）
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // 写入音频数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (mins === 0) {
      return `${secs}s`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算总时长
  const totalDuration = clips.length > 0
    ? Math.max(...clips.map(c => c.startTime + (c.audio.duration || 0)))
    : 0;

  // 生成时间刻度
  const generateTimeMarkers = () => {
    const markers = [];
    const interval = zoom < 0.5 ? 10 : zoom < 1 ? 5 : 1; // 根据缩放调整间隔
    const maxTime = Math.max(totalDuration, 10);

    for (let i = 0; i <= maxTime; i += interval) {
      markers.push(i);
    }
    return markers;
  };

  const timeMarkers = generateTimeMarkers();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-slate-50 to-slate-100 border-t-2 border-indigo-200 shadow-2xl pb-6 z-40">
      <div className="max-w-7xl mx-auto px-6">
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
          <div className="flex items-center gap-4">
            {/* 播放/暂停按钮 */}
            <button
              onClick={togglePlay}
              disabled={clips.length === 0}
              className={`p-3 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 ${clips.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                }`}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* 时间显示 */}
            <div className="flex flex-col">
              <span className="text-xs font-mono font-semibold text-indigo-600 tracking-wider">
                {formatTime(currentTime)}
              </span>
              <span className="text-[10px] text-gray-400">
                / {formatTime(totalDuration)}
              </span>
            </div>

            {/* 片段数量 */}
            {clips.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                <Move size={14} className="text-indigo-600" />
                <span className="text-xs font-medium text-indigo-700">
                  {clips.length} 个片段
                </span>
              </div>
            )}

            {/* 全选按钮 */}
            {clips.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg border border-indigo-200 transition-colors"
                title={selectedClips.size === clips.length ? "取消全选" : "全选"}
              >
                {selectedClips.size === clips.length && clips.length > 0 ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                <span className="text-xs font-medium">全选</span>
              </button>
            )}

            {/* 删除选中片段按钮 */}
            {selectedClips.size > 0 && (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors"
              >
                <Trash2 size={14} />
                <span className="text-xs font-medium">删除选中({selectedClips.size})</span>
              </button>
            )}

            {/* 统一调整时间间隔 */}
            {selectedClips.size > 1 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-xs text-blue-700 font-medium">间隔:</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={intervalSpacing}
                  onChange={(e) => setIntervalSpacing(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-xs border border-blue-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="秒"
                />
                <button
                  onClick={applyIntervalSpacing}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  应用
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* 缩放控制 */}
            <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
              <button
                onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
                className="p-2 hover:bg-indigo-50 rounded-lg transition-colors text-slate-600 hover:text-indigo-600"
                title="缩小"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-semibold text-slate-700 px-3 min-w-[50px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                className="p-2 hover:bg-indigo-50 rounded-lg transition-colors text-slate-600 hover:text-indigo-600"
                title="放大"
              >
                <ZoomIn size={16} />
              </button>
            </div>

            {/* 导出按钮 */}
            <button
              onClick={exportAudio}
              disabled={clips.length === 0}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 ${clips.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
                }`}
            >
              <Download size={16} />
              导出音频
            </button>
          </div>
        </div>

        {/* 时间线 */}
        <div
          ref={timelineRef}
          className="relative bg-gradient-to-b from-slate-50 to-slate-100 overflow-x-auto cursor-pointer"
          onDrop={handleTimelineDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={handleTimelineClick}
          onMouseMove={draggedClip ? handleClipDrag : undefined}
          onMouseUp={draggedClip ? handleClipDragEnd : undefined}
          onMouseLeave={draggedClip ? handleClipDragEnd : undefined}
          style={{ height: '100px' }}
        >
          {/* 时间刻度 */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white to-slate-50 border-b-2 border-slate-200">
            {timeMarkers.map((time) => (
              <div
                key={time}
                className="absolute border-l border-slate-300"
                style={{
                  left: `${time * PIXELS_PER_SECOND * zoom}px`,
                  height: '100%',
                }}
              >
                <span className="absolute top-1 left-1 text-xs font-mono font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-sm">
                  {formatTime(time)}
                </span>
              </div>
            ))}
          </div>

          {/* 播放头 */}
          {isPlaying && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{
                left: `${currentTime * PIXELS_PER_SECOND * zoom}px`,
              }}
            >
              <div className="w-1 h-full bg-gradient-to-b from-red-500 to-pink-600 shadow-lg" />
              <div className="absolute -top-1 -left-2 w-5 h-5 bg-red-500 rounded-full shadow-lg border-2 border-white animate-pulse" />
            </div>
          )}

          {/* 音频片段 */}
          <div className="absolute top-8 left-0 right-0 bottom-0 pt-4">
            {clips.map((clip) => {
              const width = (clip.audio.duration || 0) * PIXELS_PER_SECOND * zoom;
              const isSelected = selectedClips.has(clip.id);
              return (
                <div
                  key={clip.id}
                  data-clip
                  onMouseDown={(e) => handleClipDragStart(clip, e)}
                  onClick={(e) => {
                    e.stopPropagation(); // 阻止时间线的点击事件
                    handleClipClick(clip, e);
                  }}
                  className={`absolute bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 rounded-lg cursor-move group shadow-lg hover:shadow-xl transition-all duration-200 ${isSelected
                      ? 'border-4 border-yellow-400 ring-2 ring-yellow-300'
                      : 'border-2 border-indigo-400'
                    }`}
                  style={{
                    left: `${clip.startTime * PIXELS_PER_SECOND * zoom}px`,
                    width: `${Math.max(MIN_CLIP_WIDTH, width)}px`,
                    height: '44px',
                    top: '8px',
                  }}
                  title={`${clip.audio.text} (${formatTime(clip.audio.duration || 0)})`}
                >
                  {/* 波形效果背景 */}
                  <div className="absolute inset-0 opacity-20 overflow-hidden rounded-lg">
                    <div className="h-full flex items-center justify-around px-1">
                      {Array.from({ length: Math.floor(width / 4) }).map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-white rounded-full"
                          style={{
                            height: `${20 + Math.random() * 60}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 内容 */}
                  <div className="relative flex items-center justify-between h-full px-3 text-white">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs font-semibold truncate">{clip.audio.voice_name}</span>
                      <span className="text-[10px] opacity-80 truncate">{formatTime(clip.audio.duration || 0)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">确认删除</h3>
              </div>

              {/* Content */}
              <div className="mb-6">
                <p className="text-sm text-gray-700">
                  确定要删除选中的 <span className="font-semibold text-red-600">{selectedClips.size}</span> 个音频片段吗？
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  此操作无法撤销
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteSelectedClips}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timeline;

