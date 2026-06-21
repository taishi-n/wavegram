import { computeSpectrogram } from "../audio/spectrogram";
import type { SpectrogramWorkerRequest } from "../types";

self.addEventListener("message", (event: MessageEvent<SpectrogramWorkerRequest>) => {
  try {
    const result = computeSpectrogram(event.data.samples, event.data.sampleRate, {
      fftSize: event.data.fftSize,
      hopSize: event.data.hopSize,
      windowType: event.data.windowType,
      minDb: event.data.minDb,
      maxDb: event.data.maxDb,
    });
    self.postMessage(result, [result.values.buffer]);
  } catch (cause) {
    self.postMessage({
      error: {
        message: cause instanceof Error ? cause.message : "Failed to compute spectrogram.",
      },
    });
  }
});
