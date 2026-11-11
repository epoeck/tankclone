/** Cliente de rede: login → saguão → sala → partida. O servidor decide tudo; aqui só enviamos intenções e animamos eventos. */
import { BUILDS, COUNTS, HAIR_COLORS, MAPS, SKIN_TONES, WEAPONS, type Look, type MatchEvent } from "@tankclone/core";
import type { ClientMsg, MatchSetup, RoomInfo, ServerMsg } from "../../server/src/protocol";
import { drawCharPortrait as drawPortrait } from "./chars";
import { loadClientMaps } from "./maps";
import { Hud } from "./hud";
import { Controls, MatchView, VIEW_H, VIEW_W } from "./view";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const screens = ["s-login", "s-lobby", "s-wardrobe", "s-room", "match"];
const show = (id: string) => screens.forEach(s => $(s).classList.toggle("on", s === id));
const toast = (msg: string) => { const t = $("toast"); t.textContent = msg; t.hidden = false; setTimeout(() => (t.hidden = true), 3500); };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };

// ---------- conexão ----------
const param = new URLSearchParams(location.search).get("server");
const url = param ?? (location.protocol === "https:" ? `wss://${location.host}` : `ws://${location.hostname}:8080`);
let ws: WebSocket;
const handlers: Array<(m: ServerMsg) => void> = [];
const send = (m: ClientMsg) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
function connect() {
  ws = new WebSocket(url);
  ws.onopen = () => { $("conn").textContent = "servidor online"; };
  ws.onclose = () => { $("conn").textContent = "desconectado; tentando de novo…"; setTimeout(connect, 2000); if (me) { me = null; show("s-login"); toast("conexão perdida"); } };
  ws.onmessage = e => { let m: ServerMsg; try { m = JSON.parse(e.data as string); } catch { return; } onMsg(m); };
}
connect();

// ---------- estado ----------
let me: { nick: string; level: number; xp: number; unlocks: string[]; look: Look } | null = null;
let room: RoomInfo | null = null;
let view: MatchView | null = null;
let controls: Controls | null = null;
let hud: Hud | null = null;
let endInfo: Record<string, { gained: number; level: number }> | null = null;

function startMatch(setup: MatchSetup, events: MatchEvent[]) {
  view = new MatchView(setup.mapId, setup.players);
  view.me = me?.nick ?? null;
  view.push(events);
  show("match");
  controls ??= new Controls(view, () => view?.hud.player === me?.nick, i => send({ t: "intent", intent: i } as unknown as ClientMsg));
  controls.view = view;
  hud = new Hud($("hud"), view, () => me?.nick ?? null, k => { if (view?.canAct && view.hud.player === me?.nick) send({ t: "intent", intent: { type: "item", key: k } } as unknown as ClientMsg); });
}

function onMsg(m: ServerMsg) {
  handlers.forEach(h => h(m));
  switch (m.t) {
    case "authOk": me = { nick: m.nick, level: m.level, xp: m.xp, unlocks: m.unlocks, look: m.look }; renderMe(); if ($("s-login").classList.contains("on")) { show("s-lobby"); send({ t: "rooms" }); } break;
    case "error": toast(m.msg); break;
    case "rooms": renderRooms(m.rooms); break;
    case "room": room = m.room; if (room) { if (!view) { renderRoom(); show("s-room"); } } else { show("s-lobby"); send({ t: "rooms" }); } break;
    case "start": startMatch(m.setup, m.events); break;
    case "resume": startMatch(m.setup, m.events); break;
    case "events": view?.push(m.events); break;
    case "chat": addChat(m.scope, m.from, m.text); break;
    case "end": {
      endInfo = m.xp;
      const mine = me ? m.xp[me.nick] : undefined;
      toast(mine ? `+${mine.gained} XP · nível ${mine.level}` : "partida encerrada");
      setTimeout(() => { view = null; show(room ? "s-room" : "s-lobby"); if (room) renderRoom(); }, 4000);
      break;
    }
  }
}

// ---------- chat (só textContent; nada de innerHTML com texto de outros jogadores) ----------
function addChat(scope: "room" | "lobby", from: string, text: string) {
  const log = $(scope === "room" ? "chat-room" : "chat-lobby");
  const line = el("span"); line.append(el("b", from + ": "), document.createTextNode(text));
  log.append(line);
  while (log.childElementCount > 100) log.firstElementChild!.remove();
  log.scrollTop = log.scrollHeight;
}
for (const id of ["lobby", "room"]) {
  const input = $<HTMLInputElement>(`chat-${id}-in`);
  input.addEventListener("keydown", e => { if (e.key === "Enter" && input.value.trim()) { send({ t: "chat", text: input.value }); input.value = ""; } });
}

// ---------- login ----------
const auth = (mode: "login" | "register") => send({ t: "auth", mode, nick: $<HTMLInputElement>("nick").value.trim(), password: $<HTMLInputElement>("pass").value });
$("login-form").addEventListener("submit", e => { e.preventDefault(); auth("login"); });
$("btn-register").onclick = () => auth("register");

// ---------- saguão ----------
const fillMaps = () => { const sel = $("new-map"); sel.replaceChildren(); for (const [id, def] of Object.entries(MAPS)) { const o = el("option", def.name + (def.indestructible ? " (chão firme)" : "")); o.value = id; sel.append(o); } };
fillMaps();
void loadClientMaps().then(fillMaps);
$("btn-refresh").onclick = () => send({ t: "rooms" });
$("btn-create").onclick = () => send({ t: "createRoom", mapId: $<HTMLSelectElement>("new-map").value, maxPlayers: +$<HTMLSelectElement>("new-max").value });
$("btn-wardrobe").onclick = () => { renderWardrobe(); show("s-wardrobe"); };
$("btn-wardrobe-back").onclick = () => show(room ? "s-room" : "s-lobby");
function renderMe() {
  if (!me) return;
  $("me-nick").textContent = me.nick; $("me-level").textContent = `Nv ${me.level}`;
  $("me-unlocks").textContent = me.unlocks.length ? `liberado: ${me.unlocks.join(", ")}` : "";
  drawPortrait($("portrait-mini") as HTMLCanvasElement, me.look);
}
function renderRooms(rooms: RoomInfo[]) {
  const tb = $("rooms"); tb.replaceChildren();
  if (!rooms.length) { const tr = el("tr"); const td = el("td", "Nenhuma sala. Crie a primeira!"); td.colSpan = 4; tr.append(td); tb.append(tr); }
  for (const r of rooms) {
    const tr = el("tr");
    tr.append(el("td", r.id), el("td", MAPS[r.mapId]?.name ?? r.mapId), el("td", `${r.players.length}/${r.maxPlayers}`));
    const b = el("button", "Entrar", "btn btn--sm"); b.onclick = () => send({ t: "joinRoom", roomId: r.id });
    const td = el("td"); td.append(b); tr.append(td); tb.append(tr);
  }
}

// ---------- vestiário ----------
function renderWardrobe() {
  if (!me) return;
  const host = $("wardrobe-opts"); host.replaceChildren();
  const apply = (mut: (l: Look) => void) => { const l = structuredClone(me!.look); mut(l); me!.look = l; send({ t: "setLook", look: l }); renderWardrobe(); renderMe(); };
  const numbers = (label: string, n: number, cur: number, set: (l: Look, i: number) => void, optional = false) => {
    const row = el("div", "", "opts"); row.append(el("span", label, "label"));
    for (let i = 0; i < n; i++) { const b = el("button", optional ? (i === 0 ? "—" : String(i)) : String(i + 1), "btn btn--sm btn--steel"); b.setAttribute("aria-pressed", String(i === cur)); b.onclick = () => apply(l => set(l, i)); row.append(b); }
    host.append(row);
  };
  const colors = (label: string, list: readonly string[], cur: number, set: (l: Look, i: number) => void) => {
    const row = el("div", "", "opts"); row.append(el("span", label, "label"));
    list.forEach((c, i) => { const b = el("button", "", "sw"); b.style.background = c; b.setAttribute("aria-label", `${label} ${i + 1}`); b.setAttribute("aria-pressed", String(i === cur)); b.onclick = () => apply(l => set(l, i)); row.append(b); });
    host.append(row);
  };
  const a = me.look.appearance, e = me.look.equipped;
  colors("Pele", SKIN_TONES, a.skin, (l, i) => (l.appearance.skin = i));
  numbers("Rosto", COUNTS.face, a.face, (l, i) => (l.appearance.face = i));
  numbers("Cabelo", COUNTS.hair, a.hair, (l, i) => (l.appearance.hair = i));
  colors("Cor do cabelo", HAIR_COLORS, a.hairColor, (l, i) => (l.appearance.hairColor = i));
  numbers("Roupa", COUNTS.outfit, e.outfit, (l, i) => (l.equipped.outfit = i));
  numbers("Chapéu", COUNTS.hat, e.hat, (l, i) => (l.equipped.hat = i), true);
  numbers("Óculos", COUNTS.glasses, e.glasses, (l, i) => (l.equipped.glasses = i), true);
  numbers("Asas", COUNTS.wings, e.wings, (l, i) => (l.equipped.wings = i), true);
  drawPortrait($("portrait") as HTMLCanvasElement, me.look);
}

// ---------- sala ----------
function renderRoom() {
  if (!room || !me) return;
  $("room-title").textContent = `Sala ${room.id} · ${MAPS[room.mapId]?.name ?? room.mapId}`;
  const box = $("members"); box.replaceChildren();
  for (const p of room.players) {
    const row = el("div", "", "paper row"); row.style.padding = "8px 12px";
    const cv = el("canvas"); cv.width = 48; cv.height = 64; drawPortrait(cv, p.look, p.weaponId);
    const name = el("div", "", "grow"); name.append(el("b", p.nick + (p.nick === room.host ? " ★" : "")), el("br"), el("small", `${WEAPONS[p.weaponId]?.name ?? p.weaponId} · build ${p.build}`, "muted"));
    row.append(cv, name, el("span", p.team === 1 ? "Time Azul" : "Time Vermelho", "chip"));
    box.append(row);
  }
  const w = $("weapons"); w.replaceChildren();
  for (const d of Object.values(WEAPONS)) { const b = el("button", d.name, "btn btn--sm btn--steel"); b.onclick = () => send({ t: "setLoadout", weaponId: d.id }); w.append(b); }
  const bl = $("builds"); bl.replaceChildren();
  for (const k of Object.keys(BUILDS)) { const b = el("button", k, "btn btn--sm btn--steel"); b.onclick = () => send({ t: "setLoadout", build: k }); bl.append(b); }
  $<HTMLButtonElement>("btn-start").hidden = room.host !== me.nick;
}
$("btn-leave").onclick = () => send({ t: "leaveRoom" });
$("btn-start").onclick = () => send({ t: "start" });
handlers.push(m => { if (m.t === "room" && m.room && !view) renderRoom(); });

// ---------- laço da partida ----------
const canvas = $<HTMLCanvasElement>("c"); canvas.width = VIEW_W; canvas.height = VIEW_H;
const ctx = canvas.getContext("2d")!;
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (view) { controls?.update(dt); view.update(dt); view.draw(ctx, me?.nick ?? null); hud?.update(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void endInfo;
