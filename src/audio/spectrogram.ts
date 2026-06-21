import type { SpectrogramData, SpectrogramOptions, WindowType } from "../types";
import { clamp } from "../utils/clamp";

const EPS = 1e-10;

export function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

export function createWindow(size: number, type: WindowType): Float32Array {
  const window = new Float32Array(size);
  if (size === 1) {
    window[0] = 1;
    return window;
  }

  for (let i = 0; i < size; i += 1) {
    if (type === "hann") {
      window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    } else if (type === "hamming") {
      window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
    } else {
      window[i] = 1;
    }
  }
  return window;
}

export function coherentGain(window: Float32Array): number {
  let sum = 0;
  for (const value of window) {
    sum += value;
  }
  return sum / window.length;
}

export function amplitudeToDb(amplitude: number): number {
  return 20 * Math.log10(Math.abs(amplitude) + EPS);
}

export function fftRadix2(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (!isPowerOfTwo(n) || imag.length !== n) {
    throw new Error("FFT input length must be a radix-2 size.");
  }

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;

    if (i < j) {
      const realTmp = real[i]!;
      real[i] = real[j]!;
      real[j] = realTmp;
      const imagTmp = imag[i]!;
      imag[i] = imag[j]!;
      imag[j] = imagTmp;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wLenReal = Math.cos(angle);
    const wLenImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wReal = 1;
      let wImag = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const evenReal = real[i + j]!;
        const evenImag = imag[i + j]!;
        const oddReal = real[i + j + len / 2]! * wReal - imag[i + j + len / 2]! * wImag;
        const oddImag = real[i + j + len / 2]! * wImag + imag[i + j + len / 2]! * wReal;

        real[i + j] = evenReal + oddReal;
        imag[i + j] = evenImag + oddImag;
        real[i + j + len / 2] = evenReal - oddReal;
        imag[i + j + len / 2] = evenImag - oddImag;

        const nextReal = wReal * wLenReal - wImag * wLenImag;
        wImag = wReal * wLenImag + wImag * wLenReal;
        wReal = nextReal;
      }
    }
  }
}

export function computeSpectrogram(
  samples: Float32Array,
  sampleRate: number,
  options: SpectrogramOptions,
): SpectrogramData {
  const { fftSize, hopSize, windowType, minDb, maxDb } = options;
  if (!isPowerOfTwo(fftSize)) {
    throw new Error(`fftSize must be a power of two. Received ${fftSize}.`);
  }
  if (!Number.isInteger(hopSize) || hopSize <= 0) {
    throw new Error(`hopSize must be a positive integer. Received ${hopSize}.`);
  }
  if (maxDb <= minDb) {
    throw new Error("maxDb must be greater than minDb.");
  }

  const freqBins = fftSize / 2 + 1;
  const timeFrames = Math.max(1, Math.floor(Math.max(0, samples.length - fftSize) / hopSize) + 1);
  const values = new Float32Array(timeFrames * freqBins);
  const window = createWindow(fftSize, windowType);
  const amplitudeScale = Math.max(EPS, (fftSize * coherentGain(window)) / 2);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  for (let t = 0; t < timeFrames; t += 1) {
    const offset = t * hopSize;
    real.fill(0);
    imag.fill(0);

    for (let i = 0; i < fftSize; i += 1) {
      real[i] = (samples[offset + i] ?? 0) * window[i]!;
    }

    fftRadix2(real, imag);

    for (let k = 0; k < freqBins; k += 1) {
      const magnitude = Math.hypot(real[k]!, imag[k]!) / amplitudeScale;
      values[t * freqBins + k] = clamp(amplitudeToDb(magnitude), minDb, maxDb);
    }
  }

  return { values, freqBins, timeFrames, sampleRate, maxFrequencyHz: sampleRate / 2, fftSize, hopSize, minDb, maxDb };
}
