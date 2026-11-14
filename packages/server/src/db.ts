/** Contas, XP e nível em SQLite (node:sqlite, embutido no Node ≥ 22.5; sem serviço externo). */
import { DEFAULT_LOOK, accessoryByKind, sanitizeLook, type EquipPlace, type Look } from "@tankclone/core";
import { NEW_WEAPON, OLD_STONE_IDS, REQUIRED_KINDS, SUPER_STONE, WEAPONS, superStonesFromOld, type GearState, type ItemInstance, type ItemKind, type WeaponState } from "@tankclone/core";
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// createRequire: o vite/vitest não reconhece o builtin "node:sqlite" em import estático
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export const MAX_LEVEL = 30;
/** Sistemas liberados por nível (docs/decisoes.md item 14). */
export const UNLOCKS: Record<number, string> = { 10: "instancias", 18: "perolas", 25: "pets", 30: "cartas" };

/** XP acumulado para alcançar o nível L: 50·L·(L−1) (nível 2 = 100, nível 30 = 43 500). Placeholder. */
export const xpForLevel = (level: number) => 50 * level * (level - 1);
export function levelForXp(xp: number): number {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}
export const unlocksAt = (level: number): string[] => Object.entries(UNLOCKS).filter(([l]) => level >= +l).map(([, v]) => v);

export interface Account { nick: string; xp: number; level: number; look: Look }

const hashPw = (pw: string, salt: Uint8Array) => new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));

function parseLook(s: string | null): Look {
  try { return sanitizeLook(s ? JSON.parse(s) : null); } catch { return DEFAULT_LOOK; }
}

export class Db {
  private db: DatabaseSyncT;
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS accounts (
      nick TEXT PRIMARY KEY COLLATE NOCASE, salt BLOB NOT NULL, hash BLOB NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)`);
    const cols = this.db.prepare("PRAGMA table_info(accounts)").all() as Array<{ name: string }>;
    if (!cols.some(c => c.name === "look")) this.db.exec("ALTER TABLE accounts ADD COLUMN look TEXT"); // migração de bancos antigos
    if (!cols.some(c => c.name === "gold")) this.db.exec("ALTER TABLE accounts ADD COLUMN gold INTEGER NOT NULL DEFAULT 0");
    // mochila de recursos (pedras) e estado do ferreiro por arma
    this.db.exec(`CREATE TABLE IF NOT EXISTS inventory (nick TEXT NOT NULL COLLATE NOCASE, item TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (nick, item))`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS weapons (nick TEXT NOT NULL COLLATE NOCASE, weapon TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 0,
      exp INTEGER NOT NULL DEFAULT 0, atk INTEGER NOT NULL DEFAULT 0, def INTEGER NOT NULL DEFAULT 0, agi INTEGER NOT NULL DEFAULT 0,
      luck INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (nick, weapon))`);
    // mochila original: uma linha por item possuído (instância), com evolução e composição próprias
    this.db.exec(`CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, nick TEXT NOT NULL COLLATE NOCASE, kind TEXT NOT NULL,
      ref TEXT NOT NULL, sex TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 0, exp INTEGER NOT NULL DEFAULT 0, atk INTEGER NOT NULL DEFAULT 0,
      def INTEGER NOT NULL DEFAULT 0, agi INTEGER NOT NULL DEFAULT 0, luck INTEGER NOT NULL DEFAULT 0, place TEXT)`);
    this.db.exec("CREATE INDEX IF NOT EXISTS items_nick ON items (nick)");
    // pedras de fortalecer antigas (str1..str5) → Super Pedra pela EXP
    for (const r of this.db.prepare(`SELECT nick, item, count FROM inventory WHERE item IN (${OLD_STONE_IDS.map(() => "?").join(",")})`).all(...OLD_STONE_IDS) as Array<{ nick: string; item: string; count: number }>) {
      this.db.prepare("INSERT INTO inventory (nick, item, count) VALUES (?, ?, ?) ON CONFLICT (nick, item) DO UPDATE SET count = count + excluded.count").run(r.nick, SUPER_STONE, superStonesFromOld(r.item, r.count));
      this.db.prepare("DELETE FROM inventory WHERE nick = ? AND item = ?").run(r.nick, r.item);
    }
  }

  /** scrypt assíncrono: não bloqueia o laço de eventos (~60 ms de CPU fora da thread principal). */
  async register(nick: string, password: string): Promise<Account | string> {
    if (!/^[\p{L}\p{N}_-]{3,16}$/u.test(nick)) return "apelido inválido (3–16 letras, números, _ ou -)";
    if (password.length < 6 || password.length > 128) return "senha deve ter de 6 a 128 caracteres";
    const salt = randomBytes(16);
    try {
      this.db.prepare("INSERT INTO accounts (nick, salt, hash, created) VALUES (?, ?, ?, ?)").run(nick, salt, await hashPw(password, salt), Date.now());
    } catch { return "apelido já existe"; }
    return { nick, xp: 0, level: 1, look: DEFAULT_LOOK };
  }

  async login(nick: string, password: string): Promise<Account | string> {
    const row = this.db.prepare("SELECT nick, salt, hash, xp, look FROM accounts WHERE nick = ?").get(nick) as { nick: string; salt: Uint8Array; hash: Uint8Array; xp: number; look: string | null } | undefined;
    if (!row) return "apelido ou senha incorretos";
    const h = await hashPw(password, row.salt);
    if (!timingSafeEqual(h, row.hash)) return "apelido ou senha incorretos";
    return { nick: row.nick, xp: row.xp, level: levelForXp(row.xp), look: parseLook(row.look) };
  }

  addXp(nick: string, amount: number): Account | null {
    this.db.prepare("UPDATE accounts SET xp = xp + ? WHERE nick = ?").run(amount, nick);
    const row = this.db.prepare("SELECT nick, xp, look FROM accounts WHERE nick = ?").get(nick) as { nick: string; xp: number; look: string | null } | undefined;
    return row ? { nick: row.nick, xp: row.xp, level: levelForXp(row.xp), look: parseLook(row.look) } : null;
  }

  addGold(nick: string, amount: number): number {
    this.db.prepare("UPDATE accounts SET gold = gold + ? WHERE nick = ?").run(amount, nick);
    return this.getGold(nick);
  }
  getGold(nick: string): number { return (this.db.prepare("SELECT gold FROM accounts WHERE nick = ?").get(nick) as { gold: number } | undefined)?.gold ?? 0; }

  inventory(nick: string): Record<string, number> {
    const rows = this.db.prepare("SELECT item, count FROM inventory WHERE nick = ? AND count > 0").all(nick) as Array<{ item: string; count: number }>;
    return Object.fromEntries(rows.map(r => [r.item, r.count]));
  }
  /** Compra garantida: debita gold e soma os itens numa transação; devolve erro se faltar gold. */
  buy(nick: string, item: string, count: number, unitPrice: number): string | null {
    const cost = count * unitPrice;
    this.db.exec("BEGIN");
    try {
      const r = this.db.prepare("UPDATE accounts SET gold = gold - ? WHERE nick = ? AND gold >= ?").run(cost, nick, cost);
      if (Number(r.changes) !== 1) { this.db.exec("ROLLBACK"); return "gold insuficiente"; }
      this.db.prepare("INSERT INTO inventory (nick, item, count) VALUES (?, ?, ?) ON CONFLICT (nick, item) DO UPDATE SET count = count + excluded.count").run(nick, item, count);
      this.db.exec("COMMIT"); return null;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  weapon(nick: string, weapon: string): WeaponState {
    const r = this.db.prepare("SELECT level, exp, atk, def, agi, luck FROM weapons WHERE nick = ? AND weapon = ?").get(nick, weapon) as { level: number; exp: number; atk: number; def: number; agi: number; luck: number } | undefined;
    return r ? { level: r.level, exp: r.exp, compose: { atk: r.atk, def: r.def, agi: r.agi, luck: r.luck } } : { ...NEW_WEAPON, compose: { ...NEW_WEAPON.compose } };
  }
  /** Gasta `used` unidades do item e grava a arma, juntos (falha inteira se faltar item). */
  spendAndSetWeapon(nick: string, item: string, used: number, weapon: string, w: WeaponState): string | null {
    this.db.exec("BEGIN");
    try {
      const r = this.db.prepare("UPDATE inventory SET count = count - ? WHERE nick = ? AND item = ? AND count >= ?").run(used, nick, item, used);
      if (Number(r.changes) !== 1) { this.db.exec("ROLLBACK"); return "recursos insuficientes"; }
      this.db.prepare(`INSERT INTO weapons (nick, weapon, level, exp, atk, def, agi, luck) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (nick, weapon) DO UPDATE SET level = excluded.level, exp = excluded.exp, atk = excluded.atk, def = excluded.def, agi = excluded.agi, luck = excluded.luck`)
        .run(nick, weapon, w.level, w.exp, w.compose.atk, w.compose.def, w.compose.agi, w.compose.luck);
      this.db.exec("COMMIT"); return null;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  // ---------- mochila de itens (instâncias) ----------
  items(nick: string): ItemInstance[] {
    return (this.db.prepare("SELECT id, kind, ref, sex, level, exp, atk, def, agi, luck, place FROM items WHERE nick = ? ORDER BY id").all(nick) as Array<Record<string, unknown>>)
      .map(r => ({ id: Number(r.id), kind: r.kind as ItemKind, ref: String(r.ref), sex: r.sex as "m" | "f" | "", level: Number(r.level), exp: Number(r.exp),
        compose: { atk: Number(r.atk), def: Number(r.def), agi: Number(r.agi), luck: Number(r.luck) }, place: (r.place as EquipPlace | null) ?? null }));
  }
  item(nick: string, id: number): ItemInstance | undefined { return this.items(nick).find(i => i.id === id); }
  private insertItem(nick: string, kind: ItemKind, ref: string, sex: string, place: EquipPlace | null, g: GearState = NEW_WEAPON): number {
    const r = this.db.prepare("INSERT INTO items (nick, kind, ref, sex, level, exp, atk, def, agi, luck, place) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(nick, kind, ref, sex, g.level, g.exp, g.compose.atk, g.compose.def, g.compose.agi, g.compose.luck, place);
    return Number(r.lastInsertRowid);
  }
  /** Primeira vez da conta: 1 instância de cada peça do Look atual e das 3 armas (levando a evolução da tabela `weapons`), tudo equipado. */
  ensureStarter(nick: string): void {
    if ((this.db.prepare("SELECT COUNT(*) AS n FROM items WHERE nick = ?").get(nick) as { n: number }).n > 0) return;
    const look = this.getLook(nick), sex = look.appearance.sex, e = look.equipped;
    this.db.exec("BEGIN");
    try {
      this.insertItem(nick, "face", String(look.appearance.face), sex, "face");
      this.insertItem(nick, "hair", String(look.appearance.hair), sex, "hair");
      this.insertItem(nick, "cloth", String(e.outfit), sex, "cloth");
      if (e.hat) this.insertItem(nick, "head", String(e.hat), sex, "head");
      if (e.glasses) this.insertItem(nick, "glass", String(e.glasses), sex, "glass");
      if (e.wings) this.insertItem(nick, "wing", String(e.wings), "", "wing");
      for (const w of Object.keys(WEAPONS)) this.insertItem(nick, "weapon", w, "", w === "sledge" ? "weapon" : null, this.weapon(nick, w));
      this.db.exec("COMMIT");
    } catch (err) { this.db.exec("ROLLBACK"); throw err; }
  }
  /** Tira o que é de outro sexo e garante rosto, cabelo e roupa equipados (padrão grátis, ref 0, criado se faltar). */
  normalizeEquipped(nick: string, sex: "m" | "f"): void {
    this.db.exec("BEGIN");
    try {
      for (const i of this.items(nick)) if (i.place && i.sex && i.sex !== sex) this.db.prepare("UPDATE items SET place = NULL WHERE id = ?").run(i.id);
      for (const kind of REQUIRED_KINDS) {
        const now = this.items(nick);
        if (now.some(i => i.kind === kind && i.place)) continue;
        const sexed = kind !== "weapon" ? sex : "";
        const spare = now.find(i => i.kind === kind && i.sex === sexed && i.ref === (kind === "weapon" ? "sledge" : "0")) ?? now.find(i => i.kind === kind && (i.sex === sexed));
        if (spare) this.db.prepare("UPDATE items SET place = ? WHERE id = ?").run(kind, spare.id);
        else this.insertItem(nick, kind, kind === "weapon" ? "sledge" : "0", sexed, kind as EquipPlace);
      }
      this.db.exec("COMMIT");
    } catch (err) { this.db.exec("ROLLBACK"); throw err; }
  }
  /** Compra de peça: debita gold e cria a instância na mochila (garantido). */
  buyPiece(nick: string, kind: ItemKind, ref: string, sex: string, price: number): string | null {
    this.db.exec("BEGIN");
    try {
      const r = this.db.prepare("UPDATE accounts SET gold = gold - ? WHERE nick = ? AND gold >= ?").run(price, nick, price);
      if (Number(r.changes) !== 1) { this.db.exec("ROLLBACK"); return "gold insuficiente"; }
      this.insertItem(nick, kind, ref, sex, null);
      this.db.exec("COMMIT"); return null;
    } catch (err) { this.db.exec("ROLLBACK"); throw err; }
  }
  buyAccessory(nick: string, ref: string, price: number): string | null {
    const a = accessoryByKind("armlet").concat(accessoryByKind("ring")).find(x => x.ref === ref);
    if (!a || !["8015", "9024"].includes(ref)) return "acessório indisponível";
    this.db.exec("BEGIN");
    try {
      const r = this.db.prepare("UPDATE accounts SET gold = gold - ? WHERE nick = ? AND gold >= ?").run(price, nick, price);
      if (Number(r.changes) !== 1) { this.db.exec("ROLLBACK"); return "gold insuficiente"; }
      this.insertItem(nick, a.kind, ref, "", null);
      this.db.exec("COMMIT"); return null;
    } catch (err) { this.db.exec("ROLLBACK"); throw err; }
  }
  /** Fusão garantida: consome quatro instâncias do mesmo tier e cria o tier CN seguinte. */
  fuseAccessories(nick: string, ids: number[]): string | null {
    if (ids.length !== 4 || new Set(ids).size !== 4) return "selecione quatro acessórios diferentes";
    const rows = ids.map(id => this.item(nick, id));
    if (rows.some(i => !i)) return "acessório não encontrado";
    const selected = rows as ItemInstance[], first = selected[0]!, def = accessoryByKind(first.kind).find(a => a.ref === first.ref);
    if (!def?.next || selected.some(i => i.kind !== first.kind || i.ref !== first.ref || !!i.place)) return "a fusão exige quatro acessórios iguais sem equipar";
    const next = def.next, nextDef = accessoryByKind(first.kind).find(a => a.ref === next)!;
    this.db.exec("BEGIN");
    try {
      const del = this.db.prepare(`DELETE FROM items WHERE nick = ? AND id IN (${ids.map(() => "?").join(",")}) AND place IS NULL`).run(nick, ...ids);
      if (Number(del.changes) !== 4) { this.db.exec("ROLLBACK"); return "os acessórios mudaram; tente novamente"; }
      this.insertItem(nick, first.kind, next, "", null);
      this.db.exec("COMMIT"); return null;
    } catch (err) { this.db.exec("ROLLBACK"); throw err; }
  }
  /** Equipa o item; o que estava no lugar volta para a mochila (troca). */
  equipItem(nick: string, id: number, requestedPlace?: EquipPlace): string | null {
    const it = this.item(nick, id); if (!it) return "item não encontrado";
    this.db.exec("BEGIN");
    try {
      const before = this.items(nick);
      const valid: EquipPlace[] = it.kind === "armlet" ? ["armlet1", "armlet2"] : it.kind === "ring" ? ["ring1", "ring2"] : [it.kind as EquipPlace];
      let place = requestedPlace;
      if (place && !valid.includes(place)) { this.db.exec("ROLLBACK"); return "espaço incompatível com o item"; }
      if (it.place) {
        if (!place || place === it.place) { this.db.exec("COMMIT"); return null; }
        const occupant = before.find(i => i.place === place && i.id !== id);
        if (occupant) this.db.prepare("UPDATE items SET place = ? WHERE id = ? AND nick = ?").run(it.place, occupant.id, nick);
        this.db.prepare("UPDATE items SET place = ? WHERE id = ? AND nick = ?").run(place, id, nick);
        this.db.exec("COMMIT"); return null;
      }
      const target = place ?? valid.find(p => !before.some(i => i.place === p)) ?? valid[0]!;
      this.db.prepare("UPDATE items SET place = NULL WHERE nick = ? AND place = ?").run(nick, target);
      this.db.prepare("UPDATE items SET place = ? WHERE id = ? AND nick = ?").run(target, id, nick);
      this.db.exec("COMMIT"); return null;
    } catch (err) { this.db.exec("ROLLBACK"); throw err; }
  }
  unequipPlace(nick: string, kind: EquipPlace): void { this.db.prepare("UPDATE items SET place = NULL WHERE nick = ? AND place = ?").run(nick, kind); }
  /** Gasta `used` do material e grava o novo estado do item, juntos. */
  spendAndSetItem(nick: string, material: string, used: number, id: number, g: GearState): string | null {
    this.db.exec("BEGIN");
    try {
      const r = this.db.prepare("UPDATE inventory SET count = count - ? WHERE nick = ? AND item = ? AND count >= ?").run(used, nick, material, used);
      if (Number(r.changes) !== 1) { this.db.exec("ROLLBACK"); return "recursos insuficientes"; }
      const u = this.db.prepare("UPDATE items SET level = ?, exp = ?, atk = ?, def = ?, agi = ?, luck = ? WHERE id = ? AND nick = ?")
        .run(g.level, g.exp, g.compose.atk, g.compose.def, g.compose.agi, g.compose.luck, id, nick);
      if (Number(u.changes) !== 1) { this.db.exec("ROLLBACK"); return "item não encontrado"; }
      this.db.exec("COMMIT"); return null;
    } catch (err) { this.db.exec("ROLLBACK"); throw err; }
  }

  getXp(nick: string): number { return (this.db.prepare("SELECT xp FROM accounts WHERE nick = ?").get(nick) as { xp: number } | undefined)?.xp ?? 0; }
  getLevel(nick: string): number { return levelForXp(this.getXp(nick)); }

  setLook(nick: string, raw: unknown): Look {
    const look = sanitizeLook(raw);
    this.db.prepare("UPDATE accounts SET look = ? WHERE nick = ?").run(JSON.stringify(look), nick);
    return look;
  }

  getLook(nick: string): Look {
    const row = this.db.prepare("SELECT look FROM accounts WHERE nick = ?").get(nick) as { look: string | null } | undefined;
    return parseLook(row?.look ?? null);
  }

  /** Cópia consistente do banco (para backup agendado). */
  backupTo(file: string): void { this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); }
  close(): void { this.db.close(); }
}
