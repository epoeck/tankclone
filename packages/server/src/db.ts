/** Contas, XP e nível em SQLite (node:sqlite, embutido no Node ≥ 22.5; sem serviço externo). */
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

export interface Account { nick: string; xp: number; level: number }

export class Db {
  private db: DatabaseSync;
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS accounts (
      nick TEXT PRIMARY KEY COLLATE NOCASE, salt BLOB NOT NULL, hash BLOB NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)`);
  }

  register(nick: string, password: string): Account | string {
    if (!/^[\p{L}\p{N}_-]{3,16}$/u.test(nick)) return "apelido inválido (3–16 letras, números, _ ou -)";
    if (password.length < 6 || password.length > 128) return "senha deve ter de 6 a 128 caracteres";
    const salt = randomBytes(16);
    try {
      this.db.prepare("INSERT INTO accounts (nick, salt, hash, created) VALUES (?, ?, ?, ?)").run(nick, salt, scryptSync(password, salt, 64), Date.now());
    } catch { return "apelido já existe"; }
    return { nick, xp: 0, level: 1 };
  }

  login(nick: string, password: string): Account | string {
    const row = this.db.prepare("SELECT nick, salt, hash, xp FROM accounts WHERE nick = ?").get(nick) as { nick: string; salt: Uint8Array; hash: Uint8Array; xp: number } | undefined;
    if (!row) return "apelido ou senha incorretos";
    const h = scryptSync(password, row.salt, 64);
    if (!timingSafeEqual(h, row.hash)) return "apelido ou senha incorretos";
    return { nick: row.nick, xp: row.xp, level: levelForXp(row.xp) };
  }

  addXp(nick: string, amount: number): Account | null {
    this.db.prepare("UPDATE accounts SET xp = xp + ? WHERE nick = ?").run(amount, nick);
    const row = this.db.prepare("SELECT nick, xp FROM accounts WHERE nick = ?").get(nick) as { nick: string; xp: number } | undefined;
    return row ? { nick: row.nick, xp: row.xp, level: levelForXp(row.xp) } : null;
  }

  /** Cópia consistente do banco (para backup agendado). */
  backupTo(file: string): void { this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); }
  close(): void { this.db.close(); }
}
