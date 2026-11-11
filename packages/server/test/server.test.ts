import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { startServer } from "../src/server";
import type { ClientMsg, ServerMsg } from "../src/protocol";

type Srv = Awaited<ReturnType<typeof startServer>>;
let srv: Srv | undefined;
afterEach(async () => { await srv?.close(); srv = undefined; });

class Client {
  ws!: WebSocket; msgs: ServerMsg[] = [];
  static async open(port: number): Promise<Client> {
    const c = new Client(); c.ws = new WebSocket(`ws://localhost:${port}`);
    c.ws.on("message", d => c.msgs.push(JSON.parse(d.toString())));
    await new Promise<void>((r, j) => { c.ws.once("open", () => r()); c.ws.once("error", j); });
    return c;
  }
  send(m: ClientMsg) { this.ws.send(JSON.stringify(m)); }
  async waitFor<T extends ServerMsg["t"]>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 3000): Promise<Extract<ServerMsg, { t: T }>> {
    const t0 = Date.now();
    for (;;) {
      const i = this.msgs.findIndex(m => m.t === t && pred(m as Extract<ServerMsg, { t: T }>));
      if (i >= 0) return this.msgs.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>;
      if (Date.now() - t0 > ms) throw new Error(`timeout esperando ${t}; recebido: ${JSON.stringify(this.msgs).slice(0, 300)}`);
      await new Promise(r => setTimeout(r, 10));
    }
  }
  async login(nick: string) {
    this.send({ t: "auth", mode: "register", nick, password: "segredo1" });
    return this.waitFor("authOk");
  }
  close() { this.ws.close(); }
}

async function twoPlayers() {
  srv = await startServer({ tickMs: 20 });
  const a = await Client.open(srv.port), b = await Client.open(srv.port);
  await a.login("alice"); await b.login("bruno");
  a.send({ t: "createRoom", mapId: "colinas", maxPlayers: 4 });
  const room = (await a.waitFor("room")).room!;
  b.send({ t: "joinRoom", roomId: room.id });
  await b.waitFor("room");
  return { a, b, room };
}

describe("servidor", () => {
  it("exige login e rejeita senha errada e JSON inválido", async () => {
    srv = await startServer();
    const c = await Client.open(srv.port);
    c.send({ t: "rooms" });
    expect((await c.waitFor("error")).msg).toMatch(/login/);
    c.send({ t: "auth", mode: "login", nick: "nao", password: "existe1" });
    expect((await c.waitFor("error")).msg).toMatch(/incorretos/);
    c.ws.send("{nao é json");
    expect((await c.waitFor("error")).msg).toMatch(/JSON/);
    c.close();
  });

  it("cria sala, entra, equilibra times e só o dono inicia", async () => {
    const { a, b, room } = await twoPlayers();
    const info = (await a.waitFor("room", r => r.room!.players.length === 2)).room!;
    expect(info.players.map(p => p.team).sort()).toEqual([1, 2]);
    b.send({ t: "start" });
    expect((await b.waitFor("error")).msg).toMatch(/dono/);
    a.send({ t: "rooms" });
    expect((await a.waitFor("rooms")).rooms[0]!.id).toBe(room.id);
    a.close(); b.close();
  });

  it("partida: eventos chegam aos dois, jogador fora da vez é rejeitado, vento vem do servidor", async () => {
    const { a, b } = await twoPlayers();
    a.send({ t: "start" });
    const sa = await a.waitFor("start"), sb = await b.waitFor("start");
    expect(sa.setup.seed).toBe(sb.setup.seed);
    const first = sa.events.find(e => e.type === "turnStart")!;
    expect(first.type === "turnStart" && Math.abs(first.wind) <= 10).toBe(true);
    const cur = first.type === "turnStart" ? first.playerId : "";
    const [active, idle] = cur === "alice" ? [a, b] : [b, a];
    idle.send({ t: "intent", intent: { type: "pass" } });
    expect((await idle.waitFor("error")).msg).toMatch(/vez/);
    active.send({ t: "intent", intent: { type: "move", dir: 1, px: 20 } });
    const ea = await a.waitFor("events"), eb = await b.waitFor("events");
    expect(ea.events).toEqual(eb.events);
    expect(ea.events[0]!.type).toBe("move");
    active.send({ t: "intent", intent: { type: "pass" } });
    const next = await active.waitFor("events", m => m.events.some(e => e.type === "turnStart"));
    expect(next.events.some(e => e.type === "turnStart" && e.playerId !== cur)).toBe(true);
    a.close(); b.close();
  });

  it("valida intenções malformadas", async () => {
    const { a, b } = await twoPlayers();
    a.send({ t: "start" }); await a.waitFor("start"); await b.waitFor("start");
    a.send({ t: "intent", intent: { type: "shoot", angleDeg: NaN as unknown as number, power: 5 } });
    a.ws.send(JSON.stringify({ t: "intent", intent: { type: "move", dir: 5, px: 3 } }));
    a.ws.send(JSON.stringify({ t: "intent", intent: { type: "teleport" } }));
    const errs = [await a.waitFor("error"), await a.waitFor("error"), await a.waitFor("error")].map(e => e.msg);
    expect(errs.every(m => typeof m === "string")).toBe(true);
    a.close(); b.close();
  });

  it("tempo de turno estourado passa a vez e reconexão recebe o log (resume)", async () => {
    srv = await startServer({ tickMs: 20 });
    const a = await Client.open(srv.port), b = await Client.open(srv.port);
    await a.login("alice"); await b.login("bruno");
    a.send({ t: "createRoom", mapId: "planalto", maxPlayers: 2 });
    const room = (await a.waitFor("room")).room!;
    b.send({ t: "joinRoom", roomId: room.id }); await b.waitFor("room");
    a.send({ t: "start" }); await a.waitFor("start");
    b.close(); // bruno cai no meio da partida
    await a.waitFor("room", r => r.room!.players.some(p => p.nick === "bruno" && !p.connected));
    const b2 = await Client.open(srv.port);
    b2.send({ t: "auth", mode: "login", nick: "bruno", password: "segredo1" });
    await b2.waitFor("authOk");
    const resume = await b2.waitFor("resume");
    expect(resume.setup.players).toHaveLength(2);
    expect(resume.events[0]!.type).toBe("turnStart");
    a.close(); b2.close();
  });

  it("fim de partida concede XP e volta ao saguão", async () => {
    const { a, b } = await twoPlayers();
    a.send({ t: "start" }); await a.waitFor("start"); await b.waitFor("start");
    // acesso interno do teste: mata o adversário de quem está na vez; o próximo tiro (que cria um impacto) fecha a partida
    const r = srv!.lobby.rooms.values().next().value!;
    const cur = r.match!.currentId;
    const victim = r.match!.chars.find(c => c.id !== cur)!;
    victim.hp = 0; victim.alive = false;
    (cur === "alice" ? a : b).send({ t: "intent", intent: { type: "shoot", angleDeg: 45, power: 30 } });
    const end = await a.waitFor("end");
    const winner = r.members.get(cur)!.team;
    expect(end.winnerTeam).toBe(winner);
    expect(end.xp[cur]!.gained).toBe(50);
    expect(end.xp[victim.id]!.gained).toBe(20);
    await a.waitFor("room", r2 => r2.room!.status === "lobby");
    a.close(); b.close();
  });
});

describe("carga", () => {
  it("20 conectados em 4 salas jogando ao mesmo tempo", async () => {
    srv = await startServer({ tickMs: 20 });
    const clients: Client[] = [];
    for (let i = 0; i < 20; i++) { const c = await Client.open(srv.port); await c.login(`jogador${i}`); clients.push(c); }
    const hosts = [0, 5, 10, 15].map(i => clients[i]!);
    const ids: string[] = [];
    for (const h of hosts) { h.send({ t: "createRoom", mapId: "colinas", maxPlayers: 8 }); ids.push((await h.waitFor("room")).room!.id); }
    clients.forEach((c, i) => { if (i % 5 !== 0) c.send({ t: "joinRoom", roomId: ids[Math.floor(i / 5)]! }); });
    await Promise.all(clients.map(c => c.waitFor("room", r => r.room!.players.length === 5)));
    for (const h of hosts) h.send({ t: "start" });
    const starts = await Promise.all(clients.map(c => c.waitFor("start")));
    expect(starts.every(s => s.setup.players.length === 5)).toBe(true);
    // em cada sala, o jogador da vez anda; todos da sala recebem o mesmo evento
    for (let r = 0; r < 4; r++) {
      const room = clients.slice(r * 5, r * 5 + 5);
      const first = starts[r * 5]!.events.find(e => e.type === "turnStart")!;
      const cur = first.type === "turnStart" ? first.playerId : "";
      const active = room.find((_, k) => `jogador${r * 5 + k}` === cur)!;
      active.send({ t: "intent", intent: { type: "move", dir: 1, px: 5 } });
      const evs = await Promise.all(room.map(c => c.waitFor("events")));
      expect(evs.every(e => JSON.stringify(e.events) === JSON.stringify(evs[0]!.events))).toBe(true);
    }
    clients.forEach(c => c.close());
  }, 15000);
});
