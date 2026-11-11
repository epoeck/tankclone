/** Arquivos estáticos da build do cliente (packages/client/dist), servidos pela mesma porta do WebSocket. */
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".bin": "application/octet-stream",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
};

/** Cria um handler HTTP que serve `dir`; `/` vai para `/play.html`. Recusa caminhos fora da pasta. */
export function staticHandler(dir: string) {
  const root = resolve(dir);
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
    let path: string;
    try { path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname); } catch { res.writeHead(400); res.end(); return; }
    if (path === "/") path = "/play.html";
    const file = resolve(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error("não é arquivo");
      const body = await readFile(file);
      const hashed = path.startsWith("/assets/");
      res.writeHead(200, {
        "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
        "content-length": body.length,
        "cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
        "x-content-type-options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("não encontrado");
    }
  };
}
