export interface CozeVoice {
  voice_id: string;
  name: string;
  language_code?: string;
  is_cloned?: boolean;
  // Fields from the actual JSON response
  preview_audio?: string;
  preview_text?: string;
  state?: string;
  is_system_voice?: boolean;
  available_training_times?: number;
}

export interface GeneratedAudio {
  id: string;
  text: string;
  voice_name: string;
  voice_id: string;
  blob: Blob;
  url: string;
  timestamp: number;
  duration?: number;
}

export interface TTSState {
  isGenerating: boolean;
  error: string | null;
  history: GeneratedAudio[];
}

export interface TimelineClip {
  id: string;
  audioId: string;
  startTime: number; // 在时间线中的开始时间（秒）
  audio: GeneratedAudio;
}

export interface TimelineState {
  clips: TimelineClip[];
  currentTime: number;
  isPlaying: boolean;
  duration: number;
}