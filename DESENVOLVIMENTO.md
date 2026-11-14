# tankclone — documento de desenvolvimento

Documento de handoff: objetivo, decisões do dono, estado atual e plano das próximas fases. Escrito para que outro agente
(ou pessoa) continue sem depender do histórico da conversa. Idioma do projeto e da comunicação com o dono: **português (pt-BR)**.

Documentos relacionados:
- **`docs/ESTADO-E-RUMO.md`: estado atual e direção do projeto; tem precedência sobre as fases e estimativas históricas deste documento.**
- `docs/avatar.md`: renderer clássico atual, catálogo local de peças, correção de direção e verificação da continuidade do vento.
- `docs/ddtank-reborn.md`: atualização atual de física float32, máscaras reais de explosão, delay das bolas e reprodução simultânea dos leques.
- `docs/ddtank41.md`: referência atual dos cálculos de física e combate, alinhada ao repositório DDTank41 em 2026-11-12; substitui as fórmulas estimadas descritas abaixo.
- `docs/pesquisa-mecanicas.md`: o que se sabe do original (itens, armas, dano, turnos, pérolas), com fontes e confiança.
- `docs/decisoes.md`: respostas do dono no refinamento de 2026-11-11 (fonte da verdade para escopo).

---

## 1. Objetivo e restrições

Jogo de artilharia 2D por turnos **com a jogabilidade o mais próxima possível do DDTank**, para ~20 amigos, com o
servidor rodando no PC do dono.

- **Igual ao original:** mira por ângulo + força, vento, terreno destrutível, turnos por delay, energia, itens de turno,
  fúria/especial, stats e fórmula de dano. Fidelidade = "mesma sensação e mesmos números aproximados", não bit a bit.
- **Próprio:** nome do jogo, arte, sons, UI e nomes de armas/pets/itens. Nomes do original podem ser usados como
  **placeholder interno** durante o desenvolvimento, mas são trocados antes de abrir para os amigos.
- **Avatar (decisão posterior, 2026-11-12):** o dono passou a preferir o sistema e os recursos visuais clássicos. A composição atual e seus limites estão em `docs/avatar.md`; isso substitui o placeholder SVG para personagens.
- Só o dono programa; os amigos fazem arte.

## 2. Escopo da primeira build ("build PvP")

| Entra | Fica para depois |
|---|---|
| PvP 1v1 e times até 4v4; várias salas ao mesmo tempo | PvE / instâncias (nível 10) |
| 3 armas: inspiradas no Canhão Arco-Íris (200), Quebra-Tijolos (200) e Fogo Intenso (205) | armas secundárias (só importam no PvE) |
| Itens de turno nas teclas **1–8** e **F** (voar) | **Q** (escudo / dom de anjo), **Z/X/C** (C = invisibilidade) |
| Barra de fúria + especial de cada arma | cartas (nível 30, vindas das instâncias) |
| Equipamentos com **stats fixos**, todos liberados | forja (fortalecer, compor, gemas), loja e economia |
| Contas (apelido + senha), XP e nível até **30**; tutorial do 1 ao 9 | hazards de mapa que aumentam o vento |
| 5 mapas provisórios: 2 com chão indestrutível, 3 tatuzáveis | mapas definitivos |
| Avatar clássico em camadas, com catálogo inicial de equipamentos | catálogo completo e animação das asas |
| Depois do PvP estável: **pérolas** (nível 18) e **pets** (nível 25; formiga e plantinha, 1 passiva + 2 skills) | demais pets |

O **nível não dá stats**; só libera sistemas: 1–9 tutorial (slots de equipamento e funções da UI aos poucos),
10 instâncias, 18 pérolas, 25 pets, 30 cartas.

## 3. Regras de jogo definidas (valores iniciais, todos em arquivo de dados)

| Regra | Valor | Fonte |
|---|---|---|
| Escala | tela de 1000 px; 1 distância = 100 px; distância 10 = 1 tela | decisão (resolução do original desconhecida) |
| Vento | 0 a 10, uma casa decimal; sorteio favorece ≤ 5; o mapa pode modificar | dono |
| Força | barra 0–100 de **segurar e soltar** (enche com o tempo) | gênero |
| Ângulo | **faixa por arma** (ex.: 55–70, 20–65, 20–50), aplicada relativa ao corpo inclinado na rampa; o valor exibido é o **ângulo absoluto real**, e acompanha a mudança da inclinação ao andar ou virar, preservando a mira relativa ao corpo | dono |
| Tempo de turno | 10 s; 5 s quando todos estão acima de um limiar de FC | dono |
| Ordem de turno | **delay acumulado**: começa quem tem mais agilidade; depois joga quem tem menor delay; mover/itens somam delay; agilidade reduz o delay ganho; passar a vez soma pouco | pesquisa |
| Energia | **240 + AGI/30** por turno (~1 por px andando); volta cheia no próximo turno. Confere exato com a conta de referência (AGI 29551 → 1225). Com 240 só cabe "14" (195); "1446" (350) exige AGI ≈ 3300 | dono + print |
| Itens 1–8, F | +2 tiros, triplo, +1 tiro, +50/40/30/20/10% de dano, voar; custos 110/110/110/85/80/70/55/50/150 (guia doyo, confirmados pelo dono) | dono |
| Combos de aceitação | com a energia inicial (240) só cabe "14" (195); "124" (305) e "1446" (350) exigem a energia maior de quem tem agilidade/equips altos | dono |
| Fúria | 0–100; enche ao atacar, ao passar a vez e ao levar dano; cheia libera o especial | dono |
| Terreno | 3 estados: ar, chão destrutível, chão indestrutível | dono (mapas) |
| Morte | HP 0 ou cair para fora do mapa | gênero |

## 4. Estado atual (2026-11-12)

O estado detalhado está em [`docs/ESTADO-E-RUMO.md`](docs/ESTADO-E-RUMO.md).

- PvP local e em rede, várias salas, até 8 jogadores por sala, contas SQLite, XP/nível e reconexão por log.
- Física de referência DDTank41, passo de 40 ms e integração float32, com comparação aos vetores C# publicados pelo Reborn.
- Fórmulas de dano, crítico, energia, fúria e delay adaptadas; itens respeitam a ordem de aplicação.
- Terreno com estados destrutível/indestrutível e seis máscaras de explosão importadas.
- Reprodução dos tiros simultâneos por linha do tempo, independente da taxa de desenho.
- Direção transmitida pelo servidor; vento gradual entre turnos e estável dentro do turno.
- Avatares clássicos PNG em camadas, retratos, masculino/feminino e animações básicas; asas estáticas.
- As tabelas da comunidade e o perfil anterior continuam disponíveis para comparação histórica.
- Inventário completo, novas habilidades, pets, pérolas, cartas e PvE ainda não foram portados.

## 5. Localização, requisitos e comandos

- Pasta: `/run/media/bazzite/5c30424f-a21c-4799-94ee-89c1ba8949f0/tankclone` (SSD SATA, ext4). O NVMe do sistema está
  quase cheio e instável sob carga — **mantenha I/O pesado no SATA**.
- Remoto: `https://github.com/epoeck/tankclone` (privado); conferir a branch e seu upstream com `git status -sb`.
- Máquina: Linux (Bazzite/Fedora Atomic), Node v24, npm 11. Mapas provisórios: ArtCraft (guias) + Qwen Image (ComfyUI local).

```bash
npm install                                       # na raiz (o aviso do script do esbuild pode ser ignorado)
npm test                                          # testes do core e do servidor (vitest)
npm run typecheck -w @tankclone/core
npm run typecheck -w @tankclone/client
npm run calibrate -w @tankclone/core              # reajusta a física contra as tabelas
npm run dev -w @tankclone/client                  # visualizador em http://localhost:5173
npm run build -w @tankclone/client
```

## 6. Estrutura do repositório

```
tankclone/
  package.json              workspaces: packages/*; "test" verifica core e servidor
  tsconfig.base.json        strict, noUncheckedIndexedAccess, resolveJsonModule, moduleResolution Bundler
  DESENVOLVIMENTO.md        este arquivo
  docs/                     pesquisa-mecanicas.md, decisoes.md
  packages/
    core/                   REGRAS PURAS (sem DOM, rede ou Math.random). Roda igual no cliente e no servidor.
      src/physics.ts        PhysicsConfig, DEFAULT_PHYSICS, MUZZLE_HEIGHT, launch(), step(), simulateShot()
      src/terrain.ts        classe Terrain
      src/calibration.ts    predictDx, evaluate, loss, samplesFromTables, fitPhysics, requiredPower
      calibration/ddtank-tables.json   tabelas de tiro da comunidade (renomear antes de publicar)
      scripts/calibrate.ts
      test/*.test.ts
    client/                 jogo Canvas 2D, lobby, HUD, vestiário e prévias
```

Regra de arquitetura: **nada de DOM, rede, tempo real ou aleatoriedade não semeada em `core`**. O servidor é autoritativo
e roda o mesmo `core` que o cliente, com passo fixo de referência (`dt = 0.04`, 25 passos/s); o desenho do cliente segue seu próprio relógio.

## 7. Convenções do `core`

- Unidades: **pixels e segundos**. Eixo **Y para baixo**.
- Ângulo em graus: `0° = direita`, `90° = para cima`; `facing: 1 | -1` espelha o eixo X.
- Força 0–100; velocidade inicial = `power * speedPerPower`.
- Vento com sinal (positivo = para a direita); aceleração = `wind * windAccel`.
- Integração Euler semi-implícita com arredondamentos float32 por operação, passo fixo de 0,04 s: `ax = wind*windAccel - drag*vx`, `ay = gravity - drag*vy`.
- `simulateShot` varre o segmento entre passos (≤ 1 px) → colisão contínua; aceita `hitboxes` de jogadores (`Hitbox`, `PLAYER_HITBOX` provisório 36×42) e ignora o atirador até o projétil sair da própria caixa. Retorna `hitKind` (`terrain`/`player`) e `targetId`.
- `Terrain`: 3 estados (`AIR`/`DESTRUCTIBLE`/`INDESTRUCTIBLE`); laterais e fundo indestrutíveis, topo vazio; `carveCircle` só apaga destrutível; `fromMask` lê RGBA (preto = ar, branco = destrutível, vermelho puro = indestrutível; classificação por canal, ver `terrain.ts`); `slopeDeg(x, feetY, facing)` dá a inclinação do chão sob o personagem.
- `angle.ts`: faixa de ângulo por arma relativa ao corpo; `allowedAbsoluteRange`, `clampAbsoluteAngle`, `relativeAngle`. O ângulo usado no tiro e exibido é o absoluto.

- **Cliente só anima eventos**: nunca re-simula o tiro. `Math.hypot`, `atan2`, `sin` e `cos` não são garantidos bit a bit entre motores (V8, Safari); só o servidor (core) decide, o cliente desenha os `points` recebidos. Antes do servidor existir, o `game.html` roda o core localmente (um motor só).
- **Personagem = avatar clássico em camadas.** `core/appearance.ts` guarda a aparência e `core/avatar.ts` define peças/quadros; `client/src/chars.ts` compõe PNGs GAME/SHOW em Canvas 2D, aplica máscaras de cor e espelha todas as peças juntas. Não usa runtime Flash. Veja `docs/avatar.md` para fontes, importação e limites.
- Pendência: revisar a colisão do corpo com obstáculos e saliências na altura da cabeça durante o movimento.
- A fórmula atual de dano/crítico está em `docs/ddtank41.md`; a conta de 2022 continua fora da escala da primeira build PvP, que usa stats antigos.

## 8. Calibração histórica da física (perfil TABLE_PHYSICS)

Esta seção registra a aproximação anterior. O padrão da partida agora é `DEFAULT_PHYSICS` descrito em `docs/ddtank41.md`; os testes por tabelas usam `TABLE_PHYSICS`.

### 8.1 Dados
Tabelas da comunidade: força necessária por distância 1..20 a 20°, 30°, 50° e 65°, chão plano, sem vento
(`packages/core/calibration/ddtank-tables.json`). Regras de uso:
- Vento: ângulo ± **vento × 2** a 50° e 65° (a favor +, contra −); a 30° "(+)(−)", provavelmente × 1.
- **Tiro médio**: força ≈ 62–63, ângulo = 90 − distância × 2 (± vento × 2).
- **Tiro alto**: força 95, ângulo = 90 − distância (± vento × 2).

### 8.2 Resultado
Gravidade + arrasto linear: erro ±1 ponto de força na maioria das distâncias, pior caso ~2,8 (distâncias 1–4 a 20° e 65°).
Valores históricos: `gravity 507.32`, `speedPerPower 16.748`, `drag 0.1416`, `MUZZLE_HEIGHT 30.18` px (restrição para os artistas:
o projétil sai ~30 px acima dos pés). Descartados: comprimento de cano, expoente de força ≠ 1.

### 8.3 Achado da avaliação de 2026-11-11
Simulando a regra "ângulo ± vento × 2" com P = 95 e P = 62, o erro médio da regra é mínimo com `windAccel ≈ 15–17`
(com 8, o tiro alto erra ~2 distâncias). Isso assume que "vento 1" do original = 1 unidade nossa, na escala 0–10.

### 8.3b Vento calibrado (Fase A)
`fitWindAccel` varre `windAccel` e minimiza o erro da regra "ângulo ± vento × 2" (tiro alto P=95 e médio P=62,5, vento 1–10 nos dois sentidos): ótimo em **17** (erro médio ~0,34 distância; com 8 era 3,3). Tiro médio com P=62,5 e ângulo 90−2d cai a ≤ 1 distância do alvo.

### 8.4 Regressão
`test/calibration.test.ts`: erro ≤ 3 pontos de força por ângulo (mediana ≤ 1,2) e tiro alto a ≤ 0,7 unidade. Não afrouxar.

## 9. Decisões de arquitetura

| Decisão | Motivo |
|---|---|
| Cliente **web** (TypeScript + canvas; Phaser 3 quando houver sprites) | amigos só abrem uma URL |
| Servidor **Node + TypeScript**, WebSocket (`ws` ou Colyseus), **SQLite** | mesmo `core` dos dois lados; 20 jogadores não pedem mais |
| Servidor **autoritativo**, simulação **determinística** com semente | evita trapaça e dessincronização |
| Regras e números em **arquivos de dados** (armas, itens, fórmulas, níveis) | ajustar balanço sem recompilar |
| Arte por **manifesto de assets**; personagem em **camadas** (cabelo, rosto, roupa, chapéu, arma) | trocar arte sem tocar no código |
| Mapa = imagem de arte + **máscara PNG** (RGB: preto = ar, branco = destrutível, **vermelho puro** = indestrutível) | colisão exata e independente da arte; a máscara pode ser o guia do ArtCraft (pintar o indestrutível em vermelho puro) |
| Contas com apelido + senha (hash), no SQLite | sem serviço externo |
| Acesso pela internet via **Cloudflare Tunnel** | link público, sem instalar nada, funciona com CGNAT |

## 10. Plano de desenvolvimento

Cada fase termina com testes no `core` e, quando fizer sentido, algo jogável/visível no cliente.
Ordem pensada para ter **PvP jogável o quanto antes**.

### Fase A — Fechar o tiro e o terreno (**concluída**, ver §8.3b)
1. Vento: escala 0–10; calibrar `windAccel` para que "ângulo ± vento × 2" valha (ponto de partida 15–17); amostras com vento
   no ajuste; teste de regressão da regra.
2. Tiro médio: confirmar força 62–63 no modelo e registrar.
3. Colisão contínua em `simulateShot` (varredura do segmento entre passos).
4. `Terrain` com 3 estados (ar / destrutível / indestrutível); `fromMask` lê a máscara RGBA; cratera não apaga indestrutível.
5. Colisão do projétil com jogadores (hitbox retangular) além do terreno.
6. Faixa de ângulo por arma, relativa ao corpo inclinado pela rampa; UI mostra o ângulo absoluto real.

### Fase B — Partida local (`core/match.ts`) (**implementada**; abrir `game.html` no `npm run dev`)
Máquina de estados determinística, com entrada = intenções por turno e saída = eventos para animar.
1. Personagem no terreno: posição, inclinação, andar gastando energia, escalar rampas até um limite, **queda** quando o chão some,
   morte ao sair do mapa.
2. Turnos por **delay** (ordem inicial por agilidade), tempo de 10 s / 5 s, passar a vez.
3. Energia 240 + AGI/30; itens 1–8 e F com custo, combinação e efeitos (+tiros, triplo, % de dano somado, voar).
   Testes de aceitação: "14" cabe em 240; "124" e "1446" só com energia maior.
4. Fúria (atacar, passar, levar dano) e especial por arma.
5. 3 armas como dados: dano base, faixa de ângulo, raio da cratera, nº de projéteis do especial, fator de vento.
   Especiais e raios são placeholders até o dono ajustar jogando.
6. Vento semeado por turno, HP, fim de partida (time eliminado), limite de turnos opcional.
7. Cliente: força de **segurar e soltar**, régua de distância, câmera que acompanha o tiro + minimapa, barra de itens nas teclas originais.

### Fase C — Stats e dano (`core/stats.ts`) (**implementada**; painel em `dev/damage.html`)
1. Atributos: ATK, DEF, AGI, Sorte, HP (Vida), Armadura, Dano; mais tarde Ataque mágico e Resistência mágica (existem no original de 2022).
   Conta de referência para escala de números em `docs/pesquisa-mecanicas.md` §6. Equipamentos com stats fixos (sem forja).
2. Fórmula de dano de `docs/pesquisa-mecanicas.md` §3 (ATK/10 somado ao dano base; armadura e DEF/25; redução A/(A+100);
   crítico Sorte/20 % e bônus Sorte/25), queda radial e dano de queda como placeholders. Casos de teste com tolerância explícita.
3. FC (força de combate), usada no limiar do turno de 5 s.
4. Painel de teste no cliente: stats de atacante e alvo → dano.

### Fase D — Servidor e multiplayer (**implementado**: `packages/server`; operação em `docs/operacao.md`; falta o cliente de rede)
1. `packages/server`: WebSocket, várias salas simultâneas (até 8 jogadores por sala), 1v1 → 4v4, validação de intenções,
   execução autoritativa do `core`, envio de eventos, reconexão.
2. Contas (apelido + senha com hash), SQLite, XP por partida, nível até 30, desbloqueios por nível (tutorial 1–9).
3. Operação: serviço com reinício automático (systemd/Podman), Cloudflare Tunnel, backup do banco, teste com 20 conectados.

### Fase E — Conteúdo da build PvP (**concluída** na parte técnica; abaixo o que existe: cliente de rede `play.html`, vestiário e boneco em camadas feitos; mapas por máscara feitos (`docs/mapas.md`, `npm run maps:build`); HUD do design por cima do canvas feito (`client/src/hud.ts`, palco 1280×720); sons provisórios sintetizados (`sound.ts`, tecla M muda o mudo) e chat da sala/saguão (≤200 caracteres, limite de taxa, só textContent, nada guardado no banco) e a arte final por camada)
5 mapas provisórios (2 indestrutíveis, 3 tatuzáveis) via máscara; lobby, inventário/equipar, tela de partida; sons provisórios;
boneco placeholder sobre o sistema de camadas. Trocar nomes do original por nomes próprios antes de abrir para os amigos.

### Fase F — Pérolas (nível 18)
Ataque (ativas ao atirar), defesa (ativas ao levar dano), atributo (passivas). Antes de começar: perguntar ao dono slots,
níveis, síntese e números da versão de 2022.

### Fase G — Pets (nível 25)
Formiga e plantinha, copiando as mecânicas do original como placeholder: 1 passiva + 2 skills, uso em partida.

### Depois da primeira build
PvE/instâncias (nível 10) com armas secundárias e cartas (nível 30); Q (escudo/dom de anjo) e Z/X/C (C = invisibilidade);
forja (fortalecer +1..+12 com 12%/nível no dano base, compor, gemas); loja e economia; hazards de vento; mapas e arte definitivos.

## 11. Perguntas em aberto para o dono

1. Efeito do especial de cada uma das 3 armas.
2. Pérolas de 2022: slots, níveis, síntese (na Fase F).
3. Nome do jogo.

## 12. Riscos

1. **Fórmulas de dano/stats** sem documentação oficial; fontes conflitam. Mitigar com dados configuráveis e testes com tolerância.
2. **Feeling da física**: pequenas mudanças em gravidade/arrasto/vento mudam muito o jogo; rodar a regressão sempre.
3. **Escopo**: o original tem dezenas de sistemas; não começar pérolas/pets antes do PvP estável.
4. **Direitos autorais**: ver §1.
5. **Armazenamento**: NVMe instável; projeto no SATA e backup no GitHub.
