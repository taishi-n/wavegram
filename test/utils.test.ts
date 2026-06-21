import { afterEach, describe, expect, it, vi } from "vitest";
import { readAudioFileSampleRate } from "../src/audio/readAudioSampleRate";
import { amplitudeToDb, coherentGain, computeSpectrogram, createWindow, isPowerOfTwo } from "../src/audio/spectrogram";
import { computeWaveformPeaks } from "../src/audio/waveform";
import { colorMap } from "../src/render/colorMap";
import { drawCursor } from "../src/render/drawCursor";
import { chooseFrequencyTickStep, drawSpectrogram } from "../src/render/drawSpectrogram";
import { drawWaveform } from "../src/render/drawWaveform";
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
    expect(data.maxFrequencyHz).toBe(24000);
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

describe("audio file metadata", () => {
  it("reads the sample rate from a WAV fmt chunk", () => {
    const wav = new ArrayBuffer(44);
    const view = new DataView(wav);
    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 44100, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, 0, true);

    expect(readAudioFileSampleRate(wav)).toBe(44100);
  });

  it("returns undefined for unsupported containers", () => {
    expect(readAudioFileSampleRate(new ArrayBuffer(16))).toBeUndefined();
  });

  it("reads the sample rate from an MP3 frame header", () => {
    const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64]).buffer;
    expect(readAudioFileSampleRate(mp3)).toBe(44100);
  });

  it("reads the sample rate from an Ogg Vorbis identification packet", () => {
    const ogg = new ArrayBuffer(32);
    const view = new DataView(ogg);
    writeAscii(view, 4, "\x01vorbis");
    view.setUint32(16, 48000, true);
    expect(readAudioFileSampleRate(ogg)).toBe(48000);
  });

  it("reads the sample rate from a FLAC streaminfo block", () => {
    const flac = new ArrayBuffer(42);
    const view = new DataView(flac);
    writeAscii(view, 0, "fLaC");
    view.setUint8(4, 0);
    view.setUint8(7, 34);
    view.setUint8(18, 0x0a);
    view.setUint8(19, 0xc4);
    view.setUint8(20, 0x40);
    expect(readAudioFileSampleRate(flac)).toBe(44100);
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

describe("drawWaveform", () => {
  it("fills the full backing-store width when the client width is smaller", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 160;
    Object.defineProperty(canvas, "clientWidth", { value: 898 });
    Object.defineProperty(canvas, "clientHeight", { value: 80 });

    const fillRect = vi.fn();
    vi.spyOn(canvas, "getContext").mockReturnValue({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fillRect,
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
      getTransform: vi.fn(() => ({ a: 2, d: 2 })),
    } as unknown as CanvasRenderingContext2D);

    drawWaveform(canvas, undefined, {
      color: "#0f0",
      background: "#000",
    });

    expect(fillRect).toHaveBeenCalledWith(0, 0, 900, 80);
  });
});

describe("drawCursor", () => {
  it("does not draw a terminal cursor at the right edge", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { value: 100 });
    Object.defineProperty(canvas, "clientHeight", { value: 40 });

    const moveTo = vi.fn();
    const stroke = vi.fn();
    vi.spyOn(canvas, "getContext").mockReturnValue({
      beginPath: vi.fn(),
      lineTo: vi.fn(),
      moveTo,
      restore: vi.fn(),
      save: vi.fn(),
      stroke,
    } as unknown as CanvasRenderingContext2D);

    drawCursor(canvas, 10, 10, "#00f0b5");

    expect(moveTo).not.toHaveBeenCalled();
    expect(stroke).not.toHaveBeenCalled();
  });

  it("draws the cursor before the end", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { value: 100 });
    Object.defineProperty(canvas, "clientHeight", { value: 40 });

    const moveTo = vi.fn();
    vi.spyOn(canvas, "getContext").mockReturnValue({
      beginPath: vi.fn(),
      lineTo: vi.fn(),
      moveTo,
      restore: vi.fn(),
      save: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    drawCursor(canvas, 5, 10, "#00f0b5");

    expect(moveTo).toHaveBeenCalledWith(50, 0);
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
    const fillText = vi.fn();
    const putImageData = vi.fn();
    vi.spyOn(canvas, "getContext").mockReturnValue({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText,
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
        maxFrequencyHz: 8000,
        fftSize: 2,
        hopSize: 1,
        minDb: -80,
        maxDb: 0,
      },
      { colorMap: "gray", background: "#fff" },
    );

    expect(createImageData).toHaveBeenCalledWith(800, 240);
    expect(fillText).toHaveBeenCalledWith("8k", 5, 8);
    expect(putImageData).toHaveBeenCalledOnce();
  });
});

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
