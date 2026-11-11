/** Servidor WebSocket. Autoritativo: roda o core, valida intenções, transmite eventos. */
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { Db, unlocksAt } from "./db";
import { Lobby, Room, XP_LOSE, XP_WIN, type Outbox } from "./rooms";
import type { ClientMsg, ServerMsg } from "./protocol";

export interface ServerOptions {
  port?: number;
  dbPath?: string;
  /** Período do relógio das partidas (ms). */
  tickMs?: number;
  /** Máximo de conexões simultâneas. */
  maxConnections?: number;
}

interface Session { ws: WebSocket; nick?: string; lastMsg: number; burst: number }

export function startServer(opts: ServerOptions = {}) {
  const db = new Db(opts.dbPath ?? ":memory:");
  const lobby = new Lobby();
  const sessions = new Map<string, Session>(); // nick → sessão
  const tickMs = opts.tickMs ?? 100;
  const http = createServer((_, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("tankclone server"); });
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
  const pushRoom = (room: Room) => outbox.broadcast(room, { t: "room", room: room.info() });

  function afterEvents(room: Room) {
    if (room.over) {
      const res = room.finish(outbox);
      outbox.broadcast(room, { t: "end", winnerTeam: res.winnerTeam, xp: res.xp });
      pushRoom(room);
    }
  }

  const timer = setInterval(() => {
    const now = Date.now();
    for (const room of lobby.rooms.values()) {
      if (room.status !== "playing") continue;
      const events = room.tick(tickMs / 1000, now);
      if (events.length) { outbox.broadcast(room, { t: "events", events }); afterEvents(room); }
    }
    lobby.prune();
  }, tickMs);

  function onMessage(s: Session, raw: string) {
    // limite simples de taxa: ~30 mensagens/s com rajada de 60
    const now = Date.now();
    s.burst = Math.max(0, s.burst - (now - s.lastMsg) * 0.03) + 1; s.lastMsg = now;
    if (s.burst > 60) { send(s.ws, { t: "error", msg: "mensagens demais" }); return; }
    let m: ClientMsg;
    try { m = JSON.parse(raw) as ClientMsg; } catch { return send(s.ws, { t: "error", msg: "JSON inválido" }); }
    if (typeof m !== "object" || m === null || typeof m.t !== "string") return send(s.ws, { t: "error", msg: "mensagem inválida" });

    if (m.t === "auth") {
      if (s.nick) return send(s.ws, { t: "error", msg: "já autenticado" });
      const r = m.mode === "register" ? db.register(String(m.nick), String(m.password)) : db.login(String(m.nick), String(m.password));
      if (typeof r === "string") return send(s.ws, { t: "error", msg: r });
      const old = sessions.get(r.nick);
      if (old && old.ws !== s.ws) { send(old.ws, { t: "error", msg: "login em outro lugar" }); old.nick = undefined; old.ws.close(); }
      s.nick = r.nick; sessions.set(r.nick, s);
      send(s.ws, { t: "authOk", nick: r.nick, level: r.level, xp: r.xp, unlocks: unlocksAt(r.level) });
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
      case "createRoom": { const r = lobby.create(nick, String(m.mapId), Number(m.maxPlayers)); return typeof r === "string" ? err(r) : pushRoom(r); }
      case "joinRoom": { const r = lobby.join(nick, String(m.roomId), m.team); return typeof r === "string" ? err(r) : pushRoom(r); }
      case "leaveRoom": { const r = lobby.leave(nick, true); send(s.ws, { t: "room", room: null }); if (r && lobby.rooms.has(r.id)) pushRoom(r); return; }
      case "setLoadout": { const r = lobby.roomOf(nick); if (!r) return err("você não está em uma sala"); const e = r.setLoadout(nick, m.weaponId, m.build); return e ? err(e) : pushRoom(r); }
      case "start": {
        const r = lobby.roomOf(nick); if (!r) return err("você não está em uma sala");
        const res = r.start(nick, Date.now());
        if ("error" in res) return err(res.error);
        outbox.broadcast(r, { t: "start", setup: res.setup, events: res.events });
        return;
      }
      case "intent": {
        const r = lobby.roomOf(nick); if (!r) return err("você não está em uma sala");
        const res = r.intent(nick, m.intent, Date.now());
        if ("error" in res) return err(res.error);
        outbox.broadcast(r, { t: "events", events: res.events });
        afterEvents(r);
        return;
      }
      default: return err("mensagem desconhecida");
    }
  }

  wss.on("connection", ws => {
    if (wss.clients.size > (opts.maxConnections ?? 200)) { ws.close(1013); return; }
    const s: Session = { ws, lastMsg: Date.now(), burst: 0 };
    ws.on("message", d => onMessage(s, d.toString()));
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
        close: () => new Promise<void>(res => { clearInterval(timer); for (const c of wss.clients) c.terminate(); wss.close(() => http.close(() => { db.close(); res(); })); }),
      });
    });
  });
}
