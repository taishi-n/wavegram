let sharedAudioContext: AudioContext | undefined;
let sharedAudioContextSampleRate: number | undefined;

function getAudioContext(sampleRate?: number): AudioContext {
  if (!sharedAudioContext || sharedAudioContextSampleRate !== sampleRate) {
    void sharedAudioContext?.close();
    sharedAudioContext = new AudioContext(sampleRate ? { sampleRate } : undefined);
    sharedAudioContextSampleRate = sampleRate;
  }
  return sharedAudioContext;
}

export async function decodeAudioData(arrayBuffer: ArrayBuffer, sampleRate?: number): Promise<AudioBuffer> {
  const context = getAudioContext(sampleRate);
  return context.decodeAudioData(arrayBuffer.slice(0));
}
