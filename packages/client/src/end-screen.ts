/** Fim de partida como no Reborn: animação de vitória/derrota (GameOverAction) e depois as 9 cartas (SmallCardsView):
 * espalham-se do centro, contagem de 5 s, uma escolha; a escolhida vira com brilho e, em seguida, as outras se revelam.
 * Com os assets locais (public/ui-local) usa as imagens originais; sem eles, desenha cartas simples. */
import type { CardReward } from "../../server/src/cards";
import { UI_FPS, classFrames, drawClass, drawNamedChild, uiReady } from "./reborn-ui";
import { sfx } from "./sound";

const W = 1280, H = 720;
const CARD = { w: 106, h: 153 };
const GAP = { x: 26, y: 25 };
const COLS = 3, COUNT = 9, PICK_SECONDS = 5, FLIP_FRAMES = 5, LIGHT_FRAMES = 35;
/** Animação de vitória/derrota: 70 quadros a 24 fps. */
const RESULT_SECONDS = 70 / UI_FPS;
const GRID_W = COLS * CARD.w + (COLS - 1) * GAP.x, GRID_H = 3 * CARD.h + 2 * GAP.y;
const GRID_X = (W - GRID_W) / 2, GRID_Y = 150;

type Card = { x: number; y: number; reward?: CardReward; flipAt?: number; picked?: boolean };

export class EndScreen {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private start = performance.now() / 1000;
  private cards: Card[] = Array.from({ length: COUNT }, (_, i) => ({ x: GRID_X + (i % COLS) * (CARD.w + GAP.x), y: GRID_Y + Math.floor(i / COLS) * (CARD.h + GAP.y) }));
  private hover = -1; private chosen = -1; private sent = false; private doneAt = Infinity; private raf = 0; private lastTick = -1;
  private msg = "";

  constructor(private host: HTMLElement, private won: boolean | null, private canPick: boolean, private onPick: (i: number) => void, private onDone: () => void) {
    this.canvas = document.createElement("canvas"); this.canvas.width = W; this.canvas.height = H; this.canvas.className = "endscreen";
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:5;cursor:default";
    this.ctx = this.canvas.getContext("2d")!;
    host.append(this.canvas);
    this.canvas.addEventListener("pointermove", e => { this.hover = this.cardAt(e); this.canvas.style.cursor = this.hover >= 0 && this.pickable ? "pointer" : "default"; });
    this.canvas.addEventListener("pointerdown", e => { const i = this.cardAt(e); if (i >= 0 && this.pickable) { sfx("click"); this.sent = true; this.chosen = i; this.onPick(i); } });
    // sem cartas: só a animação; com cartas, uma rede de segurança caso a resposta do servidor não chegue
    this.doneAt = this.start + RESULT_SECONDS + (canPick ? 0.8 + PICK_SECONDS + 4 : 1.5);
    const loop = () => { this.draw(); if (performance.now() / 1000 >= this.doneAt) { this.close(); return; } this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  private get t(): number { return performance.now() / 1000 - this.start; }
  private get cardsAt(): number { return RESULT_SECONDS; }
  private get pickable(): boolean { return this.canPick && !this.sent && this.t >= this.cardsAt + 0.8 && this.t < this.cardsAt + 0.8 + PICK_SECONDS + 0.7; }

  /** Resposta do servidor: vira a escolhida (ou a automática) e, meio segundo depois, as demais. */
  reveal(index: number, deck: CardReward[], auto: boolean, msg: string): void {
    const now = performance.now() / 1000;
    this.sent = true; this.chosen = index; this.msg = msg + (auto ? " (o tempo acabou: carta automática)" : "");
    deck.forEach((reward, i) => { const c = this.cards[i]!; c.reward = reward; c.picked = i === index; c.flipAt = now + (i === index ? 0 : 0.6 + i * 0.05); });
    sfx("cardFlip");
    this.doneAt = now + 0.6 + 1 + 2.5; // revela as outras + SMALL_CARD_VIEW_TIME (1 s) + folga para ler
  }

  close(): void {
    cancelAnimationFrame(this.raf); this.canvas.remove(); const done = this.onDone; this.onDone = () => {}; done();
  }

  private cardAt(e: PointerEvent): number {
    const r = this.canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    return this.cards.findIndex(c => x >= c.x && x <= c.x + CARD.w && y >= c.y && y <= c.y + CARD.h);
  }

  private draw(): void {
    const ctx = this.ctx, t = this.t, now = performance.now() / 1000;
    ctx.clearRect(0, 0, W, H);
    if (t < this.cardsAt || !this.canPick) { this.drawResult(t); return; }
    ctx.fillStyle = "rgba(6,10,30,.55)"; ctx.fillRect(0, 0, W, H);
    // título e contagem (CountDownNum_n; tique a cada segundo como o relógio)
    const ct = t - this.cardsAt - 0.8, left = Math.max(0, Math.ceil(PICK_SECONDS - ct));
    ctx.save(); ctx.translate(W / 2 - 85, 40); drawClass(ctx, "gameover", "asset.takeoutCard.TitleBitmap"); ctx.restore();
    if (!uiReady("gameover")) { ctx.fillStyle = "#ffe279"; ctx.font = "bold 30px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText("Escolha uma carta", W / 2, 70); ctx.textAlign = "left"; }
    if (!this.sent && ct >= 0) {
      if (left !== this.lastTick) { this.lastTick = left; if (left > 0) sfx("tick"); }
      ctx.save(); ctx.translate(GRID_X + GRID_W + 30, GRID_Y);
      if (!drawClass(ctx, "gameover", `asset.takeoutCard.CountDownNum_${left}`)) { ctx.fillStyle = "#fff"; ctx.font = "bold 56px Nunito, system-ui"; ctx.fillText(String(left), 0, 56); }
      ctx.restore();
    }
    // cartas: saem do centro em 0,8 s (TweenLite Quint.easeOut)
    const k = Math.min(1, Math.max(0, ct + 0.8) / 0.8), ease = 1 - (1 - k) ** 5, mid = this.cards[4]!;
    this.cards.forEach((c, i) => {
      const x = mid.x + (c.x - mid.x) * ease, lift = i === this.hover && this.pickable ? -6 : 0, y = mid.y + (c.y - mid.y) * ease + lift;
      const fe = c.flipAt === undefined ? -1 : now - c.flipAt, frame = fe < 0 ? 0 : Math.min(FLIP_FRAMES - 1, Math.floor(fe * UI_FPS));
      ctx.save(); ctx.translate(x, y);
      if (c.picked && fe >= 0) drawNamedChild(ctx, "gameover", "asset.takeoutCard.LuckyCard", "lightFrame", Math.min(LIGHT_FRAMES - 1, fe * UI_FPS));
      if (!drawNamedChild(ctx, "gameover", "asset.takeoutCard.LuckyCard", "cardMc", frame)) this.plainCard(frame >= 3);
      if (i === this.hover && this.pickable) { ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 3; ctx.shadowColor = "#ffff00"; ctx.shadowBlur = 8; ctx.strokeRect(2, 2, CARD.w - 4, CARD.h - 4); }
      if (frame >= FLIP_FRAMES - 1 && c.reward) this.face(c.reward, !!c.picked);
      if (c.picked && fe >= 0) drawNamedChild(ctx, "gameover", "asset.takeoutCard.LuckyCard", "starMc", Math.min(13, fe * UI_FPS));
      ctx.restore();
    });
    if (this.msg) { ctx.fillStyle = "#fff6e0"; ctx.font = "bold 22px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText(this.msg, W / 2, GRID_Y + GRID_H + 45); ctx.textAlign = "left"; }
  }

  private drawResult(t: number): void {
    const ctx = this.ctx, cls = this.won === false ? "asset.game.lostAsset" : "asset.game.winAsset";
    const n = classFrames("game", cls) || 70, f = Math.min(n - 1, t * UI_FPS);
    ctx.save(); ctx.translate(W / 2, H / 2 + 40);
    if (!drawClass(ctx, "game", cls, f)) {
      ctx.fillStyle = this.won === false ? "#ff8a7a" : "#ffe279"; ctx.font = "bold 72px 'Lilita One', Nunito, system-ui"; ctx.textAlign = "center";
      ctx.strokeStyle = "#1a1030"; ctx.lineWidth = 8; const s = this.won === null ? "EMPATE" : this.won ? "VITÓRIA!" : "DERROTA";
      ctx.strokeText(s, 0, 0); ctx.fillText(s, 0, 0);
    }
    ctx.restore();
  }

  /** Verso/frente simples quando não há assets locais. */
  private plainCard(front: boolean): void {
    const ctx = this.ctx; ctx.fillStyle = front ? "#fff4d6" : "#3b5bb5"; ctx.strokeStyle = "#1a1030"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(1, 1, CARD.w - 2, CARD.h - 2, 10); ctx.fill(); ctx.stroke();
    if (!front) { ctx.fillStyle = "#ffe279"; ctx.font = "bold 40px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText("?", CARD.w / 2, CARD.h / 2 + 14); ctx.textAlign = "left"; }
  }

  /** Frente da carta (LuckyCard): gold com GoldTxt/GoldBitmap e o número; XP com o mesmo estilo de texto. */
  private face(r: CardReward, picked: boolean): void {
    const ctx = this.ctx;
    if (r.kind === "gold") {
      ctx.save(); ctx.translate(17, 21); drawClass(ctx, "gameover", "asset.takeoutCard.GoldTxt"); ctx.restore();
      ctx.save(); ctx.translate(27, 77); drawClass(ctx, "gameover", "asset.takeoutCard.GoldBitmap"); ctx.restore();
    } else {
      ctx.fillStyle = "#3a7d1e"; ctx.font = "bold 30px 'Lilita One', Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText("XP", CARD.w / 2, 46);
    }
    ctx.fillStyle = "#9c3f09"; ctx.font = "bold 19px Arial, sans-serif"; ctx.textAlign = "center";
    ctx.strokeStyle = "#fff8d0"; ctx.lineWidth = 3; const s = `${r.amount}`; ctx.strokeText(s, CARD.w / 2, r.kind === "gold" ? 68 : 80); ctx.fillText(s, CARD.w / 2, r.kind === "gold" ? 68 : 80);
    if (!picked) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, 0, CARD.w, CARD.h); }
    ctx.textAlign = "left";
  }
}
