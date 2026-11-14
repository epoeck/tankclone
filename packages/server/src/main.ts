import { startServer } from "./server";
const port = Number(process.env.PORT ?? 8080);
const dbPath = process.env.DB_PATH ?? "tankclone.sqlite";
const staticDir = process.env.STATIC_DIR || undefined;
startServer({ port, dbPath, staticDir }).then(s => {
  console.log(`tankclone server em ws://localhost:${s.port} (banco: ${dbPath})`);
  if (staticDir) console.log(`jogo em http://localhost:${s.port}/play.html (arquivos: ${staticDir})`);
  let closing = false;
  const stop = (sig: string) => {
    if (closing) return;
    closing = true;
    console.log(`${sig}: encerrando (fechando conexões e o banco)...`);
    const force = setTimeout(() => process.exit(1), 5000);
    force.unref();
    s.close().then(() => { console.log("servidor encerrado"); process.exit(0); });
  };
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(sig, () => stop(sig));
});
