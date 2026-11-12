/** Protocolo JSON sobre WebSocket. O servidor é autoritativo: o cliente só envia intenções e só anima eventos. */
import type { Intent, Look, MatchEvent, WeaponState } from "@tankclone/core";
import type { CardReward } from "./cards";

export type ClientIntent = Exclude<Intent, never> extends infer I ? (I extends { playerId: string } ? Omit<I, "playerId"> : never) : never;

export type ClientMsg =
  | { t: "auth"; mode: "register" | "login"; nick: string; password: string }
  | { t: "rooms" }
  | { t: "createRoom"; mapId: string; maxPlayers: number }
  | { t: "joinRoom"; roomId: string; team?: number }
  | { t: "leaveRoom" }
  | { t: "addBot"; team?: number }
  | { t: "removeBot"; nick: string }
  | { t: "setLoadout"; weaponId?: string; build?: string }
  | { t: "setLook"; look: unknown }
  | { t: "chat"; text: string }
  | { t: "start" }
  | { t: "intent"; intent: ClientIntent }
  /** Carta escolhida na tela de fim de partida (0–8). */
  | { t: "pickCard"; index: number }
  /** Ferreiro/loja (tudo garantido; recursos comprados com gold). */
  | { t: "forge" }
  | { t: "buy"; item: string; count: number }
  | { t: "strengthen"; weaponId: string; item: string; count: number }
  | { t: "compose"; weaponId: string; item: string };

export interface RoomInfo {
  id: string;
  mapId: string;
  maxPlayers: number;
  status: "lobby" | "playing";
  players: Array<{ nick: string; team: number; weaponId: string; build: string; look: Look; connected: boolean; bot?: boolean }>;
  host: string;
}

export interface MatchSetup {
  seed: number;
  mapId: string;
  players: Array<{ id: string; team: number; x: number; spawnY?: number; weaponId: string; build: string; look: Look; facing: 1 | -1;
    /** Ferreiro: nível (+0..+12) e atributos compostos da arma escolhida. */
    weaponLevel?: number; compose?: WeaponState["compose"] }>;
}

export type ServerMsg =
  | { t: "authOk"; nick: string; level: number; xp: number; gold?: number; unlocks: string[]; look: Look }
  | { t: "error"; msg: string }
  | { t: "rooms"; rooms: RoomInfo[] }
  | { t: "room"; room: RoomInfo | null }
  | { t: "start"; setup: MatchSetup; events: MatchEvent[] }
  /** Reconexão: mesmo setup + todo o log de eventos desde o início. */
  | { t: "resume"; setup: MatchSetup; events: MatchEvent[] }
  | { t: "events"; events: MatchEvent[] }
  /** Chat efêmero: só da sala ou só do saguão; nunca vai para o banco. */
  | { t: "chat"; from: string; text: string; scope: "room" | "lobby" }
  | { t: "end"; winnerTeam: number | null; xp: Record<string, { gained: number; level: number }>; cards?: { pickMs: number } }
  /** Resultado da carta: a escolhida (ou a automática, se o tempo acabou) e as 9 reveladas. */
  | { t: "forge"; gold: number; inventory: Record<string, number>; weapons: Record<string, WeaponState>; result?: string }
  | { t: "card"; index: number; reward: CardReward; deck: CardReward[]; auto: boolean; level: number; xp: number; gold: number };
