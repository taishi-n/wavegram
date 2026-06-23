const base = "http://127.0.0.1:4444";

async function request(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${path} ${response.status} ${JSON.stringify(json)}`);
  }
  return json.value;
}

const session = await request("POST", "/session", {
  capabilities: { alwaysMatch: { browserName: "safari" } },
});

const id = session.sessionId;

try {
  await request("POST", `/session/${id}/url`, {
    url: "http://127.0.0.1:4173/examples/index.html",
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const before = await request("POST", `/session/${id}/execute/sync`, {
    script: `
      const el = document.querySelector("wavegram-player");
      const root = el?.shadowRoot;
      const waveform = root?.querySelector(".waveform");
      const spectrogram = root?.querySelector(".spectrogram");
      return {
        title: document.title,
        hasPlayer: Boolean(el),
        current: root?.querySelector(".current")?.textContent,
        duration: root?.querySelector(".duration")?.textContent,
        status: root?.querySelector(".status")?.textContent,
        error: root?.querySelector(".error")?.textContent,
        waveform: { width: waveform?.width, height: waveform?.height },
        spectrogram: { width: spectrogram?.width, height: spectrogram?.height }
      };
    `,
    args: [],
  });

  const after = await request("POST", `/session/${id}/execute/sync`, {
    script: `
      const el = document.querySelector("wavegram-player");
      const pane = el.shadowRoot.querySelector(".waveform-pane");
      const rect = pane.getBoundingClientRect();
      pane.dispatchEvent(new MouseEvent("click", {
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top + rect.height * 0.5,
        bubbles: true,
        composed: true
      }));
      return { current: el.shadowRoot.querySelector(".current").textContent };
    `,
    args: [],
  });

  console.log(JSON.stringify({ before, after }, null, 2));
} finally {
  await request("DELETE", `/session/${id}`);
}
