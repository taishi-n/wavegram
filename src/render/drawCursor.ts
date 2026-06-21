export function drawCursor(
  canvas: HTMLCanvasElement,
  currentTime: number,
  duration: number,
  color: string,
  shadowColor = "rgba(0, 0, 0, 0.45)",
): void {
  if (!Number.isFinite(duration) || duration <= 0) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const x = Math.max(0, Math.min(width, (currentTime / duration) * width));
  context.save();
  context.strokeStyle = shadowColor;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, height);
  context.stroke();

  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, height);
  context.stroke();
  context.restore();
}
