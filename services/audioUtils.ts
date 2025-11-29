/**
 * Decodes a base64 string into a Uint8Array
 */
export const decodeBase64 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Wraps raw PCM data in a WAV container.
 * Gemini usually returns 24kHz mono (1 channel) or stereo (check documentation, usually mono for TTS).
 * We will assume 24kHz, 1 channel for this implementation based on typical TTS outputs,
 * or auto-detect if we were using a full decoder.
 * 
 * For simplicity and robustness with Gemini's raw output, we construct the WAV header manually.
 */
export const pcmToWav = (pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true); // ChunkSize
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, numChannels * 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true); // Subchunk2Size

  // Write PCM data
  // The pcmData from Gemini is usually standard little-endian 16-bit PCM if requested or decoded simply.
  // Actually, Gemini API returns raw bytes. If they are float32, we need to convert.
  // However, the "Live API" examples use a decode function that treats input as Int16.
  // Let's copy the bytes directly assuming they are already in the correct byte format (Int16 Little Endian).
  const dataView = new Uint8Array(buffer, 44);
  dataView.set(pcmData);

  return new Blob([view], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};
