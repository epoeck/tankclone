import { describe, expect, it, afterEach } from "vitest";
import WebSocket from "ws";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NEW_WEAPON, SUPER_STONE, strengthenArmor, strengthenWith } from "@tankclone/core";
import { Db } from "../src/db";
import { deriveLook, gearOf } from "../src/bag";
import { equippedStats } from "../src/rooms";
import { startServer } from "../src/server";
import type { ClientMsg, ServerMsg } from "../src/protocol";

const LOOK = { appearance: { sex: "m" as const, skin: 0, face: 0, hair: 0, hairColor: 0 }, equipped: { outfit: 0, hat: 0, glasses: 0, wings: 0 } };

describe("loja e mochila no banco", () => {
  it("compra debita gold e soma Super Pedras; gastar e gravar o item é atômico", async () => {
    const db = new Db(":memory:");
    expect(typeof await db.register("ferreiro", "segredo1")).toBe("object");
    db.ensureStarter("ferreiro");
    expect(db.buy("ferreiro", SUPER_STONE, 3, 1)).toBe("gold insuficiente");
    db.addGold("ferreiro", 5);
    expect(db.buy("ferreiro", SUPER_STONE, 3, 1)).toBeNull();
    expect(db.getGold("ferreiro")).toBe(2);
    expect(db.inventory("ferreiro")).toEqual({ super: 3 });
    const sledge = db.items("ferreiro").find(i => i.kind === "weapon" && i.ref === "sledge")!;
    const { weapon, used } = strengthenWith(sledge, 10, 3);
    expect(db.spendAndSetItem("ferreiro", SUPER_STONE, used, sledge.id, weapon)).toBeNull();
    expect(db.item("ferreiro", sledge.id)).toMatchObject({ level: 1, exp: 20 });
    expect(db.inventory("ferreiro")).toEqual({});
    expect(db.spendAndSetItem("ferreiro", SUPER_STONE, 1, sledge.id, NEW_WEAPON)).toBe("recursos insuficientes");
    expect(db.item("ferreiro", sledge.id)!.level).toBe(1); // nada mudou
    db.close();
  });
  it("conta nova: rosto, cabelo, roupa e as 3 armas; sledge equipada; migra pedras antigas e a tabela de armas", async () => {
    const db = new Db(":memory:");
    await db.register("novo", "segredo1");
    db.ensureStarter("novo"); db.ensureStarter("novo"); // idempotente
    const it = db.items("novo");
    expect(it.filter(i => i.kind === "weapon").map(i => i.ref).sort()).toEqual(["furnace", "prism", "sledge"]);
    expect(it.filter(i => i.place).map(i => i.kind).sort()).toEqual(["cloth", "face", "hair", "weapon"]);
    expect(gearOf(it).weaponId).toBe("sledge");
    db.close();
  });
  it("equipar troca de lugar; sexo oposto some do equipado e ganha padrão", async () => {
    const db = new Db(":memory:");
    await db.register("troca", "segredo1"); db.ensureStarter("troca");
    db.addGold("troca", 5);
    expect(db.buyPiece("troca", "head", "1", "m", 1)).toBeNull();
    const hat = db.items("troca").find(i => i.kind === "head")!;
    expect(hat.place).toBeNull();
    db.equipItem("troca", hat.id);
    expect(deriveLook(LOOK, db.items("troca")).equipped.hat).toBe(1);
    db.unequipPlace("troca", "head");
    expect(deriveLook(LOOK, db.items("troca")).equipped.hat).toBe(0);
    db.equipItem("troca", hat.id); db.normalizeEquipped("troca", "f");
    const worn = db.items("troca").filter(i => i.place);
    expect(worn.every(i => !i.sex || i.sex === "f")).toBe(true);
    expect(worn.map(i => i.kind).sort()).toEqual(["cloth", "face", "hair", "weapon"]);
    db.close();
  });
  it("atributos de composição e armadura do fortalecimento entram nos stats da partida", () => {
    const base = equippedStats("media", LOOK);
    const comp = equippedStats("media", LOOK, { atk: 51, def: 0, agi: 10, luck: 0 }, strengthenArmor(12));
    expect(comp.atk - base.atk).toBe(51); expect(comp.agi - base.agi).toBe(10);
    expect(comp.armor - base.armor).toBe(Math.round(60 * 1.1 ** 12) - 60);
  });
});

type Srv = Awaited<ReturnType<typeof startServer>>;
let srv: Srv | undefined;
afterEach(async () => { await srv?.close(); srv = undefined; });
async function login(nick: string) {
  srv = await startServer({ tickMs: 20, limits: { registerPerHour: 1000, loginFailures: 1000 }, log: () => {} });
  const ws = new WebSocket(`ws://localhost:${srv.port}`), msgs: ServerMsg[] = [];
  ws.on("message", d => msgs.push(JSON.parse(d.toString())));
  await new Promise<void>(r => ws.once("open", () => r()));
  const send = (m: ClientMsg) => ws.send(JSON.stringify(m));
  const next = async <T extends ServerMsg["t"]>(t: T) => { for (let i = 0; i < 300; i++) { const k = msgs.findIndex(m => m.t === t); if (k >= 0) return msgs.splice(k, 1)[0] as Extract<ServerMsg, { t: T }>; await new Promise(r => setTimeout(r, 10)); } throw new Error(`timeout ${t}: ${JSON.stringify(msgs).slice(0, 200)}`); };
  send({ t: "auth", mode: "register", nick, password: "segredo1" }); await next("authOk");
  return { send, next, msgs, ws };
}

describe("migração de conta antiga", () => {
  it("pedras de fortalecer antigas viram Super Pedras; armas da tabela antiga levam nível e composição para a mochila", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "bag-")), "t.sqlite");
    const old = new Db(file); await old.register("veterano", "segredo1");
    old.addGold("veterano", 100);
    old.buy("veterano", "str3", 2, 1); old.buy("veterano", "str5", 1, 1); // 2×2 + 22
    old.spendAndSetWeapon("veterano", "str3", 0, "furnace", { level: 7, exp: 5, compose: { atk: 40, def: 0, agi: 0, luck: 0 } });
    old.close();
    const db = new Db(file);
    expect(db.inventory("veterano")).toEqual({ super: 26 });
    db.ensureStarter("veterano");
    expect(db.items("veterano").find(i => i.kind === "weapon" && i.ref === "furnace")).toMatchObject({ level: 7, exp: 5, compose: { atk: 40 } });
    db.close();
  });
});

describe("mochila pelo protocolo", () => {
  it("compra peça, equipa, fortalece chapéu/roupa/arma, não fortalece óculos/asa, compõe óculos", async () => {
    const c = await login("dono");
    srv!.db.addGold("dono", 100);
    c.send({ t: "bag" }); let bag = await c.next("bag");
    expect(bag.items.filter(i => i.kind === "weapon")).toHaveLength(3);
    c.send({ t: "buy", catalogKind: "head", ref: "1" }); bag = await c.next("bag");
    c.send({ t: "buy", catalogKind: "glass", ref: "1" }); bag = await c.next("bag");
    c.send({ t: "buy", catalogKind: "wing", ref: "1" }); bag = await c.next("bag");
    const hat = bag.items.find(i => i.kind === "head")!, glass = bag.items.find(i => i.kind === "glass")!, wing = bag.items.find(i => i.kind === "wing")!;
    c.send({ t: "equip", itemId: hat.id }); expect((await c.next("authOk")).look.equipped.hat).toBe(1); await c.next("bag");
    c.send({ t: "buy", item: SUPER_STONE, count: 20 }); await c.next("bag");
    c.send({ t: "strengthen", itemId: glass.id, count: 1 }); expect((await c.next("error")).msg).toMatch(/fortalecido/);
    c.send({ t: "strengthen", itemId: wing.id, count: 1 }); expect((await c.next("error")).msg).toMatch(/fortalecido/);
    c.send({ t: "strengthen", itemId: hat.id, count: 5 }); await c.next("authOk"); bag = await c.next("bag");
    expect(bag.items.find(i => i.id === hat.id)).toMatchObject({ level: 1, exp: 40 }); // 5 pedras × 10 EXP = 50: +1 custa 10, sobram 40
    c.send({ t: "buy", item: "atk3", count: 1 }); await c.next("bag");
    c.send({ t: "compose", itemId: wing.id, stone: "atk3" }); expect((await c.next("error")).msg).toMatch(/composição/);
    c.send({ t: "compose", itemId: glass.id, stone: "atk3" }); bag = await c.next("bag");
    expect(bag.items.find(i => i.id === glass.id)!.compose.atk).toBe(30);
    c.send({ t: "unequip", place: "weapon" }); expect((await c.next("error")).msg).toMatch(/troque/);
    c.send({ t: "equip", itemId: 99999 }); expect((await c.next("error")).msg).toMatch(/não encontrado/);
    c.ws.close();
  });
  it("a partida leva a arma vestida (+N), a composição somada e a armadura do chapéu/roupa fortalecidos", async () => {
    const c = await login("lutador");
    srv!.db.addGold("lutador", 100);
    c.send({ t: "buy", item: SUPER_STONE, count: 60 }); await c.next("bag");
    c.send({ t: "buy", item: "atk5", count: 1 }); await c.next("bag");
    c.send({ t: "bag" }); let bag = await c.next("bag");
    const prism = bag.items.find(i => i.kind === "weapon" && i.ref === "prism")!, cloth = bag.items.find(i => i.kind === "cloth")!;
    c.send({ t: "equip", itemId: prism.id }); await c.next("authOk"); await c.next("bag");
    c.send({ t: "strengthen", itemId: prism.id, count: 1 }); await c.next("authOk"); await c.next("bag");
    c.send({ t: "strengthen", itemId: cloth.id, count: 1 }); await c.next("authOk"); await c.next("bag");
    c.send({ t: "compose", itemId: prism.id, stone: "atk5" }); bag = await c.next("bag");
    c.send({ t: "createRoom", mapId: "colinas", maxPlayers: 4 });
    expect((await c.next("room")).room!.players[0]!.weaponId).toBe("prism");
    c.send({ t: "addBot" }); await c.next("room");
    c.send({ t: "start" });
    const st = await c.next("start"), me = st.setup.players.find(p => p.id === "lutador")!;
    expect(me).toMatchObject({ weaponId: "prism", weaponLevel: 1, armorBonus: strengthenArmor(1) });
    expect(me.compose!.atk).toBe(51);
    c.ws.close();
  });
});
