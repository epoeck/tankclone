/** Carrega os mapas assados (manifest.json + mask.bin) da pasta pública do cliente e os registra no core. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeStates, mapFromStates, registerMap, type MapManifest } from "@tankclone/core";

export const DEFAULT_MAPS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/public/maps");

export interface LoadResult { loaded: string[]; skipped: Array<{ id: string; reason: string }> }

export function loadMaps(dir = DEFAULT_MAPS_DIR): LoadResult {
  const res: LoadResult = { loaded: [], skipped: [] };
  const indexFile = join(dir, "index.json");
  if (!existsSync(indexFile)) return res;
  const ids = (JSON.parse(readFileSync(indexFile, "utf8")) as { maps?: unknown }).maps;
  if (!Array.isArray(ids)) return res;
  for (const id of ids) {
    if (typeof id !== "string" || !/^[a-z0-9_-]{1,32}$/.test(id)) { res.skipped.push({ id: String(id), reason: "id inválido" }); continue; }
    try {
      const m = JSON.parse(readFileSync(join(dir, id, "manifest.json"), "utf8")) as MapManifest;
      if (m.id !== id) throw new Error("id do manifesto difere da pasta");
      const states = decodeStates(new Uint8Array(readFileSync(join(dir, id, "mask.bin"))), m.width * m.height);
      registerMap(mapFromStates(m, states, `/maps/${id}/`));
      res.loaded.push(id);
    } catch (e) { res.skipped.push({ id, reason: (e as Error).message }); }
  }
  return res;
}
