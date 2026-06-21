import { decodeAudioData } from "../audio/decodeAudio";
import { loadAudio } from "../audio/loadAudio";
import { createAudioElement } from "../audio/playback";
import { computeSpectrogram } from "../audio/spectrogram";
import { computeWaveformPeaksFromBuffer } from "../audio/waveform";
import { configureCanvas } from "../render/canvas";
import { drawCursor } from "../render/drawCursor";
import { drawSpectrogram } from "../render/drawSpectrogram";
import { drawWaveform } from "../render/drawWaveform";
import type {
  ChannelSelection,
  ColorMapName,
  LoadProfileDetail,
  PlayerErrorDetail,
  PlayerEventDetail,
  PlaybackProfileDetail,
  SpectrogramData,
  SpectrogramWorkerRequest,
  WaveformPeaks,
  WaveformStyle,
  WindowType,
} from "../types";
import { formatTime } from "../utils/formatTime";
import { pickChannel } from "../utils/resample";

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      --ap-bg: #ffffff;
      --ap-fg: #222222;
      --ap-muted: #666666;
      --ap-waveform-bg: #020604;
      --ap-waveform: rgba(0, 214, 163, 0.34);
      --ap-waveform-played: #00f0b5;
      --ap-waveform-center: rgba(0, 92, 58, 0.7);
      --ap-waveform-progress: #00f0b5;
      --ap-cursor: #00d7ff;
      --ap-cursor-shadow: rgba(0, 0, 0, 0.45);
      --ap-spectrogram-tick: rgba(255, 255, 255, 0.42);
      --ap-spectrogram-unplayed-opacity: 0.48;
      --ap-border: #dddddd;
      --ap-button-bg: #f7f7f7;
      --ap-button-border: #cfcfcf;
      display: block;
      box-sizing: border-box;
      color: var(--ap-fg);
      background: var(--ap-bg);
      font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    .root {
      border: 1px solid var(--ap-border);
      background: var(--ap-bg);
      min-width: 180px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-bottom: 1px solid var(--ap-border);
      min-height: 40px;
    }

    .toolbar.hidden {
      display: none;
    }

    button {
      appearance: none;
      border: 1px solid var(--ap-button-border);
      border-radius: 999px;
      background: var(--ap-button-bg);
      color: var(--ap-fg);
      position: relative;
      width: 30px;
      min-width: 30px;
      height: 30px;
      padding: 0;
      cursor: pointer;
      font: inherit;
      text-indent: -9999px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      transition:
        background 120ms ease,
        border-color 120ms ease,
        transform 120ms ease,
        box-shadow 120ms ease;
    }

    button::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 0;
      height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-left: 10px solid currentColor;
      transform: translate(-38%, -50%);
    }

    button[data-state="pause"]::before,
    button[data-state="pause"]::after {
      content: "";
      position: absolute;
      top: 50%;
      width: 4px;
      height: 14px;
      border: 0;
      background: currentColor;
      border-radius: 1px;
      transform: translateY(-50%);
    }

    button[data-state="pause"]::before {
      left: calc(50% - 5px);
    }

    button[data-state="pause"]::after {
      left: calc(50% + 1px);
    }

    button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
    }

    button:focus-visible {
      outline: 2px solid var(--ap-cursor);
      outline-offset: 2px;
    }

    button:disabled {
      cursor: default;
      opacity: 0.55;
    }

    .time {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .status {
      color: var(--ap-muted);
      margin-left: auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .error {
      color: #b00020;
      padding: 8px;
      border-bottom: 1px solid var(--ap-border);
      overflow-wrap: anywhere;
    }

    .hidden {
      display: none;
    }

    .visuals {
      display: grid;
      width: 100%;
    }

    .pane {
      position: relative;
      border-top: 1px solid var(--ap-border);
      cursor: pointer;
      user-select: none;
    }

    .pane:first-child {
      border-top: 0;
    }

    canvas {
      display: block;
      width: 100%;
    }

    .cursor {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
  </style>
    <div class="root">
    <div class="toolbar hidden">
      <button type="button" aria-label="Play" disabled>Play</button>
      <span class="time hidden"><span class="current">00:00.000</span> / <span class="duration">00:00.000</span></span>
      <span class="status"></span>
    </div>
    <div class="error hidden" role="alert"></div>
    <div class="visuals">
      <div class="pane waveform-pane">
        <canvas class="waveform"></canvas>
        <canvas class="cursor waveform-cursor"></canvas>
      </div>
      <div class="pane spectrogram-pane">
        <canvas class="spectrogram"></canvas>
        <canvas class="cursor spectrogram-overlay"></canvas>
        <canvas class="cursor spectrogram-cursor"></canvas>
      </div>
    </div>
  </div>
`;

export class Wavegram extends HTMLElement {
  static observedAttributes = [
    "src",
    "height",
    "waveform-height",
    "spectrogram-height",
    "show-waveform",
    "show-spectrogram",
    "show-controls",
    "show-time",
    "waveform-style",
    "waveform-bar-width",
    "waveform-bar-spacing",
    "autoplay",
    "fft-size",
    "hop-size",
    "window-type",
    "min-db",
    "max-db",
    "color-map",
    "channel",
  ];

  private audio?: HTMLAudioElement;
  private audioBuffer?: AudioBuffer;
  private waveformPeaks?: WaveformPeaks;
  private spectrogram?: SpectrogramData;
  private worker?: Worker;
  private resizeObserver?: ResizeObserver;
  private animationFrame = 0;
  private loadingToken = 0;
  private blobUrl?: string;
  private playRequestedAt?: number;

  private readonly root: ShadowRoot;
  private readonly button: HTMLButtonElement;
  private readonly toolbar: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly currentEl: HTMLElement;
  private readonly durationEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly errorEl: HTMLElement;
  private readonly waveformPane: HTMLElement;
  private readonly spectrogramPane: HTMLElement;
  private readonly waveformCanvas: HTMLCanvasElement;
  private readonly spectrogramCanvas: HTMLCanvasElement;
  private readonly spectrogramOverlay: HTMLCanvasElement;
  private readonly waveformCursor: HTMLCanvasElement;
  private readonly spectrogramCursor: HTMLCanvasElement;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.append(template.content.cloneNode(true));

    this.button = this.requireElement("button");
    this.button.dataset.state = "play";
    this.toolbar = this.requireElement(".toolbar");
    this.timeEl = this.requireElement(".time");
    this.currentEl = this.requireElement(".current");
    this.durationEl = this.requireElement(".duration");
    this.statusEl = this.requireElement(".status");
    this.errorEl = this.requireElement(".error");
    this.waveformPane = this.requireElement(".waveform-pane");
    this.spectrogramPane = this.requireElement(".spectrogram-pane");
    this.waveformCanvas = this.requireElement(".waveform");
    this.spectrogramCanvas = this.requireElement(".spectrogram");
    this.spectrogramOverlay = this.requireElement(".spectrogram-overlay");
    this.waveformCursor = this.requireElement(".waveform-cursor");
    this.spectrogramCursor = this.requireElement(".spectrogram-cursor");
  }

  get src(): string {
    return this.getAttribute("src") ?? "";
  }

  set src(value: string) {
    this.setAttribute("src", value);
  }

  get height(): number {
    return this.getNumberAttribute("height", this.waveformHeight + this.spectrogramHeight);
  }

  set height(value: number) {
    this.setAttribute("height", String(value));
  }

  get waveformHeight(): number {
    return this.getNumberAttribute("waveform-height", 80);
  }

  set waveformHeight(value: number) {
    this.setAttribute("waveform-height", String(value));
  }

  get spectrogramHeight(): number {
    return this.getNumberAttribute("spectrogram-height", 120);
  }

  set spectrogramHeight(value: number) {
    this.setAttribute("spectrogram-height", String(value));
  }

  get showWaveform(): boolean {
    return this.getBooleanAttribute("show-waveform", true);
  }

  set showWaveform(value: boolean) {
    this.setBooleanAttribute("show-waveform", value);
  }

  get showSpectrogram(): boolean {
    return this.getBooleanAttribute("show-spectrogram", true);
  }

  set showSpectrogram(value: boolean) {
    this.setBooleanAttribute("show-spectrogram", value);
  }

  get showControls(): boolean {
    return this.getBooleanAttribute("show-controls", false);
  }

  set showControls(value: boolean) {
    this.setBooleanAttribute("show-controls", value);
  }

  get showTime(): boolean {
    return this.getBooleanAttribute("show-time", false);
  }

  set showTime(value: boolean) {
    this.setBooleanAttribute("show-time", value);
  }

  get waveformStyle(): WaveformStyle {
    const value = this.getAttribute("waveform-style");
    if (value === "line") return "lines";
    if (value === "waveform") return "waveform";
    if (value === "bars" || value === "lines" || value === "blocks" || value === "dots") return value;
    return "waveform";
  }

  set waveformStyle(value: WaveformStyle) {
    this.setAttribute("waveform-style", value);
  }

  get waveformBarWidth(): number | undefined {
    return this.getOptionalNumberAttribute("waveform-bar-width");
  }

  set waveformBarWidth(value: number) {
    this.setAttribute("waveform-bar-width", String(value));
  }

  get waveformBarSpacing(): number | undefined {
    return this.getOptionalNumberAttribute("waveform-bar-spacing");
  }

  set waveformBarSpacing(value: number) {
    this.setAttribute("waveform-bar-spacing", String(value));
  }

  get autoplay(): boolean {
    return this.getBooleanAttribute("autoplay", false);
  }

  set autoplay(value: boolean) {
    this.setBooleanAttribute("autoplay", value);
  }

  get fftSize(): number {
    return this.getNumberAttribute("fft-size", 1024);
  }

  set fftSize(value: number) {
    this.setAttribute("fft-size", String(value));
  }

  get hopSize(): number {
    return this.getNumberAttribute("hop-size", 256);
  }

  set hopSize(value: number) {
    this.setAttribute("hop-size", String(value));
  }

  get windowType(): WindowType {
    const value = this.getAttribute("window-type");
    return value === "hamming" || value === "rectangular" ? value : "hann";
  }

  set windowType(value: WindowType) {
    this.setAttribute("window-type", value);
  }

  get minDb(): number {
    return this.getNumberAttribute("min-db", -80);
  }

  set minDb(value: number) {
    this.setAttribute("min-db", String(value));
  }

  get maxDb(): number {
    return this.getNumberAttribute("max-db", 0);
  }

  set maxDb(value: number) {
    this.setAttribute("max-db", String(value));
  }

  get colorMap(): ColorMapName {
    const value = this.getAttribute("color-map");
    if (value === "gray" || value === "magma" || value === "viridis" || value === "inferno") return value;
    return "audition";
  }

  set colorMap(value: ColorMapName) {
    this.setAttribute("color-map", value);
  }

  get channel(): ChannelSelection {
    const value = this.getAttribute("channel");
    if (!value || value === "mix") return "mix";
    const numberValue = Number(value);
    return Number.isInteger(numberValue) ? numberValue : "mix";
  }

  set channel(value: ChannelSelection) {
    this.setAttribute("channel", String(value));
  }

  connectedCallback(): void {
    this.button.addEventListener("click", this.handlePlayButton);
    this.waveformPane.addEventListener("click", this.handleSeekClick);
    this.spectrogramPane.addEventListener("click", this.handleSeekClick);
    this.addEventListener("keydown", this.handleKeydown);
    this.tabIndex = this.tabIndex >= 0 ? this.tabIndex : 0;

    this.resizeObserver = new ResizeObserver(() => this.layoutAndRender());
    this.resizeObserver.observe(this);

    this.layoutAndRender();
    if (this.src) {
      void this.load();
    }
  }

  disconnectedCallback(): void {
    this.button.removeEventListener("click", this.handlePlayButton);
    this.waveformPane.removeEventListener("click", this.handleSeekClick);
    this.spectrogramPane.removeEventListener("click", this.handleSeekClick);
    this.removeEventListener("keydown", this.handleKeydown);
    this.resizeObserver?.disconnect();
    this.stopAnimation();
    this.worker?.terminate();
    this.audio?.pause();
    this.revokeBlobUrl();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.isConnected) return;
    if (name === "src") {
      void this.load();
      return;
    }
    if (["fft-size", "hop-size", "window-type", "min-db", "max-db", "channel"].includes(name)) {
      if (this.audioBuffer) {
        void this.recomputeAnalysis();
      }
      return;
    }
    this.layoutAndRender();
  }

  private async load(): Promise<void> {
    const src = this.src;
    const token = ++this.loadingToken;
    this.clearError();
    this.setStatus(src ? "Loading" : "");
    this.dispatchTypedEvent("loadstart");
    this.button.disabled = true;
    this.waveformPeaks = undefined;
    this.spectrogram = undefined;
    this.layoutAndRender();

    this.worker?.terminate();
    this.audio?.pause();
    this.revokeBlobUrl();

    if (!src) {
      this.setStatus("");
      return;
    }

    try {
      const loadStartedAt = performance.now();
      const arrayBuffer = await loadAudio(src);
      const fetchDoneAt = performance.now();
      if (token !== this.loadingToken) return;

      this.blobUrl = URL.createObjectURL(new Blob([arrayBuffer]));
      this.audio = createAudioElement(this.blobUrl, this.autoplay);
      this.bindAudio();
      const audioReady = this.waitForAudioReady(this.audio);

      this.audioBuffer = await decodeAudioData(arrayBuffer);
      const decodeDoneAt = performance.now();
      if (token !== this.loadingToken) return;

      const width = Math.max(1, Math.floor(this.getCanvasWidth()));
      const waveformStartedAt = performance.now();
      this.waveformPeaks = this.showWaveform
        ? computeWaveformPeaksFromBuffer(this.audioBuffer, width, this.channel)
        : undefined;
      const waveformDoneAt = performance.now();
      await audioReady;
      const audioReadyDoneAt = performance.now();
      if (token !== this.loadingToken) return;

      this.button.disabled = false;
      this.setStatus(this.showSpectrogram ? "Analyzing" : "");
      this.updateTimeLabels();
      this.dispatchTypedEvent("loaded");
      const firstUsableAt = performance.now();
      const profile: LoadProfileDetail = {
        fetchMs: fetchDoneAt - loadStartedAt,
        audioReadyMs: audioReadyDoneAt - fetchDoneAt,
        decodeMs: decodeDoneAt - fetchDoneAt,
        waveformMs: waveformDoneAt - waveformStartedAt,
        firstUsableMs: firstUsableAt - loadStartedAt,
      };
      this.dispatchEvent(new CustomEvent("profile", { detail: profile }));
      this.layoutAndRender();

      void this.computeSpectrogramForCurrentBuffer(token, profile, loadStartedAt);

      if (this.autoplay) {
        await this.audio?.play();
      }
    } catch (cause) {
      if (token !== this.loadingToken) return;
      this.handleError("Failed to load audio.", cause);
    }
  }

  private async recomputeAnalysis(): Promise<void> {
    if (!this.audioBuffer) return;
    const width = Math.max(1, Math.floor(this.getCanvasWidth()));
    this.waveformPeaks = this.showWaveform
      ? computeWaveformPeaksFromBuffer(this.audioBuffer, width, this.channel)
      : undefined;
    this.layoutAndRender();

    if (this.showSpectrogram) {
      this.setStatus("Analyzing");
      this.spectrogram = await this.computeSpectrogramInWorker();
      this.setStatus("");
    } else {
      this.spectrogram = undefined;
    }

    this.layoutAndRender();
  }

  private async computeSpectrogramForCurrentBuffer(
    token: number,
    profile: LoadProfileDetail,
    loadStartedAt: number,
  ): Promise<void> {
    if (!this.audioBuffer || !this.showSpectrogram) {
      this.spectrogram = undefined;
      this.setStatus("");
      this.layoutAndRender();
      return;
    }

    try {
      const spectrogramStartedAt = performance.now();
      this.spectrogram = await this.computeSpectrogramInWorker();
      const spectrogramDoneAt = performance.now();
      if (token !== this.loadingToken) return;
      this.setStatus("");
      this.layoutAndRender();
      this.dispatchEvent(
        new CustomEvent("profile", {
          detail: {
            ...profile,
            spectrogramMs: spectrogramDoneAt - spectrogramStartedAt,
            totalMs: spectrogramDoneAt - loadStartedAt,
          } satisfies LoadProfileDetail,
        }),
      );
    } catch (cause) {
      if (token !== this.loadingToken) return;
      this.spectrogram = undefined;
      this.setStatus("Spectrogram unavailable");
      this.dispatchEvent(
        new CustomEvent("error", {
          detail: {
            message: cause instanceof Error ? cause.message : "Failed to compute spectrogram.",
            cause,
          } satisfies PlayerErrorDetail,
        }),
      );
    }
  }

  private computeSpectrogramInWorker(): Promise<SpectrogramData | undefined> {
    if (!this.audioBuffer) return Promise.resolve(undefined);
    const samples = pickChannel(this.audioBuffer, this.channel);
    const request: SpectrogramWorkerRequest = {
      samples,
      sampleRate: this.audioBuffer.sampleRate,
      fftSize: this.fftSize,
      hopSize: this.hopSize,
      windowType: this.windowType,
      minDb: this.minDb,
      maxDb: this.maxDb,
    };

    if (typeof Worker === "undefined") {
      return Promise.resolve(computeSpectrogram(samples, this.audioBuffer.sampleRate, request));
    }

    return new Promise((resolve, reject) => {
      this.worker?.terminate();
      this.worker = new Worker(new URL("../worker/spectrogram.worker.ts", import.meta.url), { type: "module" });
      this.worker.addEventListener(
        "message",
        (event: MessageEvent<SpectrogramData | { error: { message: string } }>) => {
          if ("error" in event.data) {
            reject(new Error(event.data.error.message));
          } else {
            resolve(event.data);
          }
        },
        { once: true },
      );
      this.worker.addEventListener("error", () => reject(new Error("Spectrogram worker failed.")), { once: true });
      this.worker.postMessage(request, [request.samples.buffer]);
    });
  }

  private bindAudio(): void {
    if (!this.audio) return;
    this.audio.addEventListener("loadedmetadata", this.updateTimeLabels);
    this.audio.addEventListener("timeupdate", this.handleTimeUpdate);
    this.audio.addEventListener("play", this.handleAudioPlay);
    this.audio.addEventListener("playing", this.handleAudioPlaying);
    this.audio.addEventListener("pause", this.handleAudioPause);
    this.audio.addEventListener("ended", this.handleAudioPause);
    this.audio.addEventListener("error", () => this.handleError("Audio playback failed.", this.audio?.error));
  }

  private layoutAndRender(): void {
    const width = Math.max(1, Math.floor(this.getCanvasWidth()));
    const { waveformHeight, spectrogramHeight } = this.getPaneHeights();

    this.toolbar.classList.toggle("hidden", !this.showControls && !this.showTime);
    this.button.classList.toggle("hidden", !this.showControls);
    this.timeEl.classList.toggle("hidden", !this.showTime);
    this.waveformPane.classList.toggle("hidden", !this.showWaveform);
    this.spectrogramPane.classList.toggle("hidden", !this.showSpectrogram);

    if (this.showWaveform) {
      configureCanvas(this.waveformCanvas, width, waveformHeight);
      configureCanvas(this.waveformCursor, width, waveformHeight);
      drawWaveform(this.waveformCanvas, this.waveformPeaks, {
        color: this.cssVar("--ap-waveform", "rgba(0, 214, 163, 0.34)"),
        playedColor: this.cssVar("--ap-waveform-played", "#00f0b5"),
        centerColor: this.cssVar("--ap-waveform-center", "rgba(0, 92, 58, 0.7)"),
        progressColor: this.cssVar("--ap-waveform-progress", "#00f0b5"),
        background: this.cssVar("--ap-waveform-bg", "#020604"),
        style: this.waveformStyle,
        barWidth: this.waveformBarWidth,
        barSpacing: this.waveformBarSpacing,
        progress: this.playbackProgress,
      });
    }
    if (this.showSpectrogram) {
      configureCanvas(this.spectrogramCanvas, width, spectrogramHeight);
      configureCanvas(this.spectrogramOverlay, width, spectrogramHeight);
      configureCanvas(this.spectrogramCursor, width, spectrogramHeight);
      drawSpectrogram(this.spectrogramCanvas, this.spectrogram, {
        colorMap: this.colorMap,
        background: this.cssVar("--ap-bg", "#ffffff"),
        tickColor: this.cssVar("--ap-spectrogram-tick", "rgba(255, 255, 255, 0.42)"),
      });
      this.drawSpectrogramOverlay();
    }
    this.drawCursors();
  }

  private drawCursors(): void {
    const currentTime = this.audio?.currentTime ?? 0;
    const duration = this.duration;
    const color = this.cssVar("--ap-cursor", "#ff0000");
    const shadowColor = this.cssVar("--ap-cursor-shadow", "rgba(0, 0, 0, 0.45)");
    if (this.showWaveform && this.waveformStyle === "waveform") {
      drawWaveform(this.waveformCanvas, this.waveformPeaks, {
        color: this.cssVar("--ap-waveform", "rgba(0, 214, 163, 0.34)"),
        playedColor: this.cssVar("--ap-waveform-played", "#00f0b5"),
        centerColor: this.cssVar("--ap-waveform-center", "rgba(0, 92, 58, 0.7)"),
        progressColor: this.cssVar("--ap-waveform-progress", "#00f0b5"),
        background: this.cssVar("--ap-waveform-bg", "#020604"),
        style: this.waveformStyle,
        barWidth: this.waveformBarWidth,
        barSpacing: this.waveformBarSpacing,
        progress: this.playbackProgress,
      });
    }
    this.drawSpectrogramOverlay();
    this.clearCursor(this.waveformCursor);
    this.clearCursor(this.spectrogramCursor);
    if (this.showWaveform) drawCursor(this.waveformCursor, currentTime, duration, color, shadowColor);
    if (this.showSpectrogram) drawCursor(this.spectrogramCursor, currentTime, duration, color, shadowColor);
  }

  private clearCursor(canvas: HTMLCanvasElement): void {
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  private drawSpectrogramOverlay(): void {
    const context = this.spectrogramOverlay.getContext("2d");
    if (!context) return;
    const width = this.spectrogramOverlay.clientWidth;
    const height = this.spectrogramOverlay.clientHeight;
    context.clearRect(0, 0, width, height);
    if (!this.showSpectrogram || !this.spectrogram) return;

    const progressX = width * this.playbackProgress;
    const opacity = 1 - this.cssNumberVar("--ap-spectrogram-unplayed-opacity", 0.48);
    if (progressX < width) {
      context.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, opacity))})`;
      context.fillRect(progressX, 0, width - progressX, height);
    }
  }

  private readonly handlePlayButton = (): void => {
    if (!this.audio) return;
    if (this.audio.paused) {
      this.playRequestedAt = performance.now();
      void this.audio.play().catch((cause: unknown) => this.handleError("Audio playback failed.", cause));
    } else {
      this.audio.pause();
    }
  };

  private readonly handleSeekClick = (event: MouseEvent): void => {
    if (!this.audio || !Number.isFinite(this.duration) || this.duration <= 0) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    this.audio.currentTime = Math.max(0, Math.min(this.duration, ratio * this.duration));
    this.updateTimeLabels();
    this.drawCursors();
    this.dispatchTypedEvent("seek");
    if (this.audio.paused) {
      this.playRequestedAt = performance.now();
      void this.audio.play().catch((cause: unknown) => this.handleError("Audio playback failed.", cause));
    } else {
      this.audio.pause();
    }
  };

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    this.handlePlayButton();
  };

  private readonly handleTimeUpdate = (): void => {
    this.updateTimeLabels();
    this.dispatchTypedEvent("timeupdate");
  };

  private readonly handleAudioPlay = (): void => {
    this.button.textContent = "Pause";
    this.button.setAttribute("aria-label", "Pause");
    this.button.dataset.state = "pause";
    this.dispatchTypedEvent("play");
  };

  private readonly handleAudioPlaying = (): void => {
    if (this.playRequestedAt !== undefined) {
      const detail: PlaybackProfileDetail = {
        playToPlayingMs: performance.now() - this.playRequestedAt,
      };
      this.dispatchEvent(new CustomEvent("playprofile", { detail }));
      this.playRequestedAt = undefined;
    }
    this.startAnimation();
  };

  private readonly handleAudioPause = (): void => {
    this.button.textContent = "Play";
    this.button.setAttribute("aria-label", "Play");
    this.button.dataset.state = "play";
    this.dispatchTypedEvent("pause");
    this.stopAnimation();
    this.drawCursors();
  };

  private startAnimation(): void {
    this.stopAnimation();
    const tick = () => {
      this.updateTimeLabels();
      this.drawCursors();
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  private stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  private updateTimeLabels = (): void => {
    this.currentEl.textContent = formatTime(this.audio?.currentTime ?? 0);
    this.durationEl.textContent = formatTime(this.duration);
  };

  private get duration(): number {
    return this.audio?.duration || this.audioBuffer?.duration || 0;
  }

  private get playbackProgress(): number {
    const duration = this.duration;
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.max(0, Math.min(1, (this.audio?.currentTime ?? 0) / duration));
  }

  private dispatchTypedEvent(name: string): void {
    const detail: PlayerEventDetail = {
      currentTime: this.audio?.currentTime ?? 0,
      duration: this.duration,
    };
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private handleError(message: string, cause?: unknown): void {
    this.button.disabled = true;
    this.setStatus("");
    const detail: PlayerErrorDetail = {
      message: cause instanceof Error ? `${message} ${cause.message}` : message,
      cause,
    };
    this.errorEl.textContent = detail.message;
    this.errorEl.classList.remove("hidden");
    this.dispatchEvent(new CustomEvent("error", { detail }));
  }

  private clearError(): void {
    this.errorEl.textContent = "";
    this.errorEl.classList.add("hidden");
  }

  private setStatus(value: string): void {
    this.statusEl.textContent = value;
  }

  private getCanvasWidth(): number {
    return this.clientWidth || this.getBoundingClientRect().width || 640;
  }

  private getPaneHeights(): { waveformHeight: number; spectrogramHeight: number } {
    if (!this.showWaveform && !this.showSpectrogram) {
      return { waveformHeight: 0, spectrogramHeight: 0 };
    }

    const hasTotalHeight = this.hasAttribute("height");
    const hasWaveformHeight = this.hasAttribute("waveform-height");
    const hasSpectrogramHeight = this.hasAttribute("spectrogram-height");

    if (!hasTotalHeight) {
      return {
        waveformHeight: this.showWaveform ? this.waveformHeight : 0,
        spectrogramHeight: this.showSpectrogram ? this.spectrogramHeight : 0,
      };
    }

    const totalHeight = this.height;
    if (this.showWaveform && !this.showSpectrogram) {
      return { waveformHeight: hasWaveformHeight ? this.waveformHeight : totalHeight, spectrogramHeight: 0 };
    }
    if (!this.showWaveform && this.showSpectrogram) {
      return { waveformHeight: 0, spectrogramHeight: hasSpectrogramHeight ? this.spectrogramHeight : totalHeight };
    }

    if (hasWaveformHeight && hasSpectrogramHeight) {
      return { waveformHeight: this.waveformHeight, spectrogramHeight: this.spectrogramHeight };
    }
    if (hasWaveformHeight) {
      return { waveformHeight: this.waveformHeight, spectrogramHeight: Math.max(1, totalHeight - this.waveformHeight) };
    }
    if (hasSpectrogramHeight) {
      return { waveformHeight: Math.max(1, totalHeight - this.spectrogramHeight), spectrogramHeight: this.spectrogramHeight };
    }

    return {
      waveformHeight: Math.max(1, Math.round(totalHeight * (80 / 200))),
      spectrogramHeight: Math.max(1, totalHeight - Math.round(totalHeight * (80 / 200))),
    };
  }

  private getNumberAttribute(name: string, fallback: number): number {
    const value = Number(this.getAttribute(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private getOptionalNumberAttribute(name: string): number | undefined {
    if (!this.hasAttribute(name)) return undefined;
    const value = Number(this.getAttribute(name));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  private getBooleanAttribute(name: string, fallback: boolean): boolean {
    if (!this.hasAttribute(name)) return fallback;
    const value = this.getAttribute(name);
    return value === "" || value === "true" || value === name;
  }

  private setBooleanAttribute(name: string, value: boolean): void {
    if (value) {
      this.setAttribute(name, "");
    } else {
      this.setAttribute(name, "false");
    }
  }

  private cssVar(name: string, fallback: string): string {
    return getComputedStyle(this).getPropertyValue(name).trim() || fallback;
  }

  private cssNumberVar(name: string, fallback: number): number {
    const value = Number(getComputedStyle(this).getPropertyValue(name).trim());
    return Number.isFinite(value) ? value : fallback;
  }

  private requireElement<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing template element: ${selector}`);
    return element;
  }

  private waitForAudioReady(audio: HTMLAudioElement): Promise<void> {
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", handleReady);
        audio.removeEventListener("error", handleError);
      };
      const handleReady = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(audio.error ?? new Error("Audio metadata failed to load."));
      };
      audio.addEventListener("loadedmetadata", handleReady, { once: true });
      audio.addEventListener("error", handleError, { once: true });
      audio.load();
    });
  }

  private revokeBlobUrl(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = undefined;
    }
  }
}
