let sharedAudioContext: AudioContext | undefined;

function getAudioContext(): AudioContext {
  sharedAudioContext ??= new AudioContext();
  return sharedAudioContext;
}

export async function decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const context = getAudioContext();
  return context.decodeAudioData(arrayBuffer.slice(0));
}
