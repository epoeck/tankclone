/** Servidor WebSocket. Autoritativo: roda o core, valida intenções, transmite eventos. */
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { randomInt } from "node:crypto";
import { ACCESSORIES, COMPOSE_KINDS, OWNABLE_KINDS, STRENGTHEN_EXP, STRENGTHEN_MAX, SUPER_STONE, SUPER_STONE_EXP, TEST_PRICE, WEAPONS, WING_COUNT, accessoryByRef, canCompose, canStrengthen, composeWith, isAvailablePiece, own, shopItem, slotGear, strengthenWith, type EquipPlace, type ItemKind, type WardrobeSlot } from "@tankclone/core";
import { sanitizeLook } from "@tankclone/core";
import { deriveLook, gearOf, statsPanel } from "./bag";
import { Db, levelForXp, unlocksAt } from "./db";
import { CARD_PICK_MS, CardTable, type CardReward } from "./cards";
import { ChatLimiter, cleanChat } from "./chat";
import { loadMaps } from "./maps";
import { AuthLimiter, DEFAULT_LIMITS, type LimitConfig } from "./limits";
import { Lobby, Room, XP_LOSE, XP_WIN, type Outbox } from "./rooms";
import type { ClientMsg, ServerMsg } from "./protocol";
import { staticHandler } from "./static";

export interface ServerOptions {
  port?: number;
  dbPath?: string;
  /** Período do relógio das partidas (ms). */
  tickMs?: number;
  /** Máximo de conexões simultâneas. */
  maxConnections?: number;
  limits?: Partial<LimitConfig>;
  /** Confia no CF-Connecting-IP quando a conexão vem do loopback (cloudflared local). Padrão: true. */
  trustCloudflare?: boolean;
  log?: (...a: unknown[]) => void;
  /** Pasta dos mapas assados (padrão: packages/client/public/maps). */
  mapsDir?: string;
  /** Pasta da build do cliente para servir por HTTP na mesma porta (ex.: packages/client/dist). */
  staticDir?: string;
}

interface Session { ws: WebSocket; ip: string; nick?: string; authing?: boolean; lastMsg: number; burst: number; chat: ChatLimiter }

export function startServer(opts: ServerOptions = {}) {
  const db = new Db(opts.dbPath ?? ":memory:");
  const lobby = new Lobby();
  const sessions = new Map<string, Session>(); // nick → sessão
  const tickMs = opts.tickMs ?? 100;
  const log = opts.log ?? ((...a: unknown[]) => console.error(...a));
  const maps = loadMaps(opts.mapsDir);
  if (maps.loaded.length) log(`mapas carregados: ${maps.loaded.join(", ")}`);
  for (const k of maps.skipped) log(`mapa ignorado ${k.id}: ${k.reason}`);
  const limiter = new AuthLimiter({ ...DEFAULT_LIMITS, ...opts.limits });
  const serveStatic = opts.staticDir ? staticHandler(opts.staticDir) : undefined;
  const http = createServer((req, res) => {
    if (serveStatic) { serveStatic(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); return; }
    res.writeHead(200, { "content-type": "text/plain" }); res.end("tankclone server");
  });
  const wss = new WebSocketServer({ server: http, maxPayload: 4096 });

  const send = (ws: WebSocket, m: ServerMsg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); };
  const sendNick = (nick: string, m: ServerMsg) => { const s = sessions.get(nick); if (s) send(s.ws, m); };
  const outbox: Outbox = {
    broadcast: (room, m) => { for (const mem of room.members.values()) if (mem.connected) sendNick(mem.nick, m as ServerMsg); },
    awardXp: results => {
      const out: Record<string, { gained: number; level: number }> = {};
      for (const r of results) { const gained = r.won ? XP_WIN : XP_LOSE; const a = db.addXp(r.nick, gained); out[r.nick] = { gained, level: a?.level ?? 1 }; }
      return out;
    },
  };
  const cards = new CardTable(n => randomInt(0, n));
  /** Concede a carta e conta ao jogador (o resto do baralho vai junto para ele ver o que perdeu). */
  const grantCard = (nick: string, c: { index: number; reward: CardReward; deck: CardReward[] }, auto: boolean) => {
    const acc = c.reward.kind === "xp" ? db.addXp(nick, c.reward.amount) : null;
    const gold = c.reward.kind === "gold" ? db.addGold(nick, c.reward.amount) : db.getGold(nick);
    const xp = acc?.xp ?? db.getXp(nick);
    sendNick(nick, { t: "card", index: c.index, reward: c.reward, deck: c.deck, auto, level: levelForXp(xp), xp, gold });
  };
  const sendBag = (nick: string, result?: string) => { const items = db.items(nick);
    sendNick(nick, { t: "bag", gold: db.getGold(nick), materials: db.inventory(nick), items, stats: statsPanel(db.getLook(nick), items), ...(result ? { result } : {}) }); };
  const pushRoom = (room: Room) => outbox.broadcast(room, { t: "room", room: room.info() });
  const authOk = (nick: string): ServerMsg => ({ t: "authOk", nick, level: db.getLevel(nick), xp: db.getXp(nick), gold: db.getGold(nick), unlocks: unlocksAt(db.getLevel(nick)), look: db.getLook(nick) });
  /** Depois de mudar o equipado: o Look salvo passa a ser o derivado das peças vestidas; sala, perfil e mochila se atualizam. */
  const refreshLook = (nick: string, result?: string) => {
    const sex = db.getLook(nick).appearance.sex;
    db.ensureStarter(nick); db.normalizeEquipped(nick, sex);
    const items = db.items(nick), look = db.setLook(nick, deriveLook(db.getLook(nick), items));
    const r = lobby.roomOf(nick);
    if (r && r.status === "lobby") { const mem = r.members.get(nick)!; mem.look = look; mem.weaponId = gearOf(items).weaponId; pushRoom(r); }
    sendNick(nick, authOk(nick)); sendBag(nick, result);
  };
  const SLOT: Partial<Record<ItemKind, { slot: WardrobeSlot; offset: number }>> = { head: { slot: "head", offset: 1 }, glass: { slot: "glass", offset: 1 }, hair: { slot: "hair", offset: 0 }, cloth: { slot: "cloth", offset: 0 }, face: { slot: "face", offset: 0 } };

  function afterEvents(room: Room, now: number) {
    if (room.readyToFinish(now)) {
      const res = room.finish(outbox);
      const humans = Object.keys(res.xp);
      cards.deal(humans, now);
      outbox.broadcast(room, { t: "end", winnerTeam: res.winnerTeam, xp: res.xp, cards: { pickMs: CARD_PICK_MS } });
      pushRoom(room);
    }
  }

  const timer = setInterval(() => {
    const now = Date.now();
    for (const room of [...lobby.rooms.values()]) {
      if (room.status !== "playing") continue;
      try {
        const events = room.tick(tickMs / 1000, now);
        if (events.length) outbox.broadcast(room, { t: "events", events });
        afterEvents(room, now);
      } catch (e) { log("erro no tick da sala", room.id, e); }
    }
    for (const c of cards.expire(now)) grantCard(c.nick, c, true);
    lobby.prune();
  }, tickMs);
  const pruneTimer = setInterval(() => limiter.prune(), 60_000);

  async function onMessage(s: Session, raw: string) {
    // limite simples de taxa: ~30 mensagens/s com rajada de 60
    const now = Date.now();
    s.burst = Math.max(0, s.burst - (now - s.lastMsg) * 0.03) + 1; s.lastMsg = now;
    if (s.burst > 60) { send(s.ws, { t: "error", msg: "mensagens demais" }); return; }
    let m: ClientMsg;
    try { m = JSON.parse(raw) as ClientMsg; } catch { return send(s.ws, { t: "error", msg: "JSON inválido" }); }
    if (typeof m !== "object" || m === null || typeof m.t !== "string") return send(s.ws, { t: "error", msg: "mensagem inválida" });

    if (m.t === "auth") {
      if (s.nick) return send(s.ws, { t: "error", msg: "já autenticado" });
      if (s.authing) return send(s.ws, { t: "error", msg: "aguarde" });
      const nickIn = String(m.nick).slice(0, 64).toLowerCase(), kIp = `ip:${s.ip}`, kNick = `nick:${nickIn}`;
      const wait = Math.max(limiter.blockedFor(kIp), limiter.blockedFor(kNick));
      if (wait > 0) return send(s.ws, { t: "error", msg: `tentativas demais; aguarde ${wait}s` });
      if (m.mode === "register" && !limiter.allowRegister(s.ip)) return send(s.ws, { t: "error", msg: "limite de cadastros por hora atingido" });
      s.authing = true;
      let r: Awaited<ReturnType<Db["login"]>>;
      try { r = m.mode === "register" ? await db.register(String(m.nick), String(m.password)) : await db.login(String(m.nick), String(m.password)); }
      finally { s.authing = false; }
      if (typeof r === "string") { if (m.mode !== "register") { limiter.fail(kIp); limiter.fail(kNick); } return send(s.ws, { t: "error", msg: r }); }
      limiter.success(kNick);
      if (s.ws.readyState !== s.ws.OPEN) return; // desconectou durante o hash
      const old = sessions.get(r.nick);
      if (old && old.ws !== s.ws) { send(old.ws, { t: "error", msg: "login em outro lugar" }); old.nick = undefined; old.ws.close(); }
      s.nick = r.nick; sessions.set(r.nick, s);
      db.ensureStarter(r.nick); db.normalizeEquipped(r.nick, r.look.appearance.sex); // mochila original: migra a conta antiga na primeira vez
      send(s.ws, { t: "authOk", nick: r.nick, level: r.level, xp: r.xp, gold: db.getGold(r.nick), unlocks: unlocksAt(r.level), look: r.look });
      const room = lobby.roomOf(r.nick); // reconexão no meio da partida
      if (room) {
        const mem = room.members.get(r.nick)!; mem.connected = true;
        if (room.status === "playing" && room.setup) send(s.ws, { t: "resume", setup: room.setup, events: room.log });
        pushRoom(room);
      }
      return;
    }
    const nick = s.nick;
    if (!nick) return send(s.ws, { t: "error", msg: "faça login primeiro" });
    const err = (msg: string) => send(s.ws, { t: "error", msg });

    switch (m.t) {
      case "rooms": return send(s.ws, { t: "rooms", rooms: [...lobby.rooms.values()].filter(r => r.status === "lobby").map(r => r.info()) });
      case "createRoom": { const r = lobby.create(nick, String(m.mapId), Number(m.maxPlayers), db.getLook(nick), gearOf(db.items(nick)).weaponId); return typeof r === "string" ? err(r) : pushRoom(r); }
      case "joinRoom": { const r = lobby.join(nick, String(m.roomId), m.team, db.getLook(nick), gearOf(db.items(nick)).weaponId); return typeof r === "string" ? err(r) : pushRoom(r); }
      case "leaveRoom": { const r = lobby.leave(nick, true); send(s.ws, { t: "room", room: null }); if (r && lobby.rooms.has(r.id)) pushRoom(r); return; }
      case "addBot": { const r = lobby.roomOf(nick); if (!r) return err("você não está em uma sala"); const e = r.addBot(nick, m.team); return e ? err(e) : pushRoom(r); }
      case "removeBot": { const r = lobby.roomOf(nick); if (!r) return err("você não está em uma sala"); const e = r.removeBot(nick, String(m.nick)); return e ? err(e) : pushRoom(r); }
      case "setLook": {
        // a loja/mochila só salva sexo, pele, cor do cabelo e tinturas; as peças vêm do que está equipado
        const base = db.getLook(nick), inc = sanitizeLook(m.look);
        db.setLook(nick, { ...base, appearance: { ...base.appearance, sex: inc.appearance.sex, skin: inc.appearance.skin, hairColor: inc.appearance.hairColor }, tints: inc.tints });
        return refreshLook(nick);
      }
      case "chat": {
        const text = cleanChat(m.text);
        if (!text) return err("mensagem vazia");
        if (!s.chat.allow()) return err("devagar: muitas mensagens de chat");
        const r = lobby.roomOf(nick);
        if (r) outbox.broadcast(r, { t: "chat", from: nick, text, scope: "room" });
        else for (const o of sessions.values()) if (o.nick && !lobby.roomOf(o.nick)) send(o.ws, { t: "chat", from: nick, text, scope: "lobby" });
        return;
      }
      case "setLoadout": {
        const r = lobby.roomOf(nick); if (!r) return err("você não está em uma sala");
        if (m.weaponId !== undefined) { // a arma da sala é a vestida na mochila
          const w = db.items(nick).find(i => i.kind === "weapon" && i.ref === m.weaponId);
          if (!w) return err("arma desconhecida");
          if (!w.place) { db.equipItem(nick, w.id); sendBag(nick); }
        }
        const e = r.setLoadout(nick, m.weaponId, m.build); return e ? err(e) : pushRoom(r);
      }
      case "start": {
        const r = lobby.roomOf(nick); if (!r) return err("você não está em uma sala");
        const res = r.start(nick, Date.now(), n => gearOf(db.items(n)));
        if ("error" in res) return err(res.error);
        outbox.broadcast(r, { t: "start", setup: res.setup, events: res.events });
        return;
      }
      case "bag": return sendBag(nick);
      case "equip": {
        const it = db.item(nick, Number(m.itemId)); if (!it) return err("item não encontrado");
        if (!(OWNABLE_KINDS as readonly string[]).includes(it.kind)) return err("este lugar ainda não tem arte nesta versão");
        if (it.sex && it.sex !== db.getLook(nick).appearance.sex) return err("peça do outro avatar: troque o sexo na loja");
        const e = db.equipItem(nick, it.id, m.place ?? undefined); return e ? err(e) : refreshLook(nick);
      }
      case "unequip": {
        const kind = String(m.place) as EquipPlace;
        if (!["head", "glass", "wing", "eff", "suits", "necklace", "armlet1", "armlet2", "ring1", "ring2", "offhand", "pet", "chatball", "badge", "healstone"].includes(kind)) return err("troque por outra peça: este lugar não fica vazio");
        db.unequipPlace(nick, kind); return refreshLook(nick);
      }
      case "buy": {
        if ("catalogKind" in m) { // peça de vestuário/asa: cria a instância na mochila
          const kind = String(m.catalogKind) as ItemKind, ref = Number(m.ref), sex = m.sex === "f" ? "f" : m.sex === "m" ? "m" : db.getLook(nick).appearance.sex;
          if (!Number.isInteger(ref) || ref < 1) return err("peça inválida");
          const slot = SLOT[kind];
          if (slot) { if (!isAvailablePiece(sex, slot.slot, ref - slot.offset)) return err("peça indisponível"); }
          else if (kind === "wing") { if (ref >= WING_COUNT) return err("peça indisponível"); }
          else if ((kind === "armlet" || kind === "ring") && ((kind === "armlet" && String(ref) === "8015") || (kind === "ring" && String(ref) === "9024"))) { const e = db.buyAccessory(nick, String(ref), TEST_PRICE); return e ? err(e) : sendBag(nick, "Comprado: na sua mochila"); }
          else if (slotGear(kind, String(ref))) { const e = db.buyPiece(nick, kind, String(ref), "", TEST_PRICE); return e ? err(e) : sendBag(nick, "Comprado: na sua mochila"); }
          else return err("este item não é vendido");
          const e = db.buyPiece(nick, kind, String(ref), kind === "wing" ? "" : sex, TEST_PRICE); return e ? err(e) : sendBag(nick, "Comprado: na sua mochila");
        }
        const it = shopItem(String(m.item)), count = Number(m.count);
        if (!it) return err("item desconhecido");
        if (!Number.isInteger(count) || count < 1 || count > 9999) return err("quantidade inválida");
        const e = db.buy(nick, it.id, count, it.price); return e ? err(e) : sendBag(nick, `Comprou ${count}× ${it.name}`);
      }
      case "strengthen": {
        const it = db.item(nick, Number(m.itemId)), count = Number(m.count);
        if (!it) return err("item não encontrado");
        if (!canStrengthen(it.kind)) return err("este item não pode ser fortalecido");
        if (!Number.isInteger(count) || count < 1 || count > 9999) return err("quantidade inválida");
        if (it.level >= STRENGTHEN_MAX) return err(`o item já está no +${STRENGTHEN_MAX}`);
        if ((db.inventory(nick)[SUPER_STONE] ?? 0) < count) return err("Super Pedras insuficientes");
        const { weapon: next, used } = strengthenWith(it, SUPER_STONE_EXP, count);
        const e = db.spendAndSetItem(nick, SUPER_STONE, used, it.id, next); if (e) return err(e);
        return refreshLook(nick, next.level > it.level ? `Fortalecido: +${next.level}` : `+${next.exp} EXP (faltam ${STRENGTHEN_EXP[next.level + 1]! - next.exp})`);
      }
      case "compose": {
        const it = db.item(nick, Number(m.itemId)), stone = shopItem(String(m.stone));
        if (!it) return err("item não encontrado");
        if (!canCompose(it.kind)) return err("este item não pode receber composição");
        if (!stone || stone.kind !== "compose" || !stone.attr || !stone.value) return err("use uma pedra de composição");
        if ((db.inventory(nick)[stone.id] ?? 0) < 1) return err("pedra insuficiente");
        const next = composeWith(it, stone.attr, stone.value);
        const e = db.spendAndSetItem(nick, stone.id, 1, it.id, next); if (e) return err(e);
        return sendBag(nick, `Composição: ${stone.attr.toUpperCase()} ${stone.value}`);
      }
      case "fuse": {
        if (!Array.isArray(m.itemIds) || m.itemIds.length !== 4 || m.itemIds.some(id => !Number.isInteger(id))) return err("selecione quatro acessórios");
        const selected = m.itemIds.map(id => db.item(nick, id));
        if (selected.some(i => !i || (i.kind !== "armlet" && i.kind !== "ring"))) return err("selecione quatro acessórios iguais");
        const target = accessoryByRef(selected[0]!.ref)?.next;
        if (!target) return err("este acessório já está no nível máximo");
        const e = db.fuseAccessories(nick, m.itemIds); return e ? err(e) : sendBag(nick, `Fusão garantida: ${accessoryByRef(target)?.name}`);
      }
      case "pickCard": { const r = cards.pick(nick, m.index); if (typeof r === "string") return err(r); grantCard(nick, r, false); return; }
      case "intent": {
        const r = lobby.roomOf(nick); if (!r) return err("você não está em uma sala");
        const res = r.intent(nick, m.intent, Date.now());
        if ("error" in res) return err(res.error);
        outbox.broadcast(r, { t: "events", events: res.events });
        afterEvents(r, Date.now());
        return;
      }
      default: return err("mensagem desconhecida");
    }
  }

  const clientIp = (req: IncomingMessage): string => {
    const remote = req.socket.remoteAddress ?? "?";
    const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
    const cf = req.headers["cf-connecting-ip"];
    return (opts.trustCloudflare ?? true) && loopback && typeof cf === "string" && cf ? cf : remote;
  };

  wss.on("connection", (ws, req) => {
    if (wss.clients.size > (opts.maxConnections ?? 200)) { ws.close(1013); return; }
    const s: Session = { ws, ip: clientIp(req), lastMsg: Date.now(), burst: 0, chat: new ChatLimiter() };
    ws.on("message", d => {
      onMessage(s, d.toString()).catch(e => { log("erro interno", e); send(ws, { t: "error", msg: "erro interno" }); });
    });
    ws.on("close", () => {
      if (s.nick && sessions.get(s.nick) === s) {
        sessions.delete(s.nick);
        const r = lobby.leave(s.nick); // em lobby sai; em partida fica desconectado
        if (r && lobby.rooms.has(r.id)) pushRoom(r);
      }
    });
    ws.on("error", () => ws.close());
  });

  return new Promise<{ port: number; db: Db; lobby: Lobby; close: () => Promise<void> }>(resolve => {
    http.listen(opts.port ?? 0, () => {
      const addr = http.address();
      resolve({
        port: typeof addr === "object" && addr ? addr.port : 0, db, lobby,
        close: () => new Promise<void>(res => { clearInterval(timer); clearInterval(pruneTimer); for (const c of wss.clients) c.terminate(); wss.close(() => http.close(() => { db.close(); res(); })); }),
      });
    });
  });
}
