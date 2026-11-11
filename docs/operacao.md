# Operação do servidor (PC do dono)

Requisitos: Node ≥ 22.5 (usa `node:sqlite`; o Node 24 do PC serve). O banco é um arquivo SQLite; não há serviço externo.

```bash
npm install
npm run start -w @tankclone/server          # ws://localhost:8080 ; PORT e DB_PATH por variável de ambiente
```

## Reinício automático (systemd de usuário)
`~/.config/systemd/user/tankclone.service`:
```ini
[Unit]
Description=tankclone server
After=network-online.target

[Service]
WorkingDirectory=/run/media/bazzite/5c30424f-a21c-4799-94ee-89c1ba8949f0/tankclone
Environment=PORT=8080 DB_PATH=/run/media/bazzite/5c30424f-a21c-4799-94ee-89c1ba8949f0/tankclone/data/tankclone.sqlite
ExecStart=/usr/bin/npm run start -w @tankclone/server
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```
`systemctl --user daemon-reload && systemctl --user enable --now tankclone` e, para subir sem login, `loginctl enable-linger $USER`.
(Bazzite/Fedora Atomic: se preferir Podman, rode a mesma linha de comando num contêiner `node:24` com a pasta montada.)

## Link público (Cloudflare Tunnel)
```bash
cloudflared tunnel --url http://localhost:8080        # link temporário *.trycloudflare.com para testes
```
Para um endereço fixo: `cloudflared tunnel login`, `tunnel create tankclone`, `tunnel route dns` e `tunnel run`. O túnel
carrega WebSocket sem configuração extra. O cliente web (build do `packages/client`) pode ser servido pelo mesmo túnel
com qualquer servidor estático e conectar em `wss://<seu-host>`.

## Backup do banco
`Db.backupTo(arquivo)` faz uma cópia consistente (`VACUUM INTO`). Exemplo diário (cron/systemd timer):
```bash
sqlite3 data/tankclone.sqlite "VACUUM INTO 'backup/tankclone-$(date +%F).sqlite'"
```
O git não versiona o banco; copie `backup/` para outro disco ou nuvem.

## Limites embutidos
Mensagem ≤ 4 KB, ~30 mensagens/s por conexão, 200 conexões, 8 jogadores por sala. O teste `carga` abre 20 conexões em 4 salas.
