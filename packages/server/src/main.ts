import { startServer } from "./server";
const port = Number(process.env.PORT ?? 8080);
const dbPath = process.env.DB_PATH ?? "tankclone.sqlite";
startServer({ port, dbPath }).then(s => console.log(`tankclone server em ws://localhost:${s.port} (banco: ${dbPath})`));
