import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/index";

class FakeAudio {
  currentTime = 0;
  duration = 10;
  paused = true;
  preload = "";
  autoplay = false;
  crossOrigin: string | null = null;
  error: unknown = null;
  private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  constructor(public src: string) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener);
  }

  async play(): Promise<void> {
    this.paused = false;
    this.emit("play");
  }

  pause(): void {
    this.paused = true;
    this.emit("pause");
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") {
        listener(new Event(type));
      } else {
        listener.handleEvent(new Event(type));
      }
    }
  }
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

beforeEach(() => {
  const context = {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    putImageData: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    createImageData: vi.fn((width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    })),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>(() => {
          // Keep component load pending; these tests only assert synchronous DOM behavior.
        }),
    ),
  );
});

describe("wavegram-player component", () => {
  it("reloads when src changes and dispatches loadstart", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    const player = document.createElement("wavegram-player");
    const loadstart = vi.fn();
    player.addEventListener("error", vi.fn());
    player.addEventListener("loadstart", loadstart);
    document.body.append(player);

    player.setAttribute("src", "first.wav");
    player.setAttribute("src", "second.wav");

    expect(loadstart).toHaveBeenCalledTimes(2);
  });

  it("seeks when a visual pane is clicked", () => {
    vi.stubGlobal("Audio", FakeAudio);
    const player = document.createElement("wavegram-player") as HTMLElement & { audio?: FakeAudio };
    document.body.append(player);
    const audio = new FakeAudio("test.wav");
    player.audio = audio;

    const shadow = player.shadowRoot!;
    const pane = shadow.querySelector<HTMLElement>(".waveform-pane")!;
    Object.defineProperty(player, "clientWidth", { value: 500 });
    Object.defineProperty(pane, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 500, top: 0, bottom: 80, right: 500, height: 80 }),
    });

    const seek = vi.fn();
    player.addEventListener("seek", seek);
    pane.dispatchEvent(new MouseEvent("click", { clientX: 250, bubbles: true }));

    expect(seek).toHaveBeenCalledOnce();
    expect(audio.paused).toBe(false);

    pane.dispatchEvent(new MouseEvent("click", { clientX: 300, bubbles: true }));
    expect(audio.paused).toBe(true);
  });

  it("hides waveform or spectrogram panes from boolean attributes", () => {
    vi.stubGlobal("Audio", FakeAudio);
    const player = document.createElement("wavegram-player");
    player.setAttribute("show-waveform", "false");
    document.body.append(player);

    expect(player.shadowRoot!.querySelector(".waveform-pane")!.classList.contains("hidden")).toBe(true);
    expect(player.shadowRoot!.querySelector(".spectrogram-pane")!.classList.contains("hidden")).toBe(false);

    player.setAttribute("show-waveform", "true");
    player.setAttribute("show-spectrogram", "false");

    expect(player.shadowRoot!.querySelector(".waveform-pane")!.classList.contains("hidden")).toBe(false);
    expect(player.shadowRoot!.querySelector(".spectrogram-pane")!.classList.contains("hidden")).toBe(true);
  });

  it("hides controls and time by default", () => {
    const player = document.createElement("wavegram-player");
    document.body.append(player);

    expect(player.shadowRoot!.querySelector(".toolbar")!.classList.contains("hidden")).toBe(true);

    player.setAttribute("show-controls", "");
    player.setAttribute("show-time", "");

    expect(player.shadowRoot!.querySelector(".toolbar")!.classList.contains("hidden")).toBe(false);
    expect(player.shadowRoot!.querySelector("button")!.classList.contains("hidden")).toBe(false);
    expect(player.shadowRoot!.querySelector(".time")!.classList.contains("hidden")).toBe(false);
  });

  it("uses normal waveform as the default style and normalizes style aliases", () => {
    const player = document.createElement("wavegram-player") as HTMLElement & { waveformStyle: string };
    document.body.append(player);

    expect(player.waveformStyle).toBe("waveform");

    player.setAttribute("waveform-style", "line");
    expect(player.waveformStyle).toBe("lines");

    player.setAttribute("waveform-style", "mirror");
    expect(player.waveformStyle).toBe("waveform");

    player.setAttribute("waveform-style", "blocks");
    expect(player.waveformStyle).toBe("blocks");
  });

  it("uses magma as the default color map and accepts legacy audition", () => {
    const player = document.createElement("wavegram-player") as HTMLElement & { colorMap: string };
    document.body.append(player);

    expect(player.colorMap).toBe("magma");

    player.setAttribute("color-map", "audition");
    expect(player.colorMap).toBe("audition");
  });

  it("shows all channels by default and accepts mix or numeric channels", () => {
    const player = document.createElement("wavegram-player") as HTMLElement & { channel: string | number };
    document.body.append(player);

    expect(player.channel).toBe("all");

    player.setAttribute("channel", "mix");
    expect(player.channel).toBe("mix");

    player.setAttribute("channel", "1");
    expect(player.channel).toBe(1);

    player.setAttribute("channel", "invalid");
    expect(player.channel).toBe("all");
  });

  it("allocates total height across visible panes when individual heights are not set", () => {
    const player = document.createElement("wavegram-player");
    player.setAttribute("height", "300");
    document.body.append(player);

    const waveform = player.shadowRoot!.querySelector<HTMLCanvasElement>(".waveform")!;
    const spectrogram = player.shadowRoot!.querySelector<HTMLCanvasElement>(".spectrogram")!;
    expect(waveform.style.height).toBe("120px");
    expect(spectrogram.style.height).toBe("180px");

    player.setAttribute("show-waveform", "false");
    expect(spectrogram.style.height).toBe("300px");
  });

  it("recomputes waveform peaks when the host width changes", () => {
    const player = document.createElement("wavegram-player") as HTMLElement & {
      audioBuffer?: AudioBuffer;
      waveformPeaks?: { min: Float32Array; max: Float32Array }[];
      handleResize: () => void;
    };
    let width = 320;
    Object.defineProperty(player, "clientWidth", { get: () => width });
    document.body.append(player);
    player.audioBuffer = {
      duration: 1,
      length: 640,
      numberOfChannels: 1,
      sampleRate: 16000,
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
      getChannelData: () => new Float32Array(640),
    } as AudioBuffer;

    player.handleResize();
    expect(player.waveformPeaks?.[0]?.max.length).toBe(320);

    width = 480;
    player.handleResize();
    expect(player.waveformPeaks?.[0]?.max.length).toBe(480);
  });
});
