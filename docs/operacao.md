# Operação do servidor (PC do dono)

Requisitos: Node ≥ 22.5 (usa `node:sqlite`; o Node 24 do PC serve). O banco é um arquivo SQLite; não há serviço externo.

```bash
npm install
npm run start -w @tankclone/server          # ws://localhost:8080 ; PORT e DB_PATH por variável de ambiente
```

## Um clique pelo menu de apps (jeito mais fácil)
`scripts/ddclank.sh` faz tudo: acha o Node do nvm, roda `npm install` e a build do cliente só quando algo mudou, e sobe o
servidor servindo **o jogo e o WebSocket na mesma porta** (`STATIC_DIR=packages/client/dist`), com o banco em
`data/tankclone.sqlite` e o log em `data/server.log`. Depois abre o navegador em `http://localhost:8080/play.html`.

```bash
scripts/ddclank.sh            # liga (se já estiver ligado, só abre o navegador)
scripts/ddclank.sh parar      # desliga com calma: fecha conexões e o banco (SIGTERM)
scripts/ddclank.sh reiniciar  # aplica código novo (install/build se preciso) e liga de novo
scripts/ddclank.sh status
scripts/ddclank.sh log
```
No menu do KDE: **DDClank** liga (e reinicia sozinho com código novo se ninguém estiver conectado); clique direito → **Reiniciar servidor** ou **Desligar servidor** (ou o item **DDClank — desligar servidor**).
Os atalhos ficam em `~/.local/share/applications/ddclank.desktop` e `ddclank-parar.desktop`.
Com o servidor servindo o cliente, o mesmo túnel (`cloudflared tunnel --url http://localhost:8080`) entrega o jogo e o
`wss://` para os amigos.

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

## Segurança (antes de abrir na internet)
- **IP real atrás do Cloudflare:** o servidor lê `CF-Connecting-IP` **somente** quando a conexão chega do loopback (o `cloudflared` roda na mesma máquina e conecta em `localhost`). Conexões diretas de outros IPs usam o endereço do socket e o header é ignorado. Não exponha a porta 8080 diretamente na internet: deixe só o túnel (firewall bloqueando a porta externa).
- **Login:** 5 falhas em 10 min (por IP e por apelido) bloqueiam por 60 s; a espera dobra a cada novo bloqueio, até 1 h. Cadastros: 3 por hora por IP. O hash de senha é `scrypt` assíncrono (não trava o servidor).
- Erros inesperados em mensagens e no relógio das partidas são registrados no log (stderr) e não derrubam o processo; quem enviou recebe "erro interno".
- Tabelas de dados (itens, armas, builds, mapas) são consultadas só por chave própria (`own()`); chaves como `constructor` ou `__proto__` são recusadas.

## Limites embutidos
Mensagem ≤ 4 KB, ~30 mensagens/s por conexão, 200 conexões, 8 jogadores por sala. O teste `carga` abre 20 conexões em 4 salas.
