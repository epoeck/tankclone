/** Contas, XP e nível em SQLite (node:sqlite, embutido no Node ≥ 22.5; sem serviço externo). */
import { DEFAULT_LOOK, sanitizeLook, type Look } from "@tankclone/core";
import { NEW_WEAPON, type WeaponState } from "@tankclone/core";
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
