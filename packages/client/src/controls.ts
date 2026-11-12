/** Entrada de teclado do jogador: andar, ângulo, força (segurar/soltar), itens, especial, passar. Só envia intenções. */
import { ITEMS, own } from "@tankclone/core";
import { sfx, toggleMute } from "./sound";
import type { MatchView } from "./view";

export class Controls {
  private keys = new Set<string>();
  charging = false; private chargeDir = 1;
  private walkAcc = 0; private angleAcc = 0.1; private angleKey = 0;
  constructor(public view: MatchView, private canControl: () => boolean, readonly send: (i: Record<string, unknown>) => void) {
    addEventListener("keydown", e => this.down(e));
    addEventListener("keyup", e => this.up(e));
  }
  private down(e: KeyboardEvent) {
    if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
    if (e.code === "Space") { e.preventDefault(); if (e.repeat) return; if (this.canControl() && this.view.canAct) { this.charging = true; this.chargeDir = 1; this.view.ui.power = 0; this.send({ type: "charge", on: true }); } return; }
    this.keys.add(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
    if (!this.canControl() || !this.view.canAct) return;
    const k = e.key.toUpperCase();
    if (k === "M") { this.view.ui.msg = toggleMute() ? "som desligado" : "som ligado"; return; }
    if (own(ITEMS, k)) this.send({ type: "item", key: k });
    else if (k === "P" && !this.charging) { sfx("pass"); this.send({ type: "pass" }); }
    else if (k === "R") this.view.ui.special = !this.view.ui.special;
  }
  private up(e: KeyboardEvent) {
    this.keys.delete(e.code);
    if (e.code === "Space" && this.charging) {
      this.charging = false;
      if (this.view.ui.power > 1 && this.canControl()) { this.view.ui.last = this.view.ui.power; } if (this.view.ui.power > 1 && this.canControl()) { sfx("release"); this.send({ type: "shoot", angleDeg: this.view.ui.angle, power: this.view.ui.power, special: this.view.ui.special }); }
      else if (this.canControl()) this.send({ type: "charge", on: false });
      this.view.ui.power = 0;
    }
  }
  update(dt: number) {
    const ui = this.view.ui;
    // o ângulo é do jogador: as setas ↑↓ funcionam a qualquer momento (inclusive fora da vez e entre tiros), 1°/toque, repete a cada 100 ms
    const ad = (this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("ArrowDown") ? 1 : 0);
    if (ad && !this.charging) { this.angleAcc += dt; if (this.angleAcc >= 0.1 || this.angleKey !== ad) { this.angleAcc = 0; ui.angle += ad; sfx("angle"); } } else this.angleAcc = 0.1;
    this.angleKey = ad;
    if (!this.canControl() || !this.view.canAct) { if (this.charging && !this.view.canAct) { this.charging = false; ui.power = 0; } return; }
    if (this.charging) {
      // a barra sobe até 100 e desce; se voltar a 0 sem soltar Espaço, passa a vez
      const before = Math.floor(ui.power / 5);
      ui.power += this.chargeDir * 80 * dt;
      if (Math.floor(ui.power / 5) !== before) sfx("charge");
      if (ui.power >= 100) { ui.power = 100; this.chargeDir = -1; }
      else if (ui.power <= 0) { ui.power = 0; this.charging = false; this.chargeDir = 1; sfx("pass"); this.send({ type: "pass" }); }
      return;
    }
    const dir = (this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("ArrowLeft") ? 1 : 0);
    if (dir) { this.walkAcc += dt * 80; const px = Math.floor(this.walkAcc); if (px > 0) { this.walkAcc -= px; this.send({ type: "move", dir, px }); } }
  }
}
