/** Sons de interface sintetizados e sons de projéteis da referência. Tecla M liga/desliga. */
export type SfxName = "shoot" | "boom" | "hit" | "item" | "turn" | "death" | "win" | "lose"
  | "tick" | "alert" | "whistle" | "turnChange" | "pass" | "angle" | "charge" | "release" | "steps" | "gameEnd"
  | "click" | "useItem" | "cardFlip";

/** Sons do Reborn (só locais, gitignored): public/sfx-local/<id>.ogg. Ids do original; sem o arquivo, usa o som sintetizado. */
export const LOCAL_SFX: Partial<Record<SfxName, string>> = {
  tick: "014", alert: "067", whistle: "016", turnChange: "038", pass: "008", angle: "006", charge: "020", release: "019",
  steps: "044", gameEnd: "040", win: "063", lose: "064",
  // 008: clique de botão (escolher item, carta); 039: usar item (GamePlayer.doUseItemAnimation); 048: virar carta (LuckyCard.play)
  click: "008", useItem: "039", cardFlip: "048",
};
const files = new Map<string, { audio: HTMLAudioElement; ok: boolean }>();
const playing = new Map<string, HTMLAudioElement>();
function localFile(id: string): { audio: HTMLAudioElement; ok: boolean } | null {
  if (typeof Audio === "undefined") return null;
  let f = files.get(id);
  if (!f) {
    const audio = new Audio(`/sfx-local/${id}.ogg`); audio.preload = "auto";
    f = { audio, ok: false }; files.set(id, f);
    const entry = f; audio.addEventListener("canplaythrough", () => { entry.ok = true; }, { once: true });
    audio.addEventListener("error", () => { entry.ok = false; }, { once: true });
  }
  return f;
}
/** Toca o arquivo local, se existir. `stops` interrompe outro som antes (ex.: 019 para o 020). */
function playLocal(name: SfxName, stops?: SfxName): boolean {
  const id = LOCAL_SFX[name]; if (!id || muted) return false;
  if (stops) { const prev = playing.get(stops); if (prev) { prev.pause(); playing.delete(stops); } }
  const f = localFile(id); if (!f?.ok) return false;
  // Reborn toca o 020 sem reiniciar enquanto ele ainda está tocando (um som contínuo, não um a cada passo da barra)
  if (name === "charge" && playing.has(name)) return true;
  const prev = playing.get(name); if (prev && (name === "alert" || name === "tick")) prev.pause();
  const a = f.audio.cloneNode() as HTMLAudioElement; playing.set(name, a);
  a.addEventListener("ended", () => { if (playing.get(name) === a) playing.delete(name); }, { once: true });
  void a.play().catch(() => { /* bloqueado antes da primeira interação */ });
  return true;
}
export function stopSfx(name: SfxName): void { const p = playing.get(name); if (p) { p.pause(); playing.delete(name); } }
/** Pré-carrega os arquivos locais (chamar ao abrir a partida). */
export function preloadLocalSfx(): void { for (const id of Object.values(LOCAL_SFX)) localFile(id); }

let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem("ddclank.muted") === "1"; } catch { /* sem storage: segue com som */ }

function ac(): AudioContext | null {
  if (muted) return null;
  try { ctx ??= new AudioContext(); if (ctx.state === "suspended") void ctx.resume(); return ctx; } catch { return null; }
}

export function toggleMute(): boolean {
  muted = !muted;
  if (muted) for (const audio of activeProjectileSounds) { audio.pause(); activeProjectileSounds.delete(audio); }
  try { localStorage.setItem("ddclank.muted", muted ? "1" : "0"); } catch { /* ignora */ }
  return muted;
}
export const isMuted = () => muted;

function tone(c: AudioContext, type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.15, delay = 0) {
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}

function noise(c: AudioContext, dur: number, vol: number, f0: number, f1: number) {
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
  src.buffer = buf; f.type = "lowpass"; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}

export function sfx(name: SfxName): void {
  if (playLocal(name, name === "release" ? "charge" : undefined)) return;
  const c = ac(); if (!c) return;
  switch (name) {
    case "tick": tone(c, "square", 1200, 1200, 0.03, 0.05); break;
    case "alert": tone(c, "square", 1600, 1500, 0.07, 0.09); break;
    case "whistle": tone(c, "sine", 1800, 2300, 0.12, 0.14); tone(c, "sine", 1800, 2300, 0.2, 0.14, 0.15); break;
    case "turnChange": tone(c, "sine", 440, 440, 0.1, 0.08); break;
    case "pass": tone(c, "square", 300, 200, 0.05, 0.1); break;
    case "angle": tone(c, "square", 900, 900, 0.015, 0.04); break;
    case "charge": tone(c, "triangle", 400, 500, 0.04, 0.05); break;
    case "release": break;
    case "click": tone(c, "square", 700, 600, 0.03, 0.06); break;
    case "useItem": tone(c, "triangle", 660, 990, 0.12, 0.12); break;
    case "cardFlip": noise(c, 0.12, 0.2, 4000, 800); break;
    case "steps": tone(c, "triangle", 150, 100, 0.04, 0.06); break;
    case "gameEnd": tone(c, "sine", 392, 392, 0.3, 0.1); break;
    case "shoot": noise(c, 0.18, 0.25, 3000, 300); tone(c, "sawtooth", 220, 60, 0.2, 0.12); break;
    case "boom": noise(c, 0.6, 0.45, 1800, 80); tone(c, "sine", 110, 30, 0.5, 0.3); break;
    case "hit": tone(c, "square", 520, 180, 0.12, 0.12); break;
    case "item": tone(c, "triangle", 660, 660, 0.08, 0.15); tone(c, "triangle", 990, 990, 0.12, 0.15, 0.07); break;
    case "turn": tone(c, "sine", 523, 523, 0.15, 0.12); tone(c, "sine", 784, 784, 0.25, 0.12, 0.12); break;
    case "death": tone(c, "sawtooth", 400, 50, 0.6, 0.15); break;
    case "win": [523, 659, 784, 1047].forEach((f, i) => tone(c, "triangle", f, f, 0.25, 0.15, i * 0.12)); break;
    case "lose": [392, 330, 262, 196].forEach((f, i) => tone(c, "triangle", f, f, 0.3, 0.13, i * 0.15)); break;
  }
}

/** Sons das bolas do seed Ball da referência; veja docs/projeteis.md. */
const projectileSounds: Record<string, [[string, string], [string, string]]> = {
  fly: [["023", "096"], ["023", "096"]],
  prism: [["023", "087"], ["069", "088"]],
  furnace: [["025", "087"], ["083", "088"]],
  sledge: [["116", "107"], ["113", "105"]],
};
const activeProjectileSounds = new Set<HTMLAudioElement>();
const soundTemplates = new Map<string, HTMLAudioElement>();
if (typeof Audio !== "undefined") for (const pairs of Object.values(projectileSounds)) for (const pair of pairs) for (const id of pair) {
  if (!soundTemplates.has(id)) { const audio = new Audio(`/projectiles/sounds/${id}.${id === "096" ? "wav" : "mp3"}`); audio.preload = "auto"; soundTemplates.set(id, audio); }
}
export function projectileSfx(weapon: string, special: boolean, impact: boolean): void {
  if (muted || typeof Audio === "undefined") return;
  const id = (projectileSounds[weapon] ?? projectileSounds.sledge)![special ? 1 : 0][impact ? 1 : 0];
  const audio = soundTemplates.get(id)!.cloneNode() as HTMLAudioElement;
  activeProjectileSounds.add(audio);
  audio.addEventListener("ended", () => activeProjectileSounds.delete(audio), { once: true });
  void audio.play().catch(() => { activeProjectileSounds.delete(audio); /* reprodução pode ser bloqueada antes de interação */ });
}
