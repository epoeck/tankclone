/**
 * Mapas. Um mapa de jogo = arte (PNG) + máscara (RGBA: preto = ar, branco = destrutível, vermelho puro = indestrutível)
 * + manifesto. A máscara é "assada" por `npm run maps:build` em `mask.bin` (RLE de estados 0/1/2), que cliente e servidor
 * carregam sem decodificar PNG (determinístico e leve). Aqui só há lógica pura: tipos, registro, codec e validação.
 */
import { AIR, DESTRUCTIBLE, INDESTRUCTIBLE, Terrain } from "./terrain";

export interface MapManifest {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Arquivos relativos à pasta do mapa. */
  art: string;
  mask: string;
  /** Fundo opcional (céu); sem ele o cliente usa um degradê. */
  background?: string;
  /** Pontos de nascimento (x em px) por time, na ordem de entrada na sala; até 4 por time. */
  spawns: { "1": number[]; "2": number[] };
  /** Multiplicador do vento sentido neste mapa (hazards futuros). Padrão 1. */
  windMultiplier?: number;
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Tem chão indestrutível? (informativo para a UI). */
  indestructible: boolean;
  build(): Terrain;
  spawns?: { "1": number[]; "2": number[] };
  windMultiplier?: number;
  /** Pasta pública da arte (cliente): `/maps/<id>/`. */
  artBase?: string;
  manifest?: MapManifest;
}

// ---------- codec RLE de estados ----------

/** RLE: cada corrida = [estado (1 byte)][comprimento (varint LEB128)]. */
export function encodeStates(states: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < states.length) {
    const s = states[i]!; let j = i;
    while (j < states.length && states[j] === s) j++;
    out.push(s); let n = j - i;
    while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
    out.push(n); i = j;
  }
  return Uint8Array.from(out);
}

export function decodeStates(bytes: Uint8Array, total: number): Uint8Array {
  const out = new Uint8Array(total);
  let p = 0, o = 0;
  while (p < bytes.length) {
    const s = bytes[p++]!; let n = 0, shift = 1, b: number;
    do { b = bytes[p++]!; n += (b & 0x7f) * shift; shift *= 128; } while (b & 0x80);
    if (s > INDESTRUCTIBLE || o + n > total) throw new Error("mask.bin corrompido");
    out.fill(s, o, o + n); o += n;
  }
  if (o !== total) throw new Error("mask.bin com tamanho diferente do mapa");
  return out;
}

/** Classifica um pixel RGBA da máscara (mesma regra do Terrain.fromMask). */
export function classifyPixel(r: number, g: number, b: number): number {
  if (r >= 128 && r - g >= 96) return INDESTRUCTIBLE;
  return 0.299 * r + 0.587 * g + 0.114 * b >= 128 ? DESTRUCTIBLE : AIR;
}

export interface MaskReport {
  errors: string[];
  warnings: string[];
  /** Percentual de cada estado. */
  pct: { air: number; destructible: number; indestructible: number };
}

/**
 * Valida a máscara RGBA de um mapa: tamanho, proporção de cada estado, tons intermediários (antisserrilhado),
 * vermelhos que não são puros e chão sob cada ponto de nascimento.
 */
export function analyzeMask(m: Pick<MapManifest, "width" | "height" | "spawns">, rgba: ArrayLike<number>, artSize?: { width: number; height: number }): MaskReport {
  const errors: string[] = [], warnings: string[] = [];
  const { width: w, height: h } = m;
  if (rgba.length !== w * h * 4) errors.push(`máscara com ${rgba.length / 4} pixels; o manifesto pede ${w}×${h} = ${w * h}`);
  if (artSize && (artSize.width !== w || artSize.height !== h)) errors.push(`arte ${artSize.width}×${artSize.height} difere da máscara/manifesto ${w}×${h}`);
  if (errors.length) return { errors, warnings, pct: { air: 0, destructible: 0, indestructible: 0 } };
  const states = new Uint8Array(w * h);
  let air = 0, dest = 0, indes = 0, mid = 0, impureRed = 0;
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4]!, g = rgba[i * 4 + 1]!, b = rgba[i * 4 + 2]!;
    const s = classifyPixel(r, g, b); states[i] = s;
    if (s === AIR) air++; else if (s === DESTRUCTIBLE) dest++; else indes++;
    const pure = (r <= 24 && g <= 24 && b <= 24) || (r >= 232 && g >= 232 && b >= 232) || (r >= 232 && g <= 24 && b <= 24);
    if (!pure) { if (r - g >= 40 && r >= 100) impureRed++; else mid++; }
  }
  const total = w * h, pct = { air: (air / total) * 100, destructible: (dest / total) * 100, indestructible: (indes / total) * 100 };
  if (pct.destructible + pct.indestructible < 5) warnings.push("quase não há chão (menos de 5% do mapa)");
  if (pct.air < 20) warnings.push("pouco ar (menos de 20%): o mapa parece sólido demais");
  if (mid / total > 0.001) warnings.push(`${((mid / total) * 100).toFixed(2)}% dos pixels são tons intermediários (cinza/antisserrilhado); use preto e branco puros`);
  if (impureRed > 0) warnings.push(`${impureRed} pixels de vermelho não puro (antisserrilhado no vermelho); use #FF0000 sem suavização`);
  const t = Terrain.fromStates(w, h, states);
  for (const team of ["1", "2"] as const) {
    if (!m.spawns[team]?.length) errors.push(`time ${team} sem pontos de nascimento`);
    m.spawns[team]?.forEach((x, i) => {
      if (!Number.isInteger(x) || x < 1 || x >= w - 1) { errors.push(`spawn ${team}#${i + 1} (x=${x}) fora do mapa`); return; }
      const y = t.surfaceY(x, 0);
      if (y < 0) errors.push(`spawn ${team}#${i + 1} (x=${x}) sem chão na coluna: o boneco cairia para fora do mapa`);
      else if (t.isSolid(x, 0)) errors.push(`spawn ${team}#${i + 1} (x=${x}) começa dentro do chão (pixel do topo é sólido)`);
    });
  }
  return { errors, warnings, pct };
}

/** Monta um MapDef a partir do manifesto e dos estados já decodificados. */
export function mapFromStates(manifest: MapManifest, states: Uint8Array, artBase?: string): MapDef {
  return {
    id: manifest.id, name: manifest.name, width: manifest.width, height: manifest.height,
    indestructible: states.includes(INDESTRUCTIBLE),
    build: () => Terrain.fromStates(manifest.width, manifest.height, states),
    spawns: manifest.spawns, windMultiplier: manifest.windMultiplier ?? 1, artBase, manifest,
  };
}

// ---------- registro e mapas procedurais ----------

const W = 2000, H = 600;
const defaultSpawns = (width: number) => ({ "1": [150, 290, 430, 570], "2": [width - 150, width - 290, width - 430, width - 570] });

/** Registro global de mapas. Os procedurais ficam sempre disponíveis (testes e fallback); os de arte entram com `registerMap`. */
export const MAPS: Record<string, MapDef> = {
  colinas: { id: "colinas", name: "Colinas", width: W, height: H, indestructible: false, spawns: defaultSpawns(W),
    build: () => Terrain.fromHeightFn(W, H, x => 400 + Math.sin(x / 140) * 40 + Math.sin(x / 47) * 10) },
  planalto: { id: "planalto", name: "Planalto", width: W, height: H, indestructible: true, spawns: defaultSpawns(W),
    build: () => { const t = Terrain.fromHeightFn(W, H, x => 380 + Math.sin(x / 200) * 30); t.fillIndestructible(0, H - 40, W, H); return t; } },
  vale: { id: "vale", name: "Vale", width: W, height: H, indestructible: false, spawns: defaultSpawns(W),
    build: () => Terrain.fromHeightFn(W, H, x => 350 + Math.cos((x / W) * Math.PI * 2) * 60) },
};

export function registerMap(def: MapDef): void { MAPS[def.id] = def; }
