export type WindowType = "hann" | "hamming" | "rectangular";
export type ColorMapName = "audition" | "gray" | "magma" | "viridis" | "inferno";
export type ChannelSelection = number | "mix";
export type WaveformStyle = "waveform" | "bars" | "lines" | "blocks" | "dots";

export type WaveformPeaks = {
  min: Float32Array;
  max: Float32Array;
};

export type SpectrogramData = {
  values: Float32Array;
  freqBins: number;
  timeFrames: number;
  sampleRate: number;
  maxFrequencyHz: number;
  fftSize: number;
  hopSize: number;
  minDb: number;
  maxDb: number;
};

export type SpectrogramOptions = {
  fftSize: number;
  hopSize: number;
  windowType: WindowType;
  minDb: number;
  maxDb: number;
};

export type SpectrogramWorkerRequest = SpectrogramOptions & {
  samples: Float32Array;
  sampleRate: number;
};

export type PlayerEventDetail = {
  currentTime: number;
  duration: number;
};

export type PlayerErrorDetail = {
  message: string;
  cause?: unknown;
};

export type LoadProfileDetail = {
  fetchMs: number;
  audioReadyMs: number;
  decodeMs: number;
  waveformMs: number;
  spectrogramMs?: number;
  firstUsableMs: number;
  totalMs?: number;
};

export type PlaybackProfileDetail = {
  playToPlayingMs: number;
};
