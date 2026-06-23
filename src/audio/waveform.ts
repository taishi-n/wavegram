import type { WaveformPeaks } from "../types";
import { pickChannel, pickChannels } from "../utils/resample";

export function computeWaveformPeaks(samples: Float32Array, width: number): WaveformPeaks {
  const columns = Math.max(1, Math.floor(width));
  const min = new Float32Array(columns);
  const max = new Float32Array(columns);
  const samplesPerColumn = samples.length / columns;

  for (let x = 0; x < columns; x += 1) {
    const start = Math.floor(x * samplesPerColumn);
    const end = Math.max(start + 1, Math.floor((x + 1) * samplesPerColumn));
    let low = 1;
    let high = -1;

    for (let i = start; i < end && i < samples.length; i += 1) {
      const value = samples[i] ?? 0;
      if (value < low) low = value;
      if (value > high) high = value;
    }

    min[x] = low === 1 ? 0 : low;
    max[x] = high === -1 ? 0 : high;
  }

  return { min, max };
}

export function computeWaveformPeaksFromBuffer(
  buffer: AudioBuffer,
  width: number,
  channel: number | "mix",
): WaveformPeaks {
  return computeWaveformPeaks(pickChannel(buffer, channel), width);
}

export function computeWaveformPeaksForChannelsFromBuffer(
  buffer: AudioBuffer,
  width: number,
  channel: number | "mix" | "all",
): WaveformPeaks[] {
  return pickChannels(buffer, channel).map((samples) => computeWaveformPeaks(samples, width));
}
