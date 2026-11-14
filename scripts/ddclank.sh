#!/usr/bin/env bash
# Liga/desliga o DDClank no PC do dono: compila o cliente se preciso, sobe o servidor
# (WebSocket + arquivos do jogo na mesma porta) e abre o navegador em play.html.
#   ddclank.sh [iniciar]   liga (ou só abre o navegador se já estiver ligado)
#   ddclank.sh parar       desliga com calma (fecha conexões e o banco)
#   ddclank.sh reiniciar   desliga, aplica o código novo (install/build se preciso) e liga de novo
#   ddclank.sh status      diz se está ligado
#   ddclank.sh log         abre o log do servidor
set -u
ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
PORT="${PORT:-8080}"
DATA="$ROOT/data"
PIDFILE="$DATA/server.pid"
LOG="$DATA/server.log"
URL="http://localhost:$PORT/play.html"
mkdir -p "$DATA"

avisar() { # título, texto
  echo "$1: $2"
  command -v notify-send >/dev/null && notify-send -a DDClank -i "$ROOT/packages/client/public/assets/brand/mark.svg" "$1" "$2" 2>/dev/null || true
}
falhar() { avisar "DDClank não ligou" "$1"; exit 1; }

achar_node() {
  if command -v node >/dev/null; then return; fi
  local d
  d="$(ls -d "$HOME"/.nvm/versions/node/v*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$d" ] && export PATH="$d:$PATH"
  command -v node >/dev/null || falhar "Node não encontrado (instale com nvm: nvm install 24)."
  node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=5)?0:1)' || falhar "Node $(node -v) é antigo; precisa ≥ 22.5."
}

pid_vivo() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }
porta_ok() { (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; }

parar() {
  if ! pid_vivo; then rm -f "$PIDFILE"; echo "DDClank já estava desligado."; return 0; fi
  local pid; pid="$(cat "$PIDFILE")"
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid"
  for _ in $(seq 1 60); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done
  if kill -0 "$pid" 2>/dev/null; then kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid"; fi
  rm -f "$PIDFILE"
  avisar "DDClank desligado" "Servidor encerrado; partidas em andamento foram fechadas."
}

# Verdadeiro se algum código/arquivo do jogo é mais novo que o início do servidor em execução.
desatualizado() {
  [ -f "$PIDFILE" ] || return 1
  [ -n "$(find "$ROOT"/package-lock.json "$ROOT"/packages/*/src "$ROOT"/packages/*/package.json "$ROOT"/packages/client/public "$ROOT"/packages/client/*.html -newer "$PIDFILE" -type f -print -quit 2>/dev/null)" ]
}
conexoes() { ss -tnH state established "( sport = :$PORT )" 2>/dev/null | wc -l; }

precisa() { # alvo, fontes...  → verdadeiro se o alvo falta ou alguma fonte é mais nova
  local alvo="$1"; shift
  [ -e "$alvo" ] || return 0
  [ -n "$(find "$@" -newer "$alvo" -type f -print -quit 2>/dev/null)" ]
}

iniciar() {
  if pid_vivo && porta_ok; then
    if desatualizado; then
      if [ "$(conexoes)" -eq 0 ]; then avisar "DDClank" "Código novo encontrado; reiniciando o servidor..."; parar >/dev/null; iniciar; return; fi
      avisar "DDClank: atualização pendente" "Tem código novo, mas há jogadores conectados. Quando puder: menu → DDClank → Reiniciar servidor."
    fi
    xdg-open "$URL" >/dev/null 2>&1 & return 0
  fi
  porta_ok && falhar "A porta $PORT já está em uso por outro programa."
  achar_node
  cd "$ROOT" || exit 1
  if precisa node_modules/.package-lock.json package-lock.json package.json packages/*/package.json; then
    avisar "DDClank" "Instalando dependências (só na primeira vez)..."
    npm install --no-audit --no-fund >>"$LOG" 2>&1 || falhar "npm install falhou; veja $LOG"
  fi
  local dist="$ROOT/packages/client/dist/play.html"
  if precisa "$dist" packages/client/src packages/client/public packages/client/*.html packages/client/vite.config.ts packages/core/src; then
    npm run build -w @tankclone/client >>"$LOG" 2>&1 || falhar "a build do cliente falhou; veja $LOG"
  fi
  echo "=== $(date '+%F %T') ligando na porta $PORT ===" >>"$LOG"
  PORT="$PORT" DB_PATH="$DATA/tankclone.sqlite" STATIC_DIR="$ROOT/packages/client/dist" \
    setsid "$ROOT/node_modules/.bin/tsx" packages/server/src/main.ts >>"$LOG" 2>&1 < /dev/null &
  echo $! > "$PIDFILE"
  for _ in $(seq 1 100); do porta_ok && break; pid_vivo || break; sleep 0.1; done
  porta_ok || { rm -f "$PIDFILE"; falhar "o servidor não respondeu; veja $LOG"; }
  xdg-open "$URL" >/dev/null 2>&1 &
  avisar "DDClank ligado" "Jogo em $URL. Para desligar: menu de apps → DDClank → Desligar servidor."
}

case "${1:-iniciar}" in
  iniciar|start) iniciar ;;
  parar|stop) parar ;;
  reiniciar|restart) parar >/dev/null; iniciar ;;
  status) if pid_vivo && porta_ok; then echo "ligado (pid $(cat "$PIDFILE")) em $URL"; else echo "desligado"; exit 1; fi ;;
  log) xdg-open "$LOG" >/dev/null 2>&1 & ;;
  *) echo "uso: $0 [iniciar|parar|reiniciar|status|log]"; exit 2 ;;
esac
