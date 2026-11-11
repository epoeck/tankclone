/** Mapas provisórios procedurais (a arte final virá por máscara PNG, ver Terrain.fromMask). */
import { Terrain } from "./terrain";

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Chão indestrutível (faixa no fundo) ou tudo tatuzável. */
  indestructible: boolean;
  build(): Terrain;
}

const W = 2000, H = 600;

export const MAPS: Record<string, MapDef> = {
  colinas: { id: "colinas", name: "Colinas", width: W, height: H, indestructible: false,
    build: () => Terrain.fromHeightFn(W, H, x => 400 + Math.sin(x / 140) * 40 + Math.sin(x / 47) * 10) },
  planalto: { id: "planalto", name: "Planalto", width: W, height: H, indestructible: true,
    build: () => { const t = Terrain.fromHeightFn(W, H, x => 380 + Math.sin(x / 200) * 30); t.fillIndestructible(0, H - 40, W, H); return t; } },
  vale: { id: "vale", name: "Vale", width: W, height: H, indestructible: false,
    build: () => Terrain.fromHeightFn(W, H, x => 350 + Math.pow(Math.abs(x - W / 2) / (W / 2), 2) * -0 + Math.cos((x / W) * Math.PI * 2) * 60) },
};
