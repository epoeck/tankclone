/** Cartas do fim de partida (Reborn: SmallCardsView, 9 cartas 3×3, uma escolha, 5 s de contagem).
 * Nesta build cada carta é só XP ou gold. O conteúdo é sorteado no servidor ao terminar a partida. */
export type CardReward = { kind: "xp" | "gold"; amount: number };
export const CARD_COUNT = 9;
/** Animação de vitória/derrota (~70 quadros a 24 fps) + contagem de 5 s + folga de rede. */
export const CARD_PICK_MS = 3000 + 5000 + 700;
export const CARD_XP = { min: 10, max: 60, step: 5 } as const;
export const CARD_GOLD = { min: 100, max: 1000, step: 50 } as const;

/** `rand(n)` devolve um inteiro em [0, n). */
export function makeDeck(rand: (n: number) => number): CardReward[] {
  const pick = (r: { min: number; max: number; step: number }) => r.min + rand((r.max - r.min) / r.step + 1) * r.step;
  return Array.from({ length: CARD_COUNT }, () => rand(2) === 0 ? { kind: "xp", amount: pick(CARD_XP) } : { kind: "gold", amount: pick(CARD_GOLD) });
}

export interface PendingCards { deck: CardReward[]; deadline: number }
/** Cartas aguardando escolha, por apelido. Uma escolha só; depois do prazo o servidor escolhe uma ao acaso. */
export class CardTable {
  private pending = new Map<string, PendingCards>();
  constructor(private rand: (n: number) => number) {}
  deal(nicks: string[], now: number): void { for (const n of nicks) this.pending.set(n, { deck: makeDeck(this.rand), deadline: now + CARD_PICK_MS }); }
  has(nick: string): boolean { return this.pending.has(nick); }
  /** Escolha do jogador; devolve a carta e o baralho inteiro (para revelar as outras) ou um erro. */
  pick(nick: string, index: unknown): { index: number; reward: CardReward; deck: CardReward[] } | string {
    const p = this.pending.get(nick); if (!p) return "nenhuma carta para escolher";
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= CARD_COUNT) return "carta inválida";
    this.pending.delete(nick);
    return { index, reward: p.deck[index]!, deck: p.deck };
  }
  /** Quem não escolheu até o prazo: escolha automática. */
  expire(now: number): Array<{ nick: string; index: number; reward: CardReward; deck: CardReward[] }> {
    const out = [];
    for (const [nick, p] of this.pending) if (now >= p.deadline) {
      const index = this.rand(CARD_COUNT); this.pending.delete(nick);
      out.push({ nick, index, reward: p.deck[index]!, deck: p.deck });
    }
    return out;
  }
}
