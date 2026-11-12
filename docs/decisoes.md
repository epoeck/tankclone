# Respostas do refinamento do plano (2026-11-11)

Atualização de 2026-11-12: o dono solicitou alinhar os cálculos ao repositório `pnkl1999/DDTank41` e remover do documento de desenvolvimento a restrição de uso desse código. Para física, dano, crítico, fúria e delay, a referência atual é `docs/ddtank41.md`; as estimativas anteriores abaixo ficam como histórico.

Ainda em 2026-11-12, autorizou a adaptação do `thurdev/ddtank-reborn`: delay 200 das bolas, integração float32, máscaras reais de explosão e reprodução simultânea dos leques. Detalhes e limites em `docs/ddtank-reborn.md`.

Depois de testar, relatou flicker ao virar e pediu conferência da progressão do vento. Preferiu o sistema visual clássico do avatar às três imagens de referência da raiz. Direção agora é explícita nos eventos; vento gradual foi confirmado; avatar migrou para peças GAME/SHOW clássicas. Ver `docs/avatar.md`.

1. Modos na v1: 1v1 e times até 4v4 (sem PvE).
2. Época de referência: entre a clássica e a atual. Sistemas desejados:
   - Todos os equipamentos (inclusive armas secundárias).
   - Pets: 1 passiva + 2 skills por pet.
   - Pérolas (sistema como era em ~2022).
   - Cartas.
   - Cartas e armas secundárias só importam no PvE (futuro); NÃO entram na build inicial PvP.
3. Progressão na build PvP inicial: tudo liberado (equips, pets, pérolas); loja/economia entra numa fase posterior.
4. Vento: escala 0 a 10 (assumido com uma casa decimal), raramente passa de 5; sorteio deve favorecer valores baixos. Futuro: hazards de mapa que aumentam o vento (deixar o vento como modificável por evento/mapa).
5. Resolução do original: desconhecida. Decisão: tela própria de 1000 px de largura (1 distância = 100 px), mantendo as proporções das tabelas.
6. Itens de partida na build PvP: só o padrão inicial nas teclas 1–8 e F (Izzy lembra das teclas, não dos nomes). Q (escudo/"dom de anjo") fica vazio por enquanto. Z/X/C ficam para depois. Mapear quais itens são 1–8 a partir de pesquisa e confirmar com Izzy.
7. F = voar (entra na build PvP). C = invisibilidade (Izzy usava em C; fica para depois, junto com Z/X). Manter as teclas originais por memória muscular.
8. Movimento/energia: energia padrão 220 ≈ andar 2,2 distâncias (≈1 energia por px na tela de 1000 px). Em 2022, com muita agilidade e equips altos, andava 3–5 distâncias. Ou seja, agilidade/equip aumentam a energia. Itens também gastam energia (custos não lembrados → pesquisar).
   Combos mais usados pelo Izzy: "124" para tatuzar (cavar) e "1446" para dano. Usar como teste de aceitação: esses combos devem caber na energia padrão e ter o efeito esperado.
   Tempo de turno: não respondido → padrão 20 s (confirmar).
9. Tempo de turno PvP: 10 s; cai para 5 s quando os jogadores passam de certo FC (força de combate, "veteranos"). O limiar de FC é configurável.
10. Barra de fúria: entra na build PvP. Enche ao atacar, ao passar o turno e ao sofrer dano. Libera o especial da arma.
11. Armas na build PvP (mínimo 3), cada uma simulando o comportamento de uma arma do original, com nome/visual próprios:
   - "Canhão Arco-Íris" — dano base 200
   - "Quebra-Tijolos" — dano base 200
   - "Fogo Intenso" — dano base 205
   Pesquisar em wikis/fóruns: raio, especial, padrão de tiro, fator de vento de cada uma.
12. Pets: só 2 na primeira build — "formiga" e "plantinha" — copiando mecânicas do original como placeholder (nomes/visual serão trocados depois). Pets só começam a ser feitos DEPOIS do PvP e do básico funcionando. Pets liberados a partir do nível 25.
13. Nível máximo da primeira build: 30. (Implica sistema de nível/XP na primeira build — conflita parcialmente com "tudo liberado"; ver pergunta seguinte.)
14. Nível serve SÓ para liberar sistemas (não dá stats):
   - Nv 1–9: tutorial; libera slots de equipamento e funções da UI gradualmente.
   - Nv 10: instâncias/PvE (WIP).
   - Nv 18: pérolas.
   - Nv 25: pets.
   - Nv 30 (máx. da 1ª build): cartas (obtidas nas instâncias).
   Implica contas persistentes com XP/nível desde a build PvP.
15. Contas: apelido + senha, guardadas no SQLite do PC do Izzy (sem serviço externo).
16. Acesso dos amigos: link público via Cloudflare Tunnel (só navegador, nada para instalar).
17. Mapas da primeira build: 5 (2 com chão indestrutível, 3 tatuzáveis/destrutíveis). Provisórios: guias feitos no ArtCraft + imagens geradas no Qwen Image pelo workflow local (ComfyUI no PC). Mapas definitivos vêm depois.
   Impacto técnico: Terrain precisa de uma 2ª camada (pixels indestrutíveis) — hoje só há sólido/vazio.
18. Formato dos mapas: imagem de arte + máscara PNG separada (preto = ar, branco = chão destrutível, vermelho puro (255,0,0) = indestrutível; o cinza da borda antisserrilhada nunca vira indestrutível, por isso não se usa cinza). A máscara pode ser o próprio guia do ArtCraft.
19. Visual do personagem: boneco placeholder na primeira build, mas código já preparado para sprites em camadas (cabelo, rosto, roupa, chapéu, arma) quando a arte chegar.
20. Equipamentos na primeira build: stats fixos, sem forja (fortalecer/compor/gemas vêm depois).
21. Backup: repositório privado no GitHub (Izzy cria o repo vazio; Claude envia os commits).
22. Ângulo em rampa: o valor exibido é o ângulo absoluto real; a inclinação muda o ângulo efetivo e o jogador precisa compensar.
23. Custos confirmados: tecla 1 = 110, tecla 4 = 85. Com a energia inicial só dá "14". Demais custos: Izzy vai reinstalar o jogo para conferir.
24. Custos da tabela doyo confirmados pelo Izzy. Energia = 220 + AGI/30 (30 de agilidade = 1 de energia).
25. Pérolas (~2022, print): 3 slots centrais = 1 ataque (topo) + 2 defesa (embaixo); ~15 slots de pérola de atributo ao redor. Ver docs/pesquisa-mecanicas.md §5.1.
26. Print de conta forte: AGI 29551 → energia 1225 ⇒ base 240 (não 220). Atributos mágicos existem (Atq/Resist mágica). Ver pesquisa §6.
32. Escala de stats da build PvP (decisão do dono, 2026-11-11): usar a escala ANTIGA (2011) — stats de equipamento na casa das centenas a poucos milhares, vida ~5000 — com a fórmula dos guias como está (K = 100). A escala de 2022 (conta de referência do print) só volta quando entrarem forja, pérolas e pets. Implementado em `core/src/builds.ts` (4 builds de teste) com teste de sanidade (tiro central sem itens, média × média: 5%–15% da vida). `REFERENCE_STATS` fica marcada como "escala 2022, não usar na build PvP".
33. Itens de tiro (confirmado pelo dono): todos repetem no turno, exceto o 2 (tiro triplo), que só vale uma vez; +1 tiro = −10% por disparo, +2 tiros = −40%.

- **Voo (F)** é tratado como uma arma de faixa 0–90° relativa ao corpo (`FLY_ANGLE`); na rampa a faixa gira junto, como nas armas. Pedido do Izzy em 2026-11-12.
- **Dano próprio:** o atirador sofre dano dos próprios tiros, mas a vida desce no máximo até 1 (nunca morre por isso). Pode morrer andando/caindo para fora do mapa. Aliados continuam sem se ferir.
- **Dano em si e em aliados (igual ao Reborn, decisão do Izzy em 2026-11-12):** a bomba fere o atirador e os aliados jogadores; se o dano mataria, vira vida − 1 (crítico zerado). Quem leva dano vivo ganha fúria pela fórmula `floor((floor(dano×2/5)+5)/2)`, inclusive dano próprio/aliado (no caso cortado para vida 1, usa-se o dano realmente aplicado). `friendlyFire` passou a ser true por padrão. Substitui a decisão anterior de dano próprio sem fúria.
  Nota: com 1 de vida, cada auto-acerto ainda rende floor((0+5)/2) = 2 de fúria; mantido (aceito pela revisão; confirmar com o Reborn se necessário).

## Limpeza de 2026-11-12 (aprovada pelo Izzy)
- **Física antiga aposentada:** `TABLE_PHYSICS`, o ajuste por tabelas (`calibration.ts`, `scripts/calibrate.ts`, `calibration/`) e seus testes foram removidos; só existe o motor float32 do Reborn (`DEFAULT_PHYSICS`). Os valores históricos (gravity 507,32 etc.) ficam só no histórico do git.
- **`MUZZLE_HEIGHT` (30,18) continua herdado do motor antigo.** Falta medir a ponta da arma no boneco agachado (precisa dos sprites locais); até lá, pode haver ~5 px de diferença visual entre o cano e a saída do tiro.
- **Ids de bala** vêm só da ficha de cada arma (`WEAPONS[...].ballId` e `special.ballId`) e de `FLY_BALL_ID`; o cliente não tem mais números mágicos.
- **`view.ts` dividido:** `controls.ts` (teclado) e `terrain-layer.ts` (pintura do terreno e bordas de cratera).
- **Páginas de desenvolvimento** (design, dano, projéteis, avatar, visualizador de física) ficam em `packages/client/dev/` (`/dev/*.html`); o jogo é `play.html` (rede) e `game.html` (local).
- **Vários tiros:** cada tiro é uma intenção própria; o ângulo e a força podem mudar entre eles, itens travam depois do primeiro tiro. O relógio para enquanto se carrega a força (não volta mais naquele turno, como no Reborn; limite de 20 s parado).
- **Sons:** arquivos do Reborn ficam só locais em `packages/client/public/sfx-local/<id>.ogg` (gitignored), com som sintetizado de reserva.
