/** Limites de tentativas de login/cadastro (anti força bruta). Relógio injetável para teste. */

export interface LimitConfig {
  /** Falhas de login permitidas na janela, por chave (IP e apelido). */
  loginFailures: number;
  loginWindowMs: number;
  /** Espera inicial após estourar; dobra a cada nova tentativa bloqueada, até `maxBlockMs`. */
  baseBlockMs: number;
  maxBlockMs: number;
  /** Cadastros por IP por hora. */
  registerPerHour: number;
}

export const DEFAULT_LIMITS: LimitConfig = {
  loginFailures: 5, loginWindowMs: 10 * 60_000, baseBlockMs: 60_000, maxBlockMs: 60 * 60_000, registerPerHour: 3,
};

interface Entry { fails: number[]; blockedUntil: number; strikes: number }

export class AuthLimiter {
  private map = new Map<string, Entry>();
  private regs = new Map<string, number[]>();
  constructor(private cfg: LimitConfig = DEFAULT_LIMITS, private now: () => number = Date.now) {}

  /** Segundos de espera se a chave está bloqueada; 0 se livre. */
  blockedFor(key: string): number {
    const e = this.map.get(key);
    if (!e || e.blockedUntil <= this.now()) return 0;
    e.strikes++; // insistir durante o bloqueio aumenta a espera da próxima vez
    return Math.ceil((e.blockedUntil - this.now()) / 1000);
  }

  fail(key: string): void {
    const t = this.now();
    const e = this.map.get(key) ?? { fails: [], blockedUntil: 0, strikes: 0 };
    e.fails = e.fails.filter(x => t - x < this.cfg.loginWindowMs); e.fails.push(t);
    if (e.fails.length >= this.cfg.loginFailures) {
      e.blockedUntil = t + Math.min(this.cfg.maxBlockMs, this.cfg.baseBlockMs * 2 ** e.strikes);
      e.strikes++; e.fails = [];
    }
    this.map.set(key, e);
  }

  success(key: string): void { this.map.delete(key); }

  /** Registra um cadastro; false se o IP estourou o limite por hora. */
  allowRegister(ip: string): boolean {
    const t = this.now();
    const list = (this.regs.get(ip) ?? []).filter(x => t - x < 3_600_000);
    if (list.length >= this.cfg.registerPerHour) { this.regs.set(ip, list); return false; }
    list.push(t); this.regs.set(ip, list);
    return true;
  }

  /** Limpa entradas velhas (chamar de vez em quando). */
  prune(): void {
    const t = this.now();
    for (const [k, e] of this.map) if (e.blockedUntil < t && e.fails.every(x => t - x >= this.cfg.loginWindowMs)) this.map.delete(k);
    for (const [k, l] of this.regs) if (l.every(x => t - x >= 3_600_000)) this.regs.delete(k);
  }
}
