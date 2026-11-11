# tankclone — documento de desenvolvimento

Documento de handoff: descreve o objetivo, o que já foi feito, as decisões, as suposições em aberto e o plano
detalhado das próximas fases. Escrito para que outro agente (ou pessoa) continue sem depender do histórico da conversa.
Idioma do projeto e da comunicação com o dono: **português (pt-BR)**.

---

## 1. Objetivo e restrições

Clone **jogável por ~20 pessoas** do jogo **DDTank** (artilharia por turnos 2D, estilo Gunbound), com o servidor
hospedado no PC do dono do projeto.

- **Idêntico ao original:** jogabilidade (mira por ângulo + força, vento, terreno destrutível, turnos) e o **cálculo de
  stats** (ATK, dano, armadura, DEF, agilidade, stamina/HP, sorte, etc.).
- **Original / diferente:** toda a arte, nomes, sons, UI. Será feita pelo dono e pelos amigos (só eles fazem arte; **só o dono programa**).
- Fidelidade **não precisa ser exata**: "mesmos stats e sensação de jogo", não bit-a-bit.
- **Não copiar código vazado do DDTank** (o código do servidor circula em fóruns/GitHub). É propriedade da 7Road;
  copiar para o clone é violação de direitos autorais. Fórmulas/números vindos de wikis, guias de jogadores e
  medições são aceitáveis; trechos de código vazado não. Se o dono sugerir usar o código vazado, avisar do risco e
  preferir reimplementar a partir de descrições.
- Não usar nome, logo, sprites, sons ou textos do DDTank no produto.

## 2. Estado atual (o que existe e funciona)

| Item | Estado |
|---|---|
| Monorepo TypeScript (npm workspaces) | pronto |
| `core`: física do projétil (gravidade + arrasto linear + vento) | pronto, **calibrada** contra tabelas da comunidade |
| `core`: terreno destrutível (máscara de bits + crateras circulares) | pronto |
| `core`: ferramenta de calibração (ajuste por Nelder-Mead, erro em pontos de força) | pronto |
| `core`: testes (vitest) | **23 passando**, typecheck limpo |
| `client`: visualizador web de trajetória (Vite + canvas 2D) | pronto, testado no navegador |
| Calibração do **vento** | **NÃO feita** (`windAccel: 8` é chute) |
| Stats / dano / defesa / agilidade | **não começado** |
| Turnos / partida / HP / queda de personagens | **não começado** |
| Servidor (rede, salas, contas) | **não começado** |
| Arte, UI, som | **não começado** |
| Git | **não inicializado** (`git init` ainda não rodou) |

## 3. Localização, requisitos e comandos

- Pasta: `/run/media/bazzite/5c30424f-a21c-4799-94ee-89c1ba8949f0/tankclone` (SSD SATA secundário do dono, ext4,
  ~74 GB livres). O NVMe do sistema está quase cheio e instável sob carga pesada — **mantenha I/O pesado no SATA**.
- Máquina: Linux (Bazzite/Fedora Atomic), Node v24, npm 11.
- Instalar: `npm install` na raiz. (O npm avisa que o script de instalação do `esbuild` não foi aprovado; tudo roda sem isso.)

```bash
npm test                                          # testes do core (vitest)
npm run typecheck -w @tankclone/core              # tsc --noEmit
npm run typecheck -w @tankclone/client
npm run calibrate -w @tankclone/core              # reajusta a física contra as tabelas e imprime os erros
npm run dev -w @tankclone/client                  # visualizador em http://localhost:5173 (também na rede, --host)
npm run build -w @tankclone/client                # build de produção (Vite)
```

## 4. Estrutura do repositório

```
tankclone/
  package.json              workspaces: packages/*; script "test" delega ao core
  tsconfig.base.json        strict, noUncheckedIndexedAccess, resolveJsonModule, moduleResolution Bundler
  DESENVOLVIMENTO.md        este arquivo
  packages/
    core/                   REGRAS PURAS (sem DOM, sem rede, sem Math.random). Roda igual no cliente e no servidor.
      src/physics.ts        PhysicsConfig, DEFAULT_PHYSICS, MUZZLE_HEIGHT, launch(), step(), simulateShot()
      src/terrain.ts        classe Terrain (máscara 1 byte/pixel)
      src/calibration.ts    predictDx, evaluate, loss, samplesFromTables, fitPhysics, requiredPower, powerScalingCheck
      src/index.ts          reexporta tudo
      calibration/ddtank-tables.json   tabelas de tiro da comunidade (dados de verdade para o ajuste)
      scripts/calibrate.ts  CLI de calibração (roda com tsx)
      test/*.test.ts        physics, terrain, calibration
    client/                 visualizador (hoje); virará o cliente do jogo
      index.html, src/main.ts, vite.config.ts
```

Regra de arquitetura: **nada de DOM, rede, tempo real ou aleatoriedade não-semeada em `core`**. O servidor é
autoritativo e roda o mesmo `core` que o cliente, com passo fixo (`dt = 1/60`), para que ambos cheguem ao mesmo resultado.

## 5. Convenções do `core`

- Unidades: **pixels e segundos**. Eixo **Y cresce para baixo** (como na tela).
- Ângulo em graus: `0° = direita`, `90° = para cima`. `facing: 1 | -1` espelha o eixo X (quem mira para a esquerda).
- Força (`power`): 0–100 (barra do jogo). Velocidade inicial = `power * speedPerPower`.
- Vento: número com sinal; positivo = sopra para a direita. Aceleração horizontal = `wind * windAccel`.
- Integração: Euler semi-implícito (velocidade primeiro, depois posição), passo fixo.
  `ax = wind*windAccel - drag*vx`, `ay = gravity - drag*vy`.
- `simulateShot(shot, isSolid, cfg)` detecta colisão **no fim de cada passo** (sem interpolação sub-passo; a velocidade
  máxima ≈ 1700 px/s → ~28 px por passo). **Melhoria futura:** colisão contínua para evitar atravessar terreno fino.
- `Terrain`: laterais e fundo contam como sólidos; acima do topo é vazio. `carveCircle` é determinístico
  (mesma sequência de crateras → mesma máscara). `fromHeightFn` e `fromMask` criam o terreno; este último serve para mapas
  desenhados (PNG com alfa = sólido).

## 6. Calibração da física (parte mais importante até agora)

### 6.1 Dados de entrada
O dono forneceu (em imagem) as **tabelas de tiro da comunidade DDTank**: para os ângulos **20°, 30°, 50° e 65°**, a
**força necessária para cada distância 1..20**, em chão plano, sem vento. Transcritas em
`packages/core/calibration/ddtank-tables.json`. Também forneceu as regras de uso:

- Vento: ângulo final = ângulo base **±** correção (vento a favor +, contra −). Correção = **força do vento × 2** para
  50° e 65°; para 30° a tabela diz só "(+)(−)" (provavelmente × 1 — **não confirmado**). Para 20° não há correção listada.
- **Tiro médio / "semifull"**: força **sempre ≈ 60** (a segunda imagem diz 62–65, tipicamente 62–63, dependendo de
  servidor/versão); **ângulo = 90 − distância × 2** (± vento × 2).
- **Tiro alto**: força **sempre 95**; **ângulo = 90 − distância** (± vento × 2).
- **Unidade de distância:** no DDTank a distância é contada **em telas**: "distância 10 = uma tela inteira"
  (o dono disse "1 minimapa inteiro"), com 0 exatamente onde o jogador que atira está.

### 6.2 Suposição NÃO confirmada (importante)
`unitPx = 100` — assumi tela de **1000 px / 10**. Se a tela do original tem outra largura, edite `unitPx` em
`ddtank-tables.json` e rode `npm run calibrate -w @tankclone/core`; depois copie os valores ajustados para
`DEFAULT_PHYSICS`/`MUZZLE_HEIGHT` em `physics.ts`. **Perguntar ao dono** (ele ainda não respondeu).

### 6.3 O que se descobriu
- Parábola ideal (sem arrasto) dá ~8,5% de erro RMS no alcance → não reproduz as tabelas.
- **Gravidade + arrasto linear do ar** → ~6,6% RMS no alcance, mas isso equivale a **±1 ponto de força** na maioria
  dos pontos (pior caso ~2,8, em distâncias 1–4 a 20° e 65°). A resolução das próprias tabelas (feitas à mão) é ~1 ponto.
- Testado e **descartado** (não melhorou): comprimento de cano (ponto de saída dependente do ângulo) e expoente de força ≠ 1.
- Com arrasto, **gravidade e velocidade deixam de ser redundantes** → o ajuste libera 4 parâmetros:
  `speedPerPower`, `gravity`, `drag`, `muzzleHeight`.
- Validação fora do ajuste: tiro alto (P=95, ângulo = 90 − d) cai a ≤ 0,7 unidade do esperado. Tiro médio (P=60) bate
  bem em curto alcance e piora em longo (provavelmente P real ≈ 62–63).

### 6.4 Valores atuais (em `physics.ts`)
`gravity 507.32`, `speedPerPower 16.748`, `drag 0.1416`, `MUZZLE_HEIGHT 30.18` px, `windAccel 8` (**chute, sem calibrar**).
`muzzleHeight` = altura do ponto de saída do projétil acima do chão do tanque → **restrição para os artistas**
(o cano do sprite deve soltar o projétil ~30 px acima dos pés, na escala de tela de 1000 px).

### 6.5 Testes de regressão (não afrouxe sem motivo)
`test/calibration.test.ts` exige, por ângulo, erro ≤ 3 pontos de força (mediana ≤ 1,2) contra as tabelas e tiro alto a
≤ 0,7 unidade. Se mudar a física, rode `npm run calibrate` e confirme que os testes seguem passando.

### 6.6 Como recalibrar / estender
Para novos dados (ex.: medições com vento ou outras forças), adicione amostras e use `fitPhysics`/`evaluate`
(`ShotSample` aceita `wind` e `dy`). `requiredPower(angle, dx, cfg, muzzleHeight)` inverte o modelo (bisseção).
Nota: a função de perda é não-suave (discretização do passo), então o Nelder-Mead pode cair em ótimos locais
levemente diferentes; o script já tenta 3 escalas de partida.

## 7. Visualizador (`packages/client`)

Canvas 2D, mapa de 2200×600 (20 unidades = 2000 px; o canvas encolhe por CSS). Terreno via `Terrain` (cache em canvas
offscreen). Controles: ângulo, força (passo 0,1), vento, direção, raio da cratera, sliders de física (gravidade,
velocidade/força, arrasto, efeito do vento), "Disparar" (espaço) que abre cratera no impacto, "Terreno plano
(p/ tabelas)" e "Terreno ondulado". Clicar no mapa move o atirador. Mostra impacto, distância em **unidades** e px,
altura máxima e tempo. Serve para conferir as tabelas (ex.: 50° com força 48,3 em terreno plano → ≈ 10 un) e para
ajustar o "feeling". Os sliders **não persistem**: valores bons devem ser copiados para `DEFAULT_PHYSICS`.

## 8. Decisões de arquitetura (e por quê)

| Decisão | Motivo |
|---|---|
| Cliente **web** (TypeScript + canvas; Phaser 3 planejado quando houver sprites) | Amigos só abrem uma URL; sem instalação. |
| Servidor **Node + TypeScript**, WebSocket (`ws` ou Colyseus), **SQLite** | Mesmo código de `core` no cliente e no servidor; 20 jogadores não justificam mais. |
| Servidor **autoritativo** | Cliente envia só intenções (ângulo, força, tiro, mover); servidor simula e devolve o resultado. Evita trapaça e dessincronização. |
| Simulação **determinística**, passo fixo | Cliente anima o mesmo resultado que o servidor calculou. |
| Fórmulas de stats em **arquivo de dados** (JSON/TS) | Ajustar o balanço sem recompilar e sem mexer em arte. |
| Arte desacoplada por **manifesto de assets** (hitbox, âncoras, animações) | Amigos trocam arte sem tocar no código. |
| Acesso: **Tailscale** (ou Cloudflare Tunnel) | Sem abrir portas no roteador; funciona com CGNAT. Ainda não montado. |

## 9. Plano de desenvolvimento (próximas fases)

Cada fase deve terminar com testes automáticos no `core` e, quando fizer sentido, algo verificável no visualizador.

### Fase A — Fechar a calibração do tiro (curto)
1. Confirmar com o dono a escala `unitPx` (tela do original) — §6.2.
2. **Vento**: descobrir a escala do vento no original (que valores assume, ex.: 0–5?). Usando a regra "ângulo ± vento×2"
   (50°/65°), calibrar `windAccel` para que a correção de ângulo da tabela reproduza o alcance sem vento. Criar amostras
   com `wind != 0` e estender o ajuste a `windAccel`. Possível que o vento também deva ser modelado por arma (fator).
3. Testar força do tiro médio entre 60 e 65 e ajustar a recomendação (§6.3).
4. Opcional: colisão contínua em `simulateShot` (sub-passo / varredura de segmento) para não atravessar terreno fino.

### Fase B — Stats e dano (`core/stats.ts`, a parte "idêntica" mais sensível)
1. **Pesquisar fórmulas** em wikis, guias de jogadores, calculadoras de fãs e fóruns (EN/PT/ZH; o material mais detalhado
   costuma estar em chinês). **Não copiar código vazado.** Documentar cada fonte e confiança em `docs/stats-sources.md`.
2. Modelar atributos: HP/vitalidade, ATK, DEF (armadura), AGI (agilidade → ordem de turno / delay), sorte (crítico),
   stamina. Definir como cada stat entra na fórmula de dano, redução por defesa, crítico, esquiva, dano por distância do
   centro da explosão (queda radial), dano de queda.
3. Implementar como **funções puras** + **tabela de dados** ajustável; cobrir com testes baseados em casos
   conhecidos (stats → dano esperado) vindos das fontes. Como o dono aceita fidelidade aproximada, definir uma
   tolerância explícita por caso.
4. Exibir no visualizador (painel de teste: escolher stats de atacante/alvo, ver dano).

### Fase C — Partida local (`core/match.ts`)
Máquina de estados determinística: jogadores/tanques com posição no terreno e **física de queda** quando o chão
some; **turnos** com ordem por agilidade, tempo limite, movimento limitado, "delay" por ação; vento aleatório **semeado**
por turno; aplicação de dano e fim de partida. Entrada = lista de intenções por turno; saída = eventos (para animar).
Testes: partidas simuladas com semente fixa devem reproduzir exatamente os mesmos eventos.

### Fase D — Servidor e multiplayer 1×1
Pacote `packages/server`: WebSocket, salas, matchmaking básico, validação de intenções, execução autoritativa do
`core`, envio de eventos. Cliente passa a enviar intenções e animar eventos. Primeiro 1×1, depois 2v2–4v4.
Acesso dos amigos via Tailscale/Cloudflare Tunnel; rodar o servidor como serviço (systemd/Podman) com reinício automático.

### Fase E — Conteúdo
Mais mapas (PNG com alfa → `Terrain.fromMask`), armas (raio/dano/efeitos próprios, fator de vento), itens/skills,
modos de jogo. Escopo mínimo sugerido: 3 mapas e ~10 armas.

### Fase F — Arte, UI e som
Trocar placeholders pela arte dos amigos via manifesto de assets; UI de lobby/partida; sons. Respeitar a restrição
`MUZZLE_HEIGHT` e a escala de tela de 1000 px (a confirmar).

### Fase G — Meta-jogo e operação
Contas (SQLite), nível/equipamento/inventário, ranking, backups periódicos do banco, logs, teste com 20 conectados.

## 10. Riscos e pontos de atenção

1. **Fidelidade das fórmulas de dano/stats** é o maior risco: não há documentação oficial. Mitigar com várias fontes,
   tabelas de casos e tolerância explícita.
2. **"Feeling" da física:** pequenas mudanças em gravidade/arrasto/vento/passo mudam muito o jogo — sempre rodar os testes
   de regressão e conferir no visualizador.
3. **Escopo:** o DDTank original tem dezenas de sistemas. Fechar a Fase B/C antes de expandir conteúdo.
4. **Direitos autorais:** ver §1 (não usar código vazado; arte e nomes próprios).
5. **Armazenamento:** NVMe do sistema cheio/instável; projeto e artefatos pesados ficam no SSD SATA.

## 11. Estado do ambiente neste momento

- Servidor de desenvolvimento do Vite pode estar rodando em segundo plano em `http://localhost:5173`
  (iniciado nesta sessão; se não estiver, `npm run dev -w @tankclone/client`).
- Nenhum commit (sem repositório git). Sugestão: `git init` na raiz (o `.gitignore` já ignora `node_modules` e `dist`).
- Memória do assistente com resumo do projeto: `tankclone-project.md` (diretório de memória do Claude Code do usuário).
