export function readAudioFileSampleRate(arrayBuffer: ArrayBuffer): number | undefined {
  const view = new DataView(arrayBuffer);
  return readWavSampleRate(view) ?? readFlacSampleRate(view) ?? readOggSampleRate(view) ?? readMp3SampleRate(view);
}

function readWavSampleRate(view: DataView): number | undefined {
  if (view.byteLength < 28) return undefined;

  if (!hasAscii(view, 0, "RIFF") && !hasAscii(view, 0, "RF64")) return undefined;
  if (!hasAscii(view, 8, "WAVE")) return undefined;

  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;
    if (chunkDataOffset + chunkSize > view.byteLength) return undefined;

    if (chunkId === "fmt ") {
      if (chunkSize < 8) return undefined;
      const sampleRate = view.getUint32(chunkDataOffset + 4, true);
      return Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : undefined;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  return undefined;
}

function readFlacSampleRate(view: DataView): number | undefined {
  if (!hasAscii(view, 0, "fLaC")) return undefined;
  let offset = 4;

  while (offset + 4 <= view.byteLength) {
    const header = view.getUint8(offset);
    const blockType = header & 0x7f;
    const blockSize = (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3);
    const blockDataOffset = offset + 4;
    if (blockDataOffset + blockSize > view.byteLength) return undefined;

    if (blockType === 0) {
      if (blockSize < 13) return undefined;
      const sampleRate =
        (view.getUint8(blockDataOffset + 10) << 12) |
        (view.getUint8(blockDataOffset + 11) << 4) |
        (view.getUint8(blockDataOffset + 12) >> 4);
      return sampleRate > 0 ? sampleRate : undefined;
    }

    offset = blockDataOffset + blockSize;
  }

  return undefined;
}

function readOggSampleRate(view: DataView): number | undefined {
  const vorbisOffset = findBytes(view, [0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73]);
  if (vorbisOffset !== -1 && vorbisOffset + 16 <= view.byteLength) {
    const sampleRate = view.getUint32(vorbisOffset + 12, true);
    return sampleRate > 0 ? sampleRate : undefined;
  }

  const opusOffset = findBytes(view, [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]);
  if (opusOffset !== -1 && opusOffset + 16 <= view.byteLength) {
    const inputSampleRate = view.getUint32(opusOffset + 12, true);
    return inputSampleRate > 0 ? inputSampleRate : 48000;
  }

  return undefined;
}

function readMp3SampleRate(view: DataView): number | undefined {
  let offset = 0;
  if (hasAscii(view, 0, "ID3") && view.byteLength >= 10) {
    offset = 10 + readSynchsafeUint32(view, 6);
  }

  const mpeg1Rates = [44100, 48000, 32000] as const;
  const mpeg2Rates = [22050, 24000, 16000] as const;
  const mpeg25Rates = [11025, 12000, 8000] as const;

  for (; offset + 4 <= view.byteLength; offset += 1) {
    const first = view.getUint8(offset);
    const second = view.getUint8(offset + 1);
    if (first !== 0xff || (second & 0xe0) !== 0xe0) continue;

    const versionBits = (second >> 3) & 0x03;
    const layerBits = (second >> 1) & 0x03;
    const rateIndex = (view.getUint8(offset + 2) >> 2) & 0x03;
    if (versionBits === 1 || layerBits === 0 || rateIndex === 3) continue;

    const rates = versionBits === 3 ? mpeg1Rates : versionBits === 2 ? mpeg2Rates : mpeg25Rates;
    return rates[rateIndex];
  }

  return undefined;
}

function findBytes(view: DataView, pattern: readonly number[]): number {
  const lastStart = view.byteLength - pattern.length;
  for (let offset = 0; offset <= lastStart; offset += 1) {
    let matched = true;
    for (let index = 0; index < pattern.length; index += 1) {
      if (view.getUint8(offset + index) !== pattern[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return offset;
  }
  return -1;
}

function readSynchsafeUint32(view: DataView, offset: number): number {
  return (
    (view.getUint8(offset) << 21) |
    (view.getUint8(offset + 1) << 14) |
    (view.getUint8(offset + 2) << 7) |
    view.getUint8(offset + 3)
  );
}

function hasAscii(view: DataView, offset: number, expected: string): boolean {
  if (offset + expected.length > view.byteLength) return false;
  return readAscii(view, offset, expected.length) === expected;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}
