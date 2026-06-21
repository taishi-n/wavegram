import { Wavegram } from "./component/Wavegram";

class AudioPreviewSpectrogram extends Wavegram {}

if (!customElements.get("wavegram-player")) {
  customElements.define("wavegram-player", Wavegram);
}
if (!customElements.get("audio-preview-spectrogram")) {
  customElements.define("audio-preview-spectrogram", AudioPreviewSpectrogram);
}

export { AudioPreviewSpectrogram, Wavegram };
export type {
  ChannelSelection,
  ColorMapName,
  LoadProfileDetail,
  PlayerErrorDetail,
  PlayerEventDetail,
  PlaybackProfileDetail,
  SpectrogramData,
  SpectrogramOptions,
  WaveformPeaks,
  WaveformStyle,
  WindowType,
} from "./types";
