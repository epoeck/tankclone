/** Contas, XP e nível em SQLite (node:sqlite, embutido no Node ≥ 22.5; sem serviço externo). */
import { DEFAULT_LOOK, sanitizeLook, type Look } from "@tankclone/core";
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
