import { CozeVoice } from "../types";
import voicesData from "../data/voices.json";

const BASE_URL = 'https://api.coze.cn/v1/audio';

export const fetchVoices = async (token: string): Promise<CozeVoice[]> => {
  if (!token) throw new Error("请输入身份令牌 (Token)");

  try {
    // 直接返回本地 JSON 数据
    return voicesData.voice_list as CozeVoice[];
  } catch (error) {
    console.error("Load Voices Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string, voice_id: string, token: string): Promise<Blob> => {
  if (!token) throw new Error("请输入身份令牌 (Token)");

  try {
    const response = await fetch(`${BASE_URL}/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        voice_id: voice_id,
        response_format: 'wav'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || `语音合成失败: ${response.status}`);
    }

    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Coze TTS Error:", error);
    throw error;
  }
};