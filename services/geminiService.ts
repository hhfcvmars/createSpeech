import { CozeVoice } from "../types";

const BASE_URL = 'https://api.coze.cn/v1/audio';

export const fetchVoices = async (token: string): Promise<CozeVoice[]> => {
  if (!token) throw new Error("请输入身份令牌 (Token)");

  try {
    const response = await fetch(`${BASE_URL}/voices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || `获取音色失败: ${response.status}`);
    }

    const json = await response.json();
    
    // Check for the specific structure: { data: { voice_list: [] } }
    if (json.data && json.data.voice_list && Array.isArray(json.data.voice_list)) {
      return json.data.voice_list;
    }
    
    // Fallback: Coze API sometimes returns data wrapped directly in a data array property
    if (json.data && Array.isArray(json.data)) {
      return json.data;
    } else if (Array.isArray(json)) {
       return json;
    }
    
    console.warn("Unexpected API response structure:", json);
    return [];
  } catch (error) {
    console.error("Coze Fetch Voices Error:", error);
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
        response_format: 'mp3'
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