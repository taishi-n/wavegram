export async function loadAudio(src: string): Promise<ArrayBuffer> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}
