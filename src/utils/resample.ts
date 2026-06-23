export function pickChannel(buffer: AudioBuffer, channel: number | "mix"): Float32Array {
  if (channel === "mix") {
    const output = new Float32Array(buffer.length);
    for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < output.length; i += 1) {
        output[i] += data[i] / buffer.numberOfChannels;
      }
    }
    return output;
  }

  if (!Number.isInteger(channel) || channel < 0 || channel >= buffer.numberOfChannels) {
    throw new Error(`Invalid channel ${channel}. Audio has ${buffer.numberOfChannels} channel(s).`);
  }

  return new Float32Array(buffer.getChannelData(channel));
}

export function pickChannels(buffer: AudioBuffer, channel: number | "mix" | "all"): Float32Array[] {
  if (channel === "all") {
    return Array.from({ length: buffer.numberOfChannels }, (_, index) => new Float32Array(buffer.getChannelData(index)));
  }
  return [pickChannel(buffer, channel)];
}
