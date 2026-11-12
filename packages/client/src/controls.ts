/** Entrada de teclado do jogador: andar, ângulo, força (segurar/soltar), itens, especial, passar. Só envia intenções. */
import { ITEMS, SHOT_INTERVAL_SECONDS, WEAPONS, own } from "@tankclone/core";
import { sfx, stopSfx, toggleMute } from "./sound";
import type { MatchView } from "./view";

/** Fluxo do Reborn (EnergyView + GameLocalPlayer):
 * - segurar Espaço já começa a carregar e para o relógio (um aperto só);
 * - soltar atira e corta o som da força;
 * - com tiros extras (+1/+2), o mesmo soltar dispara os demais sozinho, um por segundo, com a mesma força
 *   e o ângulo do momento — no intervalo só as setas ↑↓ mexem; não se carrega de novo. */
export class Controls {
  private keys = new Set<string>();
  charging = false; private chargeDir = 1;
  /** Rajada em andamento: tiros que ainda saem sozinhos neste turno. */
  private burst: { power: number; special: boolean; left: number; nextAt: number } | null = null;
  private walkAcc = 0; private angleAcc = 0.1; private angleKey = 0;
  constructor(public view: MatchView, private canControl: () => boolean, readonly send: (i: Record<string, unknown>) => void) {
    addEventListener("keydown", e => this.down(e));
    addEventListener("keyup", e => this.up(e));
  }
  /** Pode começar a carregar: é a sua vez, a partida não acabou e ainda não atirou neste turno. */
  private get canCharge(): boolean { return this.canControl() && !this.view.hud.over && !this.view.ui.fired && !this.burst; }
  private down(e: KeyboardEvent) {
    if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
    if (e.code === "Space") {
      e.preventDefault(); if (e.repeat || this.charging) return;
      if (this.canCharge) { this.charging = true; this.chargeDir = 1; this.view.ui.power = 0; this.send({ type: "charge", on: true }); }
      return;
    }
    this.keys.add(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
    // Reborn (ArrowView.__inputKeyDown): cada toque em ↑/↓ já muda 1°; segurando, repete a cada 100 ms
    const ad = e.code === "ArrowUp" ? 1 : e.code === "ArrowDown" ? -1 : 0;
    if (ad && !e.repeat) { this.view.ui.angle += ad; sfx("angle"); this.angleAcc = 0; this.angleKey = ad; }
    const k = e.key.toUpperCase();
    if (k === "M") { this.view.ui.msg = toggleMute() ? "som desligado" : "som ligado"; return; }
    if (!this.canControl() || this.view.hud.over || this.burst || this.view.ui.fired) return;
    // Reborn: itens e POW também valem enquanto carrega a força (isAttacking só cai ao soltar); andar e passar, não
    if (own(ITEMS, k)) { sfx("click"); this.send({ type: "item", key: k }); this.view.ui.pressed = { key: k, at: performance.now() }; return; }
    if (k === "R" || k === "B") { this.togglePow(); return; }
    if (this.charging || !this.view.canAct) return;
    if (k === "P") { sfx("pass"); this.send({ type: "pass" }); }
  }
  private up(e: KeyboardEvent) {
    this.keys.delete(e.code);
    if (e.code === "Space" && this.charging) {
      this.charging = false;
      if (!this.canControl()) { stopSfx("charge"); this.view.ui.power = 0; return; }
      // soltar sempre atira com a força atual (não existe soltar sem atirar); o 019 corta o 020
      const ui = this.view.ui, power = ui.power, special = ui.special;
      sfx("release");
      this.sendShot(power, special);
      const left = this.extraShots(special);
      this.burst = left > 0 ? { power, special, left, nextAt: performance.now() + SHOT_INTERVAL_SECONDS * 1000 } : null;
      ui.power = 0;
    }
  }
  private sendShot(power: number, special: boolean): void {
    const { min, max } = this.view.aimRange;
    const angleDeg = Math.min(max, Math.max(min, this.view.ui.angle));
    this.view.ui.angle = angleDeg;
    this.view.expectShot(angleDeg, power);
    this.send({ type: "shoot", angleDeg, power, special });
  }
  /** POW (estouro): só com a fúria cheia; o especial é decidido no primeiro tiro. */
  togglePow(): void {
    const me = this.view.current; if (!me || me.fury < 200) { this.view.ui.special = false; return; }
    sfx("click"); this.view.ui.special = !this.view.ui.special;
  }
  /** Mesma conta do servidor (Match.doShoot): voo não tem extras; +1/+2 e o especial somam tiros. */
  private extraShots(special: boolean): number {
    const ui = this.view.ui; if (ui.fly) return 0;
    const me = this.view.current, weapon = me ? own(WEAPONS, me.weaponId) : undefined;
    return ui.extraShots + (special && weapon ? weapon.special.shots : 0);
  }
  update(dt: number) {
    const ui = this.view.ui;
    // o ângulo é do jogador: as setas ↑↓ funcionam a qualquer momento (inclusive fora da vez e entre tiros), 1°/toque, repete a cada 100 ms
    const ad = (this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("ArrowDown") ? 1 : 0);
    if (ad) { this.angleAcc += dt; if (this.angleAcc >= 0.1 || this.angleKey !== ad) { this.angleAcc = 0; ui.angle += ad; sfx("angle"); } } else this.angleAcc = 0;
    this.angleKey = ad;
    // perdeu a vez (tempo, desconexão, fim): abandona carga e rajada. Animações em curso NÃO cancelam a carga.
    if (!this.canControl() || this.view.hud.over) {
      if (this.charging) { this.charging = false; ui.power = 0; stopSfx("charge"); }
      this.burst = null; return;
    }
    if (this.burst) {
      // relógio de parede (como o Timer de 1000 ms do Reborn), não o dt limitado do quadro
      if (performance.now() >= this.burst.nextAt) {
        this.sendShot(this.burst.power, this.burst.special);
        this.burst.left--; this.burst.nextAt += SHOT_INTERVAL_SECONDS * 1000;
        if (this.burst.left <= 0) this.burst = null;
      }
      return;
    }
    if (this.charging) {
      // a barra sobe até 100 e desce; se voltar a 0 sem soltar Espaço, passa a vez
      const before = Math.floor(ui.power / 5);
      ui.power += this.chargeDir * 25 * dt; // Reborn: ~4 s de 0 a 100 e outros ~4 s para voltar
      if (Math.floor(ui.power / 5) !== before) sfx("charge");
      if (ui.power >= 100) { ui.power = 100; this.chargeDir = -1; }
      else if (ui.power <= 0) { ui.power = 0; this.charging = false; this.chargeDir = 1; stopSfx("charge"); sfx("pass"); this.send({ type: "pass" }); }
      return;
    }
    if (!this.view.canAct || ui.fired) return;
    const dir = (this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("ArrowLeft") ? 1 : 0);
    if (dir) { this.walkAcc += dt * 80; const px = Math.floor(this.walkAcc); if (px > 0) { this.walkAcc -= px; this.send({ type: "move", dir, px }); } }
  }
}
