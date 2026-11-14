/** Carrega os mapas assados (manifest.json + mask.bin) servidos em /maps e os registra no core. */
import { decodeStates, mapFromStates, registerMap, type MapManifest } from "@tankclone/core";

export async function loadClientMaps(base = "/maps"): Promise<string[]> {
  const loaded: string[] = [];
  try {
    const idx = (await (await fetch(`${base}/index.json`)).json()) as { maps?: unknown };
    for (const id of Array.isArray(idx.maps) ? idx.maps : []) {
      if (typeof id !== "string" || !/^[a-z0-9_-]{1,32}$/.test(id)) continue;
      try {
        const m = (await (await fetch(`${base}/${id}/manifest.json`)).json()) as MapManifest;
        const bin = new Uint8Array(await (await fetch(`${base}/${id}/mask.bin`)).arrayBuffer());
        registerMap(mapFromStates(m, decodeStates(bin, m.width * m.height), `${base}/${id}/`));
        loaded.push(id);
      } catch { /* mapa quebrado: ignora */ }
    }
  } catch { /* sem pasta de mapas: ficam só os procedurais */ }
  return loaded;
}
