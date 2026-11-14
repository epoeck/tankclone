import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../src/server";

let srv: Awaited<ReturnType<typeof startServer>>;
let dir: string;
const get = (p: string) => fetch(`http://127.0.0.1:${srv.port}${p}`);

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "tank-static-"));
  mkdirSync(join(dir, "dist", "assets"), { recursive: true });
  writeFileSync(join(dir, "dist", "play.html"), "<p>jogo</p>");
  writeFileSync(join(dir, "dist", "assets", "a.js"), "1");
  writeFileSync(join(dir, "segredo.txt"), "não");
  srv = await startServer({ staticDir: join(dir, "dist"), log: () => {} });
});
afterAll(async () => { await srv.close(); rmSync(dir, { recursive: true, force: true }); });

describe("arquivos estáticos", () => {
  it("serve play.html na raiz e com tipo certo", async () => {
    const r = await get("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(await r.text()).toBe("<p>jogo</p>");
    expect((await get("/assets/a.js")).headers.get("content-type")).toContain("javascript");
  });
  it("recusa sair da pasta e dá 404 no que não existe", async () => {
    expect((await get("/../segredo.txt")).status).not.toBe(200);
    expect((await get("/%2e%2e/segredo.txt")).status).not.toBe(200);
    expect((await get("/assets/..%2f..%2fsegredo.txt")).status).not.toBe(200);
    expect((await get("/nada.html")).status).toBe(404);
  });
});
