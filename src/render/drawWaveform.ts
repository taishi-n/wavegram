import type { WaveformPeaks, WaveformStyle } from "../types";

export function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: WaveformPeaks | WaveformPeaks[] | undefined,
  options: {
    color: string;
    playedColor?: string;
    background: string;
    centerColor?: string;
    progressColor?: string;
    style?: WaveformStyle;
    barWidth?: number;
    barSpacing?: number;
    progress?: number;
  },
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const { width, height } = getLogicalCanvasSize(canvas, context);
  context.clearRect(0, 0, width, height);
  context.fillStyle = options.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = options.centerColor ?? options.color;
  context.lineWidth = 1;

  if (!peaks) return;
  const lanes = Array.isArray(peaks) ? peaks : [peaks];
  if (lanes.length === 0) return;

  if (lanes.length > 1) {
    const laneHeight = height / lanes.length;
    for (let index = 0; index < lanes.length; index += 1) {
      const y = index * laneHeight;
      context.save();
      context.beginPath();
      context.rect(0, y, width, laneHeight);
      context.clip();
      context.translate(0, y);
      drawWaveformLane(context, lanes[index]!, width, laneHeight, options);
      context.restore();

      if (index > 0) {
        context.strokeStyle = options.centerColor ?? options.color;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(width, y + 0.5);
        context.stroke();
      }
    }
    return;
  }

  drawWaveformLane(context, lanes[0]!, width, height, options);
}

function drawWaveformLane(
  context: CanvasRenderingContext2D,
  peaks: WaveformPeaks,
  width: number,
  height: number,
  options: {
    color: string;
    playedColor?: string;
    background: string;
    centerColor?: string;
    progressColor?: string;
    style?: WaveformStyle;
    barWidth?: number;
    barSpacing?: number;
    progress?: number;
  },
): void {
  const style = options.style ?? "waveform";
  const amplitudes = peaksToAmplitudes(peaks);
  const defaults = styleDefaults(style);
  const barWidth = Math.max(1, options.barWidth ?? defaults.barWidth);
  const barSpacing = Math.max(0, options.barSpacing ?? defaults.barSpacing);

  if (style === "waveform") {
    drawWaveformEnvelope(context, peaks, height, {
      unplayedColor: options.color,
      playedColor: options.playedColor ?? options.progressColor ?? options.color,
      centerColor: options.centerColor ?? options.color,
      progress: options.progress ?? 0,
    });
  } else if (style === "lines") {
    drawLine(context, amplitudes, width, height, options.color);
  } else if (style === "blocks") {
    drawBlocks(context, amplitudes, width, height, options.color, barWidth, barSpacing);
  } else if (style === "dots") {
    drawDots(context, amplitudes, width, height, options.color, barWidth, barSpacing);
  } else {
    drawBars(context, amplitudes, width, height, options.color, barWidth, barSpacing);
  }
}

function getLogicalCanvasSize(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): { width: number; height: number } {
  if (typeof context.getTransform !== "function") {
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  }

  const transform = context.getTransform();
  const scaleX = Math.abs(transform.a) || 1;
  const scaleY = Math.abs(transform.d) || 1;
  return {
    width: Math.max(canvas.clientWidth, canvas.width / scaleX),
    height: Math.max(canvas.clientHeight, canvas.height / scaleY),
  };
}

function amplitudeAt(peaks: WaveformPeaks, x: number): number {
  return Math.max(Math.abs(peaks.min[x] ?? 0), Math.abs(peaks.max[x] ?? 0));
}

function peaksToAmplitudes(peaks: WaveformPeaks): number[] {
  const values: number[] = [];
  for (let x = 0; x < peaks.max.length; x += 1) {
    values.push(amplitudeAt(peaks, x));
  }
  return values;
}

function resampleData(data: number[], targetLength: number): number[] {
  if (data.length === targetLength) return data;
  if (data.length === 0 || targetLength <= 0) return [];
  const result: number[] = [];

  if (targetLength > data.length) {
    const ratio = (data.length - 1) / Math.max(1, targetLength - 1);
    for (let i = 0; i < targetLength; i += 1) {
      const index = i * ratio;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const fraction = index - lower;
      if (upper >= data.length) result.push(data[data.length - 1] ?? 0);
      else if (lower === upper) result.push(data[lower] ?? 0);
      else result.push((data[lower] ?? 0) * (1 - fraction) + (data[upper] ?? 0) * fraction);
    }
  } else {
    const bucketSize = data.length / targetLength;
    for (let i = 0; i < targetLength; i += 1) {
      const start = Math.floor(i * bucketSize);
      const end = Math.floor((i + 1) * bucketSize);
      let max = 0;
      let count = 0;
      for (let j = start; j <= end && j < data.length; j += 1) {
        max = Math.max(max, data[j] ?? 0);
        count += 1;
      }
      if (count === 0) {
        max = data[Math.min(Math.round(i * bucketSize), data.length - 1)] ?? 0;
      }
      result.push(max);
    }
  }

  return result;
}

function styleDefaults(style: WaveformStyle): { barWidth: number; barSpacing: number } {
  if (style === "bars") return { barWidth: 3, barSpacing: 1 };
  if (style === "blocks") return { barWidth: 4, barSpacing: 2 };
  if (style === "dots") return { barWidth: 3, barSpacing: 3 };
  return { barWidth: 2, barSpacing: 0 };
}

function drawWaveformEnvelope(
  context: CanvasRenderingContext2D,
  peaks: WaveformPeaks,
  height: number,
  options: {
    unplayedColor: string;
    playedColor: string;
    centerColor: string;
    progress: number;
  },
): void {
  const center = height / 2;
  context.strokeStyle = options.centerColor;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, center);
  context.lineTo(peaks.max.length, center);
  context.stroke();

  drawEnvelopeRange(context, peaks, height, 0, peaks.min.length, options.unplayedColor);

  const playedColumns = Math.max(0, Math.min(peaks.min.length, Math.round(peaks.min.length * options.progress)));
  if (playedColumns > 0) {
    drawEnvelopeRange(context, peaks, height, 0, playedColumns, options.playedColor);
  }
}

function drawEnvelopeRange(
  context: CanvasRenderingContext2D,
  peaks: WaveformPeaks,
  height: number,
  start: number,
  end: number,
  color: string,
): void {
  const center = height / 2;
  context.strokeStyle = color;
  context.beginPath();
  for (let x = start; x < end; x += 1) {
    const minY = center - peaks.min[x]! * center;
    const maxY = center - peaks.max[x]! * center;
    context.moveTo(x + 0.5, minY);
    context.lineTo(x + 0.5, maxY);
  }
  context.stroke();
}

function drawBars(
  context: CanvasRenderingContext2D,
  amplitudes: number[],
  width: number,
  height: number,
  color: string,
  barWidth: number,
  barSpacing: number,
): void {
  const count = Math.floor(width / (barWidth + barSpacing));
  const values = resampleData(amplitudes, count);
  context.fillStyle = color;
  for (let i = 0; i < values.length; i += 1) {
    const x = i * (barWidth + barSpacing);
    if (x + barWidth > width) break;
    const peakHeight = values[i]! * height * 0.9;
    context.fillRect(x, height - peakHeight, barWidth, peakHeight);
  }
}

function drawLine(context: CanvasRenderingContext2D, amplitudes: number[], width: number, height: number, color: string): void {
  const center = height / 2;
  const lineAmplitudes = resampleData(amplitudes, Math.max(2, Math.floor(width / 3)));
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = "rgba(255, 255, 255, 0.03)";
  context.lineWidth = 0.5;
  context.beginPath();
  context.moveTo(0, center);
  context.lineTo(width, center);
  context.stroke();
  for (let i = 0; i <= 10; i += 1) {
    const x = (width / 10) * i;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, center);
  const points = lineAmplitudes.map((peak, i) => {
    const x = (i / Math.max(1, lineAmplitudes.length - 1)) * width;
    const y = center + Math.sin(i * 0.1) * peak * height * 0.35;
    return { x, y };
  });
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const next = points[i + 1]!;
    const cp1x = current.x + (next.x - current.x) * 0.5;
    const cp2x = next.x - (next.x - current.x) * 0.5;
    context.bezierCurveTo(cp1x, current.y, cp2x, next.y, next.x, next.y);
  }
  context.stroke();
}

function drawBlocks(
  context: CanvasRenderingContext2D,
  amplitudes: number[],
  width: number,
  height: number,
  color: string,
  barWidth: number,
  barSpacing: number,
): void {
  const center = height / 2;
  const count = Math.floor(width / (barWidth + barSpacing));
  const values = resampleData(amplitudes, count);
  const blockSize = 4;
  const blockGap = 2;
  context.fillStyle = color;
  for (let i = 0; i < values.length; i += 1) {
    const x = i * (barWidth + barSpacing);
    if (x + barWidth > width) break;
    const peakHeight = values[i]! * height * 0.9;
    const blockCount = Math.floor(peakHeight / (blockSize + blockGap));
    for (let j = 0; j < blockCount; j += 1) {
      const offset = j * (blockSize + blockGap);
      context.fillRect(x, center - offset - blockSize, barWidth, blockSize);
      if (j > 0) context.fillRect(x, center + offset, barWidth, blockSize);
    }
  }
}

function drawDots(
  context: CanvasRenderingContext2D,
  amplitudes: number[],
  width: number,
  height: number,
  color: string,
  barWidth: number,
  barSpacing: number,
): void {
  const center = height / 2;
  const count = Math.floor(width / (barWidth + barSpacing));
  const values = resampleData(amplitudes, count);
  const radius = Math.max(1.5, barWidth / 2);
  context.fillStyle = color;
  for (let i = 0; i < values.length; i += 1) {
    const x = i * (barWidth + barSpacing) + barWidth / 2;
    if (x > width) break;
    const peakHeight = values[i]! * height * 0.9;
    context.beginPath();
    context.arc(x, center - peakHeight / 2, radius, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x, center + peakHeight / 2, radius, 0, Math.PI * 2);
    context.fill();
  }
}
