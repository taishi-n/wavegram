import type { ColorMapName, SpectrogramData } from "../types";
import { clamp } from "../utils/clamp";
import { colorMap } from "./colorMap";

export function drawSpectrogram(
  canvas: HTMLCanvasElement,
  spectrogram: SpectrogramData | undefined,
  options: {
    colorMap: ColorMapName;
    background: string;
    tickColor?: string;
  },
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const pixelWidth = Math.max(1, canvas.width);
  const pixelHeight = Math.max(1, canvas.height);

  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = options.background;
  context.fillRect(0, 0, cssWidth, cssHeight);
  if (!spectrogram) return;

  const image = context.createImageData(pixelWidth, pixelHeight);
  const range = spectrogram.maxDb - spectrogram.minDb;

  for (let x = 0; x < image.width; x += 1) {
    const t = Math.min(spectrogram.timeFrames - 1, Math.floor((x / image.width) * spectrogram.timeFrames));
    for (let y = 0; y < image.height; y += 1) {
      const k = Math.min(
        spectrogram.freqBins - 1,
        Math.floor(((image.height - 1 - y) / image.height) * spectrogram.freqBins),
      );
      const db = spectrogram.values[t * spectrogram.freqBins + k]!;
      const normalized = clamp((db - spectrogram.minDb) / range, 0, 1);
      const [r, g, b] = colorMap(options.colorMap, normalized);
      const offset = (y * image.width + x) * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  drawFrequencyTicks(context, cssWidth, cssHeight, spectrogram.maxFrequencyHz, options.tickColor);
}

export function chooseFrequencyTickStep(nyquistHz: number, height: number): number {
  if (!Number.isFinite(nyquistHz) || nyquistHz <= 0) return 1000;
  const targetTickCount = Math.max(2, Math.min(6, Math.floor(height / 28)));
  const rawStep = nyquistHz / targetTickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 7.5 ? 5 : 10;
  return nice * magnitude;
}

function drawFrequencyTicks(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxFrequencyHz: number,
  tickColor = "rgba(255, 255, 255, 0.42)",
): void {
  const step = chooseFrequencyTickStep(maxFrequencyHz, height);
  const labelPadding = 5;

  context.save();
  context.strokeStyle = tickColor;
  context.fillStyle = tickColor;
  context.lineWidth = 1;
  context.font = "10px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";

  for (let hz = step; hz < maxFrequencyHz; hz += step) {
    const y = height - (hz / maxFrequencyHz) * height;
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
    context.fillText(formatFrequencyTick(hz), labelPadding, y);
  }

  context.beginPath();
  context.moveTo(0, 0.5);
  context.lineTo(width, 0.5);
  context.stroke();
  context.fillText(formatFrequencyTick(maxFrequencyHz), labelPadding, 8);

  context.restore();
}

function formatFrequencyTick(hz: number): string {
  if (hz >= 1000) {
    const khz = hz / 1000;
    return `${Number.isInteger(khz) ? khz.toFixed(0) : khz.toFixed(1)}k`;
  }
  return `${Math.round(hz)}`;
}
