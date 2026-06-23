import type { WaveformPeaks } from "../types";

export function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: WaveformPeaks | WaveformPeaks[] | undefined,
  options: {
    color: string;
    playedColor?: string;
    background: string;
    centerColor?: string;
    progressColor?: string;
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
    progress?: number;
  },
): void {
  drawWaveformEnvelope(context, peaks, height, {
    unplayedColor: options.color,
    playedColor: options.playedColor ?? options.progressColor ?? options.color,
    centerColor: options.centerColor ?? options.color,
    progress: options.progress ?? 0,
  });
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
