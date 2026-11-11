/** HUD da partida em HTML/CSS por cima do canvas (classes do design). Só lê o estado do MatchView; nunca decide regra. */
import { ITEMS, WEAPONS, own, type ItemKey } from "@tankclone/core";
import { drawCharPortrait } from "./chars";
import type { MatchView } from "./view";

const KEYS: ItemKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "F"];
const ITEM_NAMES: Record<string, string> = { "1": "Rajada (+2 tiros)", "2": "Leque (triplo)", "3": "Bis (+1 tiro)", "4": "Pólvora +50%", "5": "Pólvora +40%", "6": "Pólvora +30%", "7": "Pólvora +20%", "8": "Pólvora +10%", F: "Voo" };
const TAGS: Record<string, string> = { "4": "50%", "5": "40%", "6": "30%", "7": "20%", "8": "10%" };
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

const el = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

let chatKey: ((e: KeyboardEvent) => void) | null = null;
export class Hud {
  private turns: HTMLElement; private wind: HTMLElement; private windVal: HTMLElement; private timer: HTMLElement; private timerNum: HTMLElement;
  private mini: HTMLCanvasElement; private name: HTMLElement; private hpBar: HTMLElement; private hpText: HTMLElement; private enBar: HTMLElement; private enText: HTMLElement;
  private power: HTMLElement; private angle: HTMLElement; private angleVal: HTMLElement; private gauge: HTMLElement; private gaugeLabel: HTMLElement; private banner: HTMLElement;
  private slots = new Map<string, HTMLElement>(); private counts = new Map<string, HTMLElement>();
  private portraits = new Map<string, HTMLCanvasElement>();
  private lastOrder = ""; private meCanvas!: HTMLCanvasElement;

  constructor(readonly root: HTMLElement, private view: MatchView, private me: () => string | null, private onItem: (k: ItemKey) => void, private onPass: () => void = () => {}) {
    root.className = "hud";
    root.innerHTML = `
      <div class="me"><canvas width="96" height="120"></canvas><div class="me__name"><span class="title title--sm title--cream" data-k="name"></span><span class="chip chip--lvl" data-k="weapon"></span></div></div>
      <div class="chatbox"><div class="chatbox__log" aria-live="polite"></div><input class="chatbox__in" maxlength="200" placeholder="Enter para conversar" autocomplete="off" hidden></div>
      <div class="turns panel" style="padding:10px 12px;"></div>
      <div class="windbox panel" style="padding:8px 16px;">
        <div class="wind"><span class="label">Vento</span><div class="wind__arrow" data-dir="right"></div><span class="wind__value num">0,0</span></div>
      </div>
      <div class="timer" style="--t:100%"><span class="num">10</span></div>
      <button class="btn btn--steel btn--sm passbtn" type="button">PASSAR (P)</button>
      <div class="minimap well"><canvas width="208" height="76"></canvas></div>
      <div class="items"></div>
      <div class="vitals panel">
        <div class="vitals__row"><img src="/assets/ui/stats/stat-hp.svg" alt="Vida"><div class="bar bar--hp" style="--value:100%"><span class="bar__text num"></span></div></div>
        <div class="vitals__row"><img src="/assets/ui/stats/stat-energy.svg" alt="Energia"><div class="bar bar--energy" style="--value:100%"><span class="bar__text num"></span></div></div>
      </div>
      <div class="powerwrap"><span class="label powerwrap__label">Força</span><div class="power" style="--power:0%; --last:0%"><span class="power__last"></span></div>
        <div class="power__ruler num">${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(n => `<span>${n}</span>`).join("")}</div></div>
      <div class="angle" style="--angle:45deg"><img class="angle__dial" src="/assets/ui/hud/angle-dial.svg" alt=""><span class="angle__needle"></span><span class="angle__value num">45°</span></div>
      <div class="gauge" style="--pressure:0"><img src="/assets/ui/hud/pressure-gauge.svg" alt=""><img class="gauge__needle" src="/assets/ui/hud/pressure-needle.svg" alt=""><span class="gauge__label">Pressão 0%</span></div>
      <div class="banner panel" hidden><span class="title title--lg title--cream"></span></div>`;
    this.turns = el(root, ".turns"); this.wind = el(root, ".wind__arrow"); this.windVal = el(root, ".wind__value"); this.timer = el(root, ".timer"); this.timerNum = el(root, ".timer span");
    this.mini = el(root, ".minimap canvas"); this.name = el(root, '[data-k="name"]');
    this.hpBar = el(root, ".bar--hp"); this.hpText = el(this.hpBar, ".bar__text"); this.enBar = el(root, ".bar--energy"); this.enText = el(this.enBar, ".bar__text");
    this.power = el(root, ".power"); this.angle = el(root, ".angle"); this.angleVal = el(root, ".angle__value"); this.gauge = el(root, ".gauge"); this.gaugeLabel = el(root, ".gauge__label"); this.banner = el(root, ".banner");
    el<HTMLButtonElement>(root, ".passbtn").onclick = () => this.onPass();
    this.meCanvas = el(root, ".me canvas");
    const items = el(root, ".items");
    KEYS.forEach(k => {
      const d = document.createElement("div"); d.className = "slot"; d.title = ITEM_NAMES[k]!;
      const tag = TAGS[k] ? `<span class="slot__tag">${TAGS[k]}</span>` : "";
      d.innerHTML = `<img src="/assets/ui/items/item-${k.toLowerCase()}.svg" alt="${ITEM_NAMES[k]}"><span class="slot__key">${k}</span>${tag}<span class="slot__cost">${ITEMS[k].cost}</span><span class="slot__count"></span>`;
      d.onclick = () => this.onItem(k);
      items.append(d); this.slots.set(k, d); this.counts.set(k, el(d, ".slot__count"));
    });
  }

  /** Linha de chat da sala durante a partida (só textContent). */
  addChat(from: string, text: string): void {
    const log = el(this.root, ".chatbox__log"), line = document.createElement("div");
    const b = document.createElement("b"); b.textContent = from + ": "; line.append(b, document.createTextNode(text));
    log.append(line); while (log.children.length > 6) log.firstChild!.remove();
    setTimeout(() => line.classList.add("old"), 12000);
  }
  /** Liga o campo de conversa: Enter abre/envia. */
  bindChat(send: (text: string) => void): void {
    const inp = el<HTMLInputElement>(this.root, ".chatbox__in");
    if (chatKey) removeEventListener("keydown", chatKey);
    chatKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !this.root.isConnected) return;
      if (document.activeElement === inp) { if (inp.value.trim()) send(inp.value); inp.value = ""; inp.hidden = true; inp.blur(); }
      else if ((e.target as HTMLElement | null)?.tagName !== "INPUT") { inp.hidden = false; inp.focus(); e.preventDefault(); }
    };
    addEventListener("keydown", chatKey);
  }

  private portrait(id: string): HTMLCanvasElement {
    let c = this.portraits.get(id);
    if (!c) { c = document.createElement("canvas"); c.width = 42; c.height = 42; this.portraits.set(id, c); }
    const ch = this.view.chars.get(id)!;
    drawCharPortrait(c, ch.look, ch.weaponId);
    return c;
  }

  update(): void {
    const v = this.view, cur = v.current, me = this.me();
    // ordem de turno: quem joga agora primeiro; depois por delay acumulado
    const alive = [...v.chars.values()].filter(c => c.alive);
    const ordered = [...alive].sort((a, b) => (a.id === cur?.id ? -1 : b.id === cur?.id ? 1 : a.delay - b.delay));
    const sig = ordered.map(c => `${c.id}:${Math.round(c.delay - (cur?.delay ?? 0))}:${c.id === cur?.id}`).join("|");
    if (sig !== this.lastOrder) {
      this.lastOrder = sig; this.turns.replaceChildren();
      for (const c of ordered) {
        const it = document.createElement("div"); it.className = "turns__item"; if (c.id === cur?.id) it.setAttribute("aria-current", "true");
        const p = document.createElement("div"); p.className = `portrait portrait--${c.team === 1 ? "blue" : "red"}`;
        const cv = this.portrait(c.id); const copy = document.createElement("canvas"); copy.width = cv.width; copy.height = cv.height; copy.getContext("2d")!.drawImage(cv, 0, 0);
        p.append(copy);
        const small = document.createElement("small"); small.textContent = c.id === cur?.id ? c.id : `${c.id} +${Math.max(0, Math.round(c.delay - (cur?.delay ?? 0)))}`;
        it.append(p, small); this.turns.append(it);
      }
    }
    const w = v.hud.wind;
    this.wind.dataset.dir = w < 0 ? "left" : "right"; this.windVal.textContent = Math.abs(w).toFixed(1).replace(".", ",");
    const frac = Math.max(0, Math.min(1, v.hud.timeLeft / v.hud.timeLimit));
    this.timer.style.setProperty("--t", `${(frac * 100).toFixed(0)}%`); this.timerNum.textContent = String(Math.ceil(v.hud.timeLeft));
    if (v.hud.timeLeft <= 3) this.timer.setAttribute("data-urgent", ""); else this.timer.removeAttribute("data-urgent");

    // console: mostra o jogador que você controla (ou o da vez, no jogo local)
    const who = (me ? v.chars.get(me) : undefined) ?? cur;
    if (who) {
      drawCharPortrait(this.meCanvas, who.look, who.weaponId);
      this.name.textContent = who.id; el(this.root, '[data-k="weapon"]').textContent = own(WEAPONS, who.weaponId)?.name ?? "";
      this.hpBar.style.setProperty("--value", `${(who.hp / who.maxHp) * 100}%`); this.hpText.textContent = `${fmt(who.hp)} / ${fmt(who.maxHp)}`;
      const en = who === cur ? who.energy : who.maxEnergy;
      this.enBar.style.setProperty("--value", `${(en / Math.max(1, who.maxEnergy)) * 100}%`);
      this.enText.textContent = `${fmt(en)}${who === cur && v.ui.spent ? ` · itens −${v.ui.spent}` : ""}`;
      this.gauge.style.setProperty("--pressure", String(who.fury / 100)); this.gaugeLabel.textContent = `Pressão ${Math.round(who.fury)}%${v.ui.special ? " · ESTOURO" : ""}`;
    }
    this.power.style.setProperty("--power", `${v.ui.power}%`); this.power.style.setProperty("--last", `${v.ui.last}%`);
    this.angle.style.setProperty("--angle", `${v.ui.angle}deg`); this.angleVal.textContent = `${Math.round(v.ui.angle)}°`;
    const mine = !me || me === cur?.id;
    for (const k of KEYS) {
      const d = this.slots.get(k)!, n = v.ui.used[k] ?? 0, can = mine && (cur?.energy ?? 0) >= ITEMS[k].cost && !(k === "2" && v.ui.triple) && !(k === "F" && v.ui.fly);
      d.classList.toggle("is-off", !can); if (n) d.setAttribute("aria-selected", "true"); else d.removeAttribute("aria-selected");
      this.counts.get(k)!.textContent = n > 1 ? `×${n}` : "";
    }
    this.drawMinimap();
    if (v.hud.over) { this.banner.hidden = false; el<HTMLElement>(this.banner, "span").textContent = v.hud.winner === null ? "Empate" : `Time ${v.hud.winner === 1 ? "Azul" : "Vermelho"} venceu!`; }
    else this.banner.hidden = true;
  }

  private drawMinimap(): void {
    const v = this.view, c = this.mini.getContext("2d")!, w = this.mini.width, h = this.mini.height;
    c.clearRect(0, 0, w, h); c.fillStyle = "#0c1130"; c.fillRect(0, 0, w, h);
    c.drawImage(v.terrainCanvas, 0, 0, v.width, v.height, 0, 0, w, h);
    for (const ch of v.chars.values()) if (ch.alive) { c.fillStyle = ch.team === 1 ? "#4a90ff" : "#ff5a47"; c.beginPath(); c.arc((ch.x / v.width) * w, (ch.y / v.height) * h - 2, 3, 0, 7); c.fill(); }
    c.strokeStyle = "#fff6e0"; c.lineWidth = 2; c.strokeRect((v.camX / v.width) * w, 1, (1280 / v.width) * w, h - 2);
  }
}
