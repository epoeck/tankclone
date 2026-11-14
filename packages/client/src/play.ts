/** Cliente de rede: login → saguão → sala → partida. O servidor decide tudo; aqui só enviamos intenções e animamos eventos. */
import { MAPS, WEAPONS, type Look, type MatchEvent } from "@tankclone/core";
import type { ClientMsg, MatchSetup, RoomInfo, ServerMsg } from "../../server/src/protocol";
import { drawCharPortrait as drawPortrait } from "./chars";
import { loadClientMaps } from "./maps";
import { Hud } from "./hud";
import { EndScreen } from "./end-screen";
import { Controls } from "./controls";
import { MatchView, VIEW_H, VIEW_W } from "./view";
import { Wardrobe } from "./wardrobe";
import { Forge } from "./forge";
import { Bag } from "./bag";
import { Pets } from "./pets";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const screens = ["s-login", "s-lobby", "s-bag", "s-wardrobe", "s-forge", "s-pets", "s-room", "match"];
const show = (id: string) => screens.forEach(s => $(s).classList.toggle("on", s === id));
const toast = (msg: string) => { const t = $("toast"); t.textContent = msg; t.hidden = false; setTimeout(() => (t.hidden = true), 3500); };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };

// ---------- conexão ----------
const param = new URLSearchParams(location.search).get("server");
const url = param ?? (location.protocol === "https:" ? `wss://${location.host}` : `ws://${location.hostname}:8080`);
let ws: WebSocket;
const handlers: Array<(m: ServerMsg) => void> = [];
const send = (m: ClientMsg): boolean => { if (ws?.readyState !== WebSocket.OPEN) return false; ws.send(JSON.stringify(m)); return true; };
function connect() {
  ws = new WebSocket(url);
  ws.onopen = () => { $("conn").textContent = "servidor online"; };
  ws.onclose = () => { $("conn").textContent = "desconectado; tentando de novo…"; setTimeout(connect, 2000); if (me) { wardrobe.disconnect(); me = null; show("s-login"); toast("conexão perdida"); } };
  ws.onmessage = e => { let m: ServerMsg; try { m = JSON.parse(e.data as string); } catch { return; } onMsg(m); };
}
connect();

// ---------- estado ----------
let me: { nick: string; level: number; xp: number; gold?: number; unlocks: string[]; look: Look } | null = null;
let room: RoomInfo | null = null;
let view: MatchView | null = null;
let controls: Controls | null = null;
let hud: Hud | null = null;
let endInfo: Record<string, { gained: number; level: number }> | null = null;
let endPending = false;
let endCards = false, endWinner: number | null = null, endScreen: EndScreen | null = null;
const wardrobe = new Wardrobe($("s-wardrobe"), look => send({ t: "setLook", look }), m => send(m as unknown as ClientMsg));

function startMatch(setup: MatchSetup, events: MatchEvent[]) {
  wardrobe.disconnect();
  endPending = false;
  view = new MatchView(setup.mapId, setup.players);
  view.me = me?.nick ?? null;
  view.push(events);
  show("match");
  controls ??= new Controls(view, () => view?.hud.player === me?.nick, i => send({ t: "intent", intent: i } as unknown as ClientMsg));
  controls.view = view;
  hud = new Hud($("hud"), view, () => me?.nick ?? null, k => { if (view?.canAct && view.hud.player === me?.nick) send({ t: "intent", intent: { type: "item", key: k } } as unknown as ClientMsg); }, () => { if (view?.canAct && view.hud.player === me?.nick) send({ t: "intent", intent: { type: "pass" } } as unknown as ClientMsg); }, () => controls?.togglePow());
  hud.bindChat(text => send({ t: "chat", text }));
}

function onMsg(m: ServerMsg) {
  handlers.forEach(h => h(m));
  switch (m.t) {
    case "authOk": me = { nick: m.nick, level: m.level, xp: m.xp, gold: m.gold ?? 0, unlocks: m.unlocks, look: m.look }; renderMe(); wardrobe.confirm(m.look); bag.setLook(m.look); forge.setLook(m.look); if ($("s-login").classList.contains("on")) { show("s-lobby"); send({ t: "rooms" }); } break;
    case "error": toast(m.msg); wardrobe.fail(m.msg); forge.fail(m.msg); pets.fail(m.msg); break;
    case "rooms": renderRooms(m.rooms); break;
    case "room": { room = m.room; const away = $("s-wardrobe").classList.contains("on") || $("s-forge").classList.contains("on") || $("s-bag").classList.contains("on") || $("s-pets").classList.contains("on");
      if (room) { if (!view) { renderRoom(); if (!away) show("s-room"); } } else { if (!away) show("s-lobby"); send({ t: "rooms" }); } break; }
    case "start": startMatch(m.setup, m.events); break;
    case "resume": startMatch(m.setup, m.events); break;
    case "events": view?.push(m.events); break;
    case "chat": addChat(m.scope, m.from, m.text); if (m.scope === "room") hud?.addChat(m.from, m.text); break;
    case "end": {
      endInfo = m.xp;
      const mine = me ? m.xp[me.nick] : undefined;
      toast(mine ? `+${mine.gained} XP · nível ${mine.level}` : "partida encerrada");
      endPending = true; endCards = !!m.cards && !!mine; endWinner = m.winnerTeam;
      break;
    }
    case "bag": { if (me) { me.gold = m.gold; renderMe(); } forge.update(m); bag.update(m); pets.update(m); wardrobe.setItems(m.items); if (m.result) toast(m.result); break; }
    case "card": {
      if (me) { me.xp = m.xp; me.level = m.level; me.gold = m.gold; renderMe(); }
      const what = m.reward.kind === "gold" ? `+${m.reward.amount} gold` : `+${m.reward.amount} XP`;
      if (endScreen) endScreen.reveal(m.index, m.deck, m.auto, what); else toast(`Carta: ${what}`);
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
const updateMapPreview = () => {
  const def = MAPS[$<HTMLSelectElement>("new-map").value], img = $<HTMLImageElement>("new-map-preview");
  const file = def?.manifest?.thumbnail;
  img.hidden = !(file && def?.artBase); if (file && def?.artBase) img.src = def.artBase + file;
};
const fillMaps = () => { const sel = $("new-map"); sel.replaceChildren(); for (const [id, def] of Object.entries(MAPS)) { const o = el("option", def.name + (def.indestructible ? " (chão firme)" : "")); o.value = id; sel.append(o); } updateMapPreview(); };
$("new-map").addEventListener("change", updateMapPreview);
fillMaps();
void loadClientMaps().then(fillMaps);
$("btn-refresh").onclick = () => send({ t: "rooms" });
$("btn-create").onclick = () => send({ t: "createRoom", mapId: $<HTMLSelectElement>("new-map").value, maxPlayers: +$<HTMLSelectElement>("new-max").value });
const home = () => { show(room ? "s-room" : "s-lobby"); if (room) renderRoom(); };
function openWardrobe(back: () => void = home) {
  if (!me) return;
  show("s-wardrobe"); send({ t: "bag" });
  wardrobe.open(me.look, me.nick, back, room?.players.find(p => p.nick === me!.nick)?.weaponId);
}
const forge = new Forge($("s-forge"), m => send(m as unknown as ClientMsg), () => openBag());
function openForge(itemId?: number) {
  if (!me) return;
  show("s-forge"); forge.open(me.look, itemId);
}
const bag: Bag = new Bag($("s-bag"), m => send(m as unknown as ClientMsg), home, () => openWardrobe(() => openBag()), id => openForge(id), openPets);
const pets = new Pets($("s-pets"), m => send(m as unknown as ClientMsg), home);
function openBag() { if (!me) return; show("s-bag"); bag.open(me.look); }
function openPets() { if (!me) return; show("s-pets"); pets.open(); }
$("btn-bag").onclick = openBag;
$("btn-forge").onclick = () => openForge();
$("btn-room-forge").onclick = () => openForge();
$("btn-pets").onclick = openPets;
$("btn-room-pets").onclick = openPets;
$("btn-room-bag").onclick = openBag;
$("btn-wardrobe").onclick = () => openWardrobe();
$("btn-room-wardrobe").onclick = () => openWardrobe();
function renderMe() {
  if (!me) return;
  $("me-nick").textContent = me.nick; $("me-level").textContent = `Nv ${me.level} · ${me.xp} XP · ${(me.gold ?? 0).toLocaleString("pt-BR")} gold`;
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

// ---------- sala ----------
function renderRoom() {
  if (!room || !me) return;
  $("room-title").textContent = `Sala ${room.id} · ${MAPS[room.mapId]?.name ?? room.mapId}`;
  const box = $("members"); box.replaceChildren();
  for (const p of room.players) {
    const row = el("div", "", "paper row"); row.style.padding = "8px 12px";
    const cv = el("canvas"); cv.width = 48; cv.height = 64; drawPortrait(cv, p.look, p.weaponId);
    const name = el("div", "", "grow"); name.append(el("b", p.nick + (p.nick === room.host ? " ★" : "")), el("br"), el("small", `${WEAPONS[p.weaponId]?.name ?? p.weaponId} · equipamento equipado`, "muted"));
    row.append(cv, name, el("span", p.team === 1 ? "Time Azul" : "Time Vermelho", "chip"));
    if (p.bot && room.host === me.nick) { const x = el("button", "Remover", "btn btn--sm btn--steel"); x.onclick = () => send({ t: "removeBot", nick: p.nick }); row.append(x); }
    box.append(row);
  }
  $<HTMLButtonElement>("btn-start").hidden = room.host !== me.nick;
  $<HTMLButtonElement>("btn-bot").hidden = room.host !== me.nick;
}
$("btn-bot").onclick = () => send({ t: "addBot" });
$("btn-leave").onclick = () => send({ t: "leaveRoom" });
$("btn-start").onclick = () => send({ t: "start" });
handlers.push(m => { if (m.t === "room" && m.room && !view) renderRoom(); });

// ---------- laço da partida ----------
const canvas = $<HTMLCanvasElement>("c"); canvas.width = VIEW_W; canvas.height = VIEW_H;
const ctx = canvas.getContext("2d")!;
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (view) {
    controls?.update(dt); view.update(dt); view.draw(ctx, me?.nick ?? null); hud?.update();
    if (endPending && !view.busy && view.hud.over) {
      endPending = false; const finishedView = view;
      const myTeam = me ? view.chars.get(me.nick)?.team : undefined;
      const won = endWinner === null || myTeam === undefined ? null : endWinner === myTeam;
      const back = () => { endScreen = null; if (view !== finishedView) return; view = null; show(room ? "s-room" : "s-lobby"); if (room) renderRoom(); };
      endScreen = new EndScreen(document.querySelector("#match .stage") as HTMLElement, won, endCards, i => send({ t: "pickCard", index: i }), back);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void endInfo;
