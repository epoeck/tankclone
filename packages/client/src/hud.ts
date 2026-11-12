import { miniTransform, miniToMap, mapToMini } from "./minimap-geometry";
/** HUD da partida em HTML/CSS por cima do canvas (classes do design). Só lê o estado do MatchView; nunca decide regra. */
import { ITEMS, WEAPONS, own, type ItemKey } from "@tankclone/core";
import { drawCharPortrait } from "./chars";
import { dialAngle, lastShotMarker } from "./character-state";
import { VIEW_W, VIEW_H, type MatchView } from "./view";
import { PROP_ICON, UI_FPS, drawClass, uiReady } from "./reborn-ui";
import { sfx } from "./sound";

/** Ícone original (assets locais) com volta ao ícone do jogo se o arquivo não existir. */
function iconImg(key: string, fallback: string, alt: string): string {
  return `<img src="${PROP_ICON(key)}" data-fallback="${fallback}" alt="${alt}" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
}

const KEYS: ItemKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "F"];
const ITEM_NAMES: Record<string, string> = { "1": "Rajada (+2 tiros)", "2": "Leque (triplo)", "3": "Bis (+1 tiro)", "4": "Pólvora +50%", "5": "Pólvora +40%", "6": "Pólvora +30%", "7": "Pólvora +20%", "8": "Pólvora +10%", F: "Voo" };
const TAGS: Record<string, string> = { "4": "50%", "5": "40%", "6": "30%", "7": "20%", "8": "10%" };
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

const el = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

let chatKey: ((e: KeyboardEvent) => void) | null = null;
export class Hud {
  private turns: HTMLElement; private wind: HTMLElement; private windVal: HTMLElement; private timer: HTMLElement; private timerNum: HTMLElement;
  private mini: HTMLCanvasElement; private measureX: number | null = null; private name: HTMLElement; private hpBar: HTMLElement; private hpText: HTMLElement; private enBar: HTMLElement; private enText: HTMLElement;
  private power: HTMLElement; private angle: HTMLElement; private angleVal: HTMLElement; private gauge: HTMLElement; private gaugeLabel: HTMLElement; private banner: HTMLElement;
  private slots = new Map<string, HTMLElement>(); private counts = new Map<string, HTMLElement>();
  private portraits = new Map<string, HTMLCanvasElement>();
  private dander!: HTMLCanvasElement;
  private lastOrder = ""; private meCanvas!: HTMLCanvasElement; private estouro!: HTMLElement; private blue!: HTMLElement; private red!: HTMLElement;

  constructor(readonly root: HTMLElement, private view: MatchView, private me: () => string | null, private onItem: (k: ItemKey) => void, private onPass: () => void = () => {}) {
    root.className = "hud";
    root.innerHTML = `
      <div class="me"><div class="me__name"><span data-k="name"></span><span class="chip chip--lvl" data-k="weapon"></span></div><div class="me__ring"><canvas width="110" height="150"></canvas></div></div>
      <div class="feed"><div class="feed__lines" aria-live="polite"></div><input class="feed__in" maxlength="200" placeholder="Enter para conversar" autocomplete="off" hidden></div>
      <div class="turns"></div>
      <div class="windbox"><span class="wind__label">Vento</span><div class="wind"><div class="wind__arrow" data-dir="right"></div><span class="wind__value num">0,0</span></div></div>
      <div class="clock"><span class="clock__num num">10</span><button class="btn btn--steel btn--sm passbtn" type="button">Passar (P)</button></div>
      <div class="minimap well"><canvas width="300" height="130"></canvas></div>
      <div class="roundinfo panel"><div><span style="color:var(--sky-300)">Azul</span><b class="num" data-k="blue"></b></div><div><span style="color:#ffb1a6">Vermelho</span><b class="num" data-k="red"></b></div></div>
      <div class="itemcol"></div>
      <div class="dial" style="--angle:45deg"><span class="dial__range"></span><span class="dial__last" hidden></span><span class="dial__needle"></span><span class="dial__hub"></span><span class="dial__value num">45</span></div>
      <div class="skills"></div>
      <div class="powerbar"><span class="powerbar__label">Força</span>
        <div class="powerbar__ruler num">${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(n => `<span>${n}</span>`).join("")}</div>
        <div class="power" style="--power:0%; --last:0%"><span class="power__history" hidden></span><span class="power__hint">Segure Espaço: a força vai até 100 e volta</span></div></div>
      <div class="vitals2">
        <div class="vitals2__row"><span>Energia</span><div class="bar bar--energy" style="--value:100%"><span class="bar__text num"></span></div></div>
        <div class="vitals2__row"><span>Vida</span><div class="bar bar--hp bar--lg" style="--value:100%"><span class="bar__text num"></span></div></div>
      </div>
      <div class="gauge" style="--pressure:0"><img src="/assets/ui/hud/pressure-gauge.svg" alt=""><img class="gauge__needle" src="/assets/ui/hud/pressure-needle.svg" alt=""><span class="gauge__label">Pressão 0%</span></div>
      <div class="banner panel" hidden><span class="title title--lg title--cream"></span></div>`;
    this.turns = el(root, ".turns"); this.wind = el(root, ".wind__arrow"); this.windVal = el(root, ".wind__value"); this.timer = el(root, ".clock"); this.timerNum = el(root, ".clock__num");
    this.mini = el(root, ".minimap canvas");
    const moveCamera = (event: PointerEvent) => {
      const rect = this.mini.getBoundingClientRect();
      const t = miniTransform(this.view.width, this.view.height, this.mini.width, this.mini.height);
      const { x, y } = miniToMap(t, (event.clientX - rect.left) / rect.width * this.mini.width, (event.clientY - rect.top) / rect.height * this.mini.height);
      this.measureX = x; this.view.moveCameraTo(x, y);
    };
    this.mini.addEventListener("pointerdown", event => { if (event.button !== 0) return; event.preventDefault(); this.mini.setPointerCapture(event.pointerId); moveCamera(event); });
    this.mini.addEventListener("pointermove", event => { if (this.mini.hasPointerCapture(event.pointerId)) moveCamera(event); });
 this.name = el(root, '[data-k="name"]');
    this.hpBar = el(root, ".vitals2 .bar--hp"); this.hpText = el(this.hpBar, ".bar__text"); this.enBar = el(root, ".bar--energy"); this.enText = el(this.enBar, ".bar__text");
    this.power = el(root, ".power"); this.angle = el(root, ".dial"); this.angleVal = el(root, ".dial__value"); this.gauge = el(root, ".gauge"); this.gaugeLabel = el(root, ".gauge__label"); this.banner = el(root, ".banner");
    this.blue = el(root, '[data-k="blue"]'); this.red = el(root, '[data-k="red"]');
    this.estouro = document.createElement("div"); this.estouro.className = "slot"; this.estouro.title = "Estouro (R)";
    this.estouro.innerHTML = `${iconImg("pow", "/assets/ui/stats/stat-atk.svg", "POW")}<span class="slot__key">R</span><span class="slot__tag">POW</span>`;
    this.estouro.onclick = () => this.togglePow();
    // medidor de fúria do Reborn (DanderBar) por cima do manômetro, quando houver os assets locais
    this.dander = document.createElement("canvas"); this.dander.width = 104; this.dander.height = 106; this.dander.className = "dander";
    this.dander.onclick = () => this.togglePow();
    this.gauge.append(this.dander);
    el(root, ".skills").append(this.estouro);
    el<HTMLButtonElement>(root, ".passbtn").onclick = () => this.onPass();
    this.meCanvas = el(root, ".me canvas");
    const items = el(root, ".itemcol"), skills = el(root, ".skills");
    KEYS.forEach(k => {
      const d = document.createElement("div"); d.className = "slot"; d.title = ITEM_NAMES[k]!;
      const tag = TAGS[k] ? `<span class="slot__tag">${TAGS[k]}</span>` : "";
      d.innerHTML = `${iconImg(k, `/assets/ui/items/item-${k.toLowerCase()}.svg`, ITEM_NAMES[k]!)}<span class="slot__key">${k}</span>${tag}<span class="slot__cost">${ITEMS[k].cost}</span><span class="slot__count"></span>`;
      d.onclick = () => { sfx("click"); this.view.ui.pressed = { key: k, at: performance.now() }; this.onItem(k); };
      (k === "F" ? skills : items).append(d); this.slots.set(k, d); this.counts.set(k, el(d, ".slot__count"));
    });
  }

  /** POW: só com a fúria cheia e na sua vez, antes do primeiro tiro. */
  private togglePow(): void {
    const v = this.view, cur = v.current, me = this.me();
    if (!cur || (me && me !== cur.id) || v.ui.fired || cur.fury < 200 || v.hud.over) return;
    sfx("click"); v.ui.special = !v.ui.special;
  }

  /** DanderBar: fundo, preenchimento em setor de 90° a −180° (270° no total), brilho e a animação de POW pronto. */
  private drawDander(fury: number, ready: boolean): boolean {
    if (!uiReady("game")) return false;
    const c = this.dander.getContext("2d")!; c.clearRect(0, 0, 104, 106);
    c.save(); c.translate(2, 2);
    c.save(); c.translate(-2, -2); drawClass(c, "game", "asset.game.dander.bg"); c.restore();
    const p = Math.max(0, Math.min(1, fury / 200));
    if (p > 0) {
      c.save(); c.beginPath(); c.moveTo(52, 52); c.arc(52, 52, 52, Math.PI / 2, (90 - 270 * p) * Math.PI / 180, true); c.closePath(); c.clip();
      c.translate(-1, -1); drawClass(c, "game", "asset.game.dander.back"); c.restore();
    }
    c.save(); c.translate(29, 35); drawClass(c, "game", "asset.game.dander.animate.back"); c.restore();
    if (ready) { c.save(); c.translate(34, 33); c.scale(0.8, 0.8); drawClass(c, "game", "asset.game.dande.animate", performance.now() / 1000 * UI_FPS); c.restore(); }
    c.restore(); return true;
  }

  /** Linha de chat da sala durante a partida (só textContent). */
  addChat(from: string, text: string): void {
    const log = el(this.root, ".feed__lines"), line = document.createElement("div");
    const b = document.createElement("b"); b.textContent = from + ": "; line.append(b, document.createTextNode(text));
    log.append(line); while (log.children.length > 6) log.firstChild!.remove();
    setTimeout(() => line.classList.add("old"), 12000);
  }
  /** Liga o campo de conversa: Enter abre/envia. */
  bindChat(send: (text: string) => void): void {
    const inp = el<HTMLInputElement>(this.root, ".feed__in");
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
    drawCharPortrait(c, ch.look, ch.weaponArt);
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
      drawCharPortrait(this.meCanvas, who.look, who.weaponArt);
      this.name.textContent = who.id; el(this.root, '[data-k="weapon"]').textContent = own(WEAPONS, who.weaponId)?.name ?? "";
      this.hpBar.style.setProperty("--value", `${(who.hp / who.maxHp) * 100}%`); this.hpText.textContent = `${fmt(who.hp)} / ${fmt(who.maxHp)}`;
      const en = who === cur ? who.energy : who.maxEnergy;
      this.enBar.style.setProperty("--value", `${(en / Math.max(1, who.maxEnergy)) * 100}%`);
      this.enText.textContent = `${fmt(en)}${who === cur && v.ui.spent ? ` · itens −${v.ui.spent}` : ""}`;
      const full = who.fury >= 200;
      this.gauge.classList.toggle("gauge--reborn", this.drawDander(who.fury, full));
      if (full) this.gauge.setAttribute("data-full", ""); else this.gauge.removeAttribute("data-full");
      this.gauge.style.setProperty("--pressure", String(who.fury / 200)); this.gaugeLabel.textContent = `Pressão ${Math.round(who.fury / 2)}%${v.ui.special ? " · ESTOURO" : ""}`;
    }
    this.power.style.setProperty("--power", `${v.ui.power}%`);
    const last = lastShotMarker(v.lastShot);
    this.power.style.setProperty("--last", `${last?.power ?? 0}%`);
    el<HTMLElement>(this.power, ".power__history").hidden = last === null;
    const previousNeedle = el<HTMLElement>(this.angle, ".dial__last");
    previousNeedle.hidden = last === null;
    if (last) this.angle.style.setProperty("--last-angle", `${last.angle}deg`);
    if (cur) {
      const range = v.aimRange;
      // Conic gradients começam em cima e crescem no sentido horário.
      const start = cur.facing === 1 ? 90 - range.max : 270 + range.min;
      this.angle.style.setProperty("--range-start", `${start}deg`);
      this.angle.style.setProperty("--range-size", `${range.max - range.min}deg`);
    }
    this.angle.style.setProperty("--angle", `${dialAngle(v.ui.angle, cur?.facing ?? 1)}deg`); this.angleVal.textContent = `${Math.round(v.ui.angle)}°`;
    const mine = !me || me === cur?.id;
    for (const k of KEYS) {
      // itens valem também enquanto carrega a força (Reborn); só o primeiro tiro os encerra
      const d = this.slots.get(k)!, n = v.ui.used[k] ?? 0, can = mine && !v.ui.fired && (cur?.energy ?? 0) >= ITEMS[k].cost && !(k === "2" && v.ui.triple) && !(k === "F" && (v.ui.fly || v.ui.flyCooldown));
      d.classList.toggle("is-off", !can); if (n) d.setAttribute("aria-selected", "true"); else d.removeAttribute("aria-selected");
      this.counts.get(k)!.textContent = n > 1 ? `×${n}` : "";
      // PropCell: ao escolher, o ícone cresce 1,2× e sobe 3,6 px por um instante
      d.classList.toggle("is-pressed", v.ui.pressed?.key === k && performance.now() - v.ui.pressed.at < 180);
    }
    this.estouro.classList.toggle("is-off", !mine || (cur?.fury ?? 0) < 200);
    this.estouro.classList.toggle("is-ready", mine && (cur?.fury ?? 0) >= 200 && !v.ui.fired); if (v.ui.special) this.estouro.setAttribute("aria-selected", "true"); else this.estouro.removeAttribute("aria-selected");
    this.blue.textContent = `${alive.filter(c => c.team === 1).length} vivos`; this.red.textContent = `${alive.filter(c => c.team !== 1).length} vivos`;
    el<HTMLButtonElement>(this.root, ".passbtn").disabled = v.ui.power > 0;
    this.drawMinimap();
    if (v.hud.over) { this.banner.hidden = false; el<HTMLElement>(this.banner, "span").textContent = v.hud.winner === null ? "Empate" : `Time ${v.hud.winner === 1 ? "Azul" : "Vermelho"} venceu!`; }
    else this.banner.hidden = true;
  }

  private drawMinimap(): void {
    const v = this.view, c = this.mini.getContext("2d")!, w = this.mini.width, h = this.mini.height;
    c.clearRect(0, 0, w, h); c.fillStyle = "#0c1130"; c.fillRect(0, 0, w, h);
    const t = miniTransform(v.width, v.height, w, h);
    c.drawImage(v.terrainCanvas, 0, 0, v.width, v.height, t.x, t.y, t.width, t.height);
    for (const ch of v.chars.values()) if (ch.alive) {
      const point = mapToMini(t, ch.x, ch.y); c.fillStyle = ch.team === 1 ? "#4a90ff" : "#ff5a47";
      c.beginPath(); c.arc(point.x, point.y - 2, 3, 0, 7); c.fill();
    }
    if (v.current && this.measureX !== null) {
      const x0 = mapToMini(t, v.current.x, 0).x, x1 = mapToMini(t, this.measureX, 0).x, y = Math.min(h - 8, t.y + t.height - 10);
      c.strokeStyle = "#ffe279"; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
      c.fillStyle = "#fff"; c.font = "bold 12px sans-serif"; c.fillText(`${(Math.abs(this.measureX - v.current.x) / 100).toFixed(1)} un`, Math.max(2, Math.min(w - 52, x1 - 20)), Math.max(12, y - 5));
    }
    const camera = mapToMini(t, v.camX, v.camY);
    c.strokeStyle = "#fff6e0"; c.lineWidth = 2; c.strokeRect(camera.x, camera.y, Math.min(VIEW_W, v.width) * t.scale, Math.min(VIEW_H, v.height) * t.scale);
  }
}
