/** Sons provisórios sintetizados com WebAudio (sem arquivos). Troque por áudio real mantendo os nomes. Tecla M liga/desliga. */
export type SfxName = "shoot" | "boom" | "hit" | "item" | "turn" | "death" | "win" | "lose";

let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem("ddclank.muted") === "1"; } catch { /* sem storage: segue com som */ }

function ac(): AudioContext | null {
  if (muted) return null;
  try { ctx ??= new AudioContext(); if (ctx.state === "suspended") void ctx.resume(); return ctx; } catch { return null; }
}

export function toggleMute(): boolean {
  muted = !muted;
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
  const c = ac(); if (!c) return;
  switch (name) {
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
