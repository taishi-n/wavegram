export function createAudioElement(src: string, autoplay: boolean): HTMLAudioElement {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.autoplay = autoplay;
  audio.crossOrigin = "anonymous";
  return audio;
}
