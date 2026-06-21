import { afterEach, describe, expect, it, vi } from "vitest";
import { amplitudeToDb, coherentGain, computeSpectrogram, createWindow, isPowerOfTwo } from "../src/audio/spectrogram";
import { computeWaveformPeaks } from "../src/audio/waveform";
import { colorMap } from "../src/render/colorMap";
import { chooseFrequencyTickStep, drawSpectrogram } from "../src/render/drawSpectrogram";
import { formatTime } from "../src/utils/formatTime";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatTime", () => {
  it("formats minutes, seconds, and milliseconds", () => {
    expect(formatTime(12.34)).toBe("00:12.340");
    expect(formatTime(85)).toBe("01:25.000");
  });
});

describe("waveform peaks", () => {
  it("computes min and max per display column", () => {
    const peaks = computeWaveformPeaks(new Float32Array([-1, -0.5, 0.25, 1]), 2);
    expect(Array.from(peaks.min)).toEqual([-1, 0.25]);
    expect(Array.from(peaks.max)).toEqual([-0.5, 1]);
  });
});

describe("spectrogram helpers", () => {
  it("creates supported windows", () => {
    expect(Array.from(createWindow(4, "rectangular"))).toEqual([1, 1, 1, 1]);
    expect(createWindow(8, "hann")[0]).toBeCloseTo(0);
    expect(createWindow(8, "hamming")[0]).toBeCloseTo(0.08);
  });

  it("computes window coherent gain", () => {
    expect(coherentGain(createWindow(1024, "rectangular"))).toBeCloseTo(1);
    expect(coherentGain(createWindow(1024, "hann"))).toBeCloseTo(0.5, 2);
  });

  it("converts amplitude to dB", () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0);
    expect(amplitudeToDb(0)).toBeLessThan(-190);
  });

  it("validates radix-2 sizes", () => {
    expect(isPowerOfTwo(1024)).toBe(true);
    expect(isPowerOfTwo(1000)).toBe(false);
  });

  it("computes expected STFT dimensions", () => {
    const data = computeSpectrogram(new Float32Array(2048), 48000, {
      fftSize: 1024,
      hopSize: 512,
      windowType: "hann",
      minDb: -80,
      maxDb: 0,
    });

    expect(data.freqBins).toBe(513);
    expect(data.timeFrames).toBe(3);
    expect(data.values.length).toBe(1539);
  });

  it("uses dBFS-like scaling for a bin-centered full-scale sine", () => {
    const fftSize = 1024;
    const bin = 16;
    const samples = new Float32Array(fftSize);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.sin((2 * Math.PI * bin * i) / fftSize);
    }

    const data = computeSpectrogram(samples, 48000, {
      fftSize,
      hopSize: fftSize,
      windowType: "rectangular",
      minDb: -80,
      maxDb: 0,
    });

    expect(data.values[data.freqBins * 0 + bin]).toBeCloseTo(0, 5);
  });
});

describe("colorMap", () => {
  it("maps audition values", () => {
    expect(colorMap("audition", 0)).toEqual([0, 0, 0]);
    expect(colorMap("audition", 1)).toEqual([255, 238, 117]);
  });

  it("maps gray values", () => {
    expect(colorMap("gray", 0)).toEqual([0, 0, 0]);
    expect(colorMap("gray", 1)).toEqual([255, 255, 255]);
  });
});

describe("drawSpectrogram", () => {
  it("chooses readable frequency tick steps", () => {
    expect(chooseFrequencyTickStep(8000, 120)).toBe(2000);
    expect(chooseFrequencyTickStep(24000, 120)).toBe(5000);
  });

  it("draws image data at backing-store resolution for high DPI canvases", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 240;
    Object.defineProperty(canvas, "clientWidth", { value: 400 });
    Object.defineProperty(canvas, "clientHeight", { value: 120 });

    const createImageData = vi.fn((width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    }));
    const putImageData = vi.fn();
    vi.spyOn(canvas, "getContext").mockReturnValue({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      stroke: vi.fn(),
      createImageData,
      putImageData,
    } as unknown as CanvasRenderingContext2D);

    drawSpectrogram(
      canvas,
      {
        values: new Float32Array([-80, 0, -80, 0]),
        freqBins: 2,
        timeFrames: 2,
        sampleRate: 16000,
        fftSize: 2,
        hopSize: 1,
        minDb: -80,
        maxDb: 0,
      },
      { colorMap: "gray", background: "#fff" },
    );

    expect(createImageData).toHaveBeenCalledWith(800, 240);
    expect(putImageData).toHaveBeenCalledOnce();
  });
});
