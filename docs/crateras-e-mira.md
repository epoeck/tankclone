# Crateras, mira e apresentação dos disparos

O comando `python scripts/import-crater-brinks.py /caminho/ddtank-reborn` reproduz a importação e registra origem e SHA-256 em `packages/client/public/assets/craters/manifest.json`. A borda visual usa os seis arquivos `craterBrink.png` da instalação local de referência DDTank Reborn (assets gunny30). O comportamento segue `Source Flash/src/phy/maps/Tile.as:22`: a máscara de colisão remove terreno e a imagem da borda, centrada no impacto, é composta apenas sobre o terreno destrutível que restou. As crateras são guardadas na ordem dos eventos e reaplicadas quando a arte de terreno ou uma borda termina de carregar; pixels indestrutíveis não recebem pintura nem são removidos. A máscara autoritativa continua sendo a do core.

Ao andar ou virar, a mira mantém seu ângulo relativo ao corpo: a diferença de inclinação é somada ao ângulo absoluto mostrado, então a faixa da arma é aplicada. A mudança atual substitui a antiga decisão de exigir compensação manual. A orientação do personagem e os limites da mira usam a mesma inclinação e direção.

O playback apresenta os projéteis a partir da trajetória já calculada, sem nova simulação; o evento de disparo inclui o ID da bola para selecionar recursos normais ou especiais. O impacto acontece ao término de cada voo, inclusive em colisões imediatas, e usa o tempo da timeline importada. Eventos antigos sem ID usam a arma normal como fallback. As partículas de rastro usam recursos originais e amostras temporais da trajetória registrada.

## Impactos diretos e limites

A referência `packages/fight/src/game/living.ts` usa `Player.setRect(-15,-20,30,30)` e a bomba tem caixa de 6×6 (`phy/bomb.ts`). Ao colidir com um personagem, `Living.collidedByObject` detona a bomba; `game/game.ts` escava a máscara em `bomb.x, bomb.y`, sem deslocamento nem multiplicador de tamanho. A caixa do jogo agora segue essa geometria em relação aos pés, permitindo que o mesmo impacto direto alcance o terreno. Os limites horizontais e inferior encerram o voo sem colisão com parede artificial; o personagem continua limitado ao mapa. O item F transmite bola 3 para selecionar o avião e seus sons.

## Avião, tiros múltiplos e fim da jogada

O F fica indisponível no próximo turno próprio após seu uso e volta no seguinte; o turno transmite o estado de recarga para reconstrução na reconexão. Enquanto ativo, a mira absoluta do avião vai de 0° a 90°, independente de arma e rampa.

No cliente original, `Player.SHOOT_TIMER` é 1000 ms e `GameLocalPlayer.__shootTimer` envia disparos extras nesse intervalo. O servidor de referência simula cada `ShootImp` sincronicamente até o impacto e modifica o terreno antes de receber o próximo disparo: por isso mantemos essa ordem autoritativa, mas apresentamos voos sobrepostos a intervalos de um segundo. Um retrato de estado no último impacto reconcilia personagens quando a ordem visual de chegada difere da ordem síncrona de cálculo. A velocidade mantém o Euler de 40 ms já calibrado; não há evidência para acelerá-la. A partida aguarda todos os voos e eventos antes de ser encerrada e premiada.

## Controles e registro do último tiro

As setas verticais ajustam a mira também durante a carga (um grau no toque e repetição a cada 100 ms); a força continua seguindo o mesmo ciclo. Disparos extras automáticos usam a força escolhida e a mira no instante de cada disparo. O evento autoritativo de tiro inclui ângulo, força e direção para restaurar os marcadores na reconexão; o cliente mantém um histórico por jogador e só marca um tiro confirmado. No jogo em rede o HUD exibe o histórico local; no modo local, o do jogador da vez. As versões antigas do servidor usam uma pendência local confirmada pelo evento correspondente.
