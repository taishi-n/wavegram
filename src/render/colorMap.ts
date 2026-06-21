import type { ColorMapName } from "../types";
import { clamp } from "../utils/clamp";

export type Rgb = [number, number, number];

function interpolate(stops: Rgb[], value: number): Rgb {
  const t = clamp(value, 0, 1) * (stops.length - 1);
  const index = Math.floor(t);
  const next = Math.min(index + 1, stops.length - 1);
  const local = t - index;
  const a = stops[index]!;
  const b = stops[next]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * local),
    Math.round(a[1] + (b[1] - a[1]) * local),
    Math.round(a[2] + (b[2] - a[2]) * local),
  ];
}

export function colorMap(name: ColorMapName, value: number): Rgb {
  const v = clamp(value, 0, 1);
  if (name === "audition") {
    return interpolate(
      [
        [0, 0, 0],
        [12, 7, 34],
        [25, 37, 114],
        [18, 104, 174],
        [39, 178, 172],
        [244, 180, 43],
        [252, 76, 27],
        [255, 238, 117],
      ],
      v,
    );
  }
  if (name === "gray") {
    const c = Math.round(v * 255);
    return [c, c, c];
  }
  if (name === "viridis") {
    return interpolate(
      [
        [68, 1, 84],
        [59, 82, 139],
        [33, 145, 140],
        [94, 201, 98],
        [253, 231, 37],
      ],
      v,
    );
  }
  if (name === "inferno") {
    return interpolate(
      [
        [0, 0, 4],
        [87, 15, 109],
        [187, 55, 84],
        [249, 142, 8],
        [252, 255, 164],
      ],
      v,
    );
  }
  return interpolate(
    [
      [0, 0, 4],
      [73, 16, 105],
      [182, 54, 121],
      [251, 136, 97],
      [252, 253, 191],
    ],
    v,
  );
}
