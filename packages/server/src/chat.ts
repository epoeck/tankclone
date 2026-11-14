/** Chat efêmero: limpeza do texto e limite de taxa por jogador. Nada é guardado. */

export const CHAT_MAX = 200;

/** Remove caracteres de controle e de formatação invisíveis, normaliza espaços e corta em CHAT_MAX. Vazio = rejeitar. */
export function cleanChat(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ") // controle, formatação (inclui bidi) e separadores de linha
    .replace(/\s+/g, " ").trim()
    .slice(0, CHAT_MAX);
}

/** Balde de fichas: `burst` mensagens de rajada e uma nova a cada `refillMs`. */
export class ChatLimiter {
  private tokens: number; private last: number;
  constructor(private burst = 4, private refillMs = 1500, private now: () => number = Date.now) { this.tokens = burst; this.last = this.now(); }
  allow(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + (t - this.last) / this.refillMs); this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1; return true;
  }
}
