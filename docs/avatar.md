# Avatar clássico, direção e vento

Atualização de 2026-11-11, por solicitação do dono: usar o sistema visual clássico do avatar.
As três imagens de referência adicionadas à raiz foram inspecionadas e preservadas sem alteração.

## Flicker ao virar

O problema era a inferência do lado no cliente: o caminho do evento de movimento contém os pontos
**depois** de cada passo. Em um movimento de 1 px há apenas um ponto, então primeiro e último são iguais.
O teste `último.x >= primeiro.x` forçava o lado direito; pacotes de 2 px para a esquerda invertiam de novo.
Como o controle envia 1 ou 2 px por frame, isso produzia o flicker relatado.

O evento `move` agora carrega `facing` autoritativo. O cliente aplica esse campo diretamente, inclusive
ao virar sem andar (parede, energia esgotada ou intenção de 0 px). Não deduz direção pela posição ou arte.
Há testes de pacotes de 1/2 px alternados, virada no lugar e reconstrução do log.

## Vento

A progressão já estava implementada na adaptação anterior: `Match.rollWind` conserva o valor anterior
e um alvo, movendo até **1 unidade por turno**, com uma casa decimal. O mapa aplica seu multiplicador.
O vento só muda em `beginTurn`; mirar, esperar dentro do turno, andar e usar itens não o alteram.
O comportamento segue `BaseGame.GetNextWind` do 4.1, incluindo a escolha de novo alvo quando há igualdade.
Não foi trocado por um sorteio independente nesta mudança. Um novo teste cobre 300 turnos consecutivos.

## Como o original monta o avatar

Fontes do cliente 4.1: `ddt/view/character/{BaseLayer,GameLayer,ShowLayer,GameCharacterLoader,
ShowCharacterLoader,GameCharacter}.as` e `ddt/utils/BitmapUtils.as` no `pnkl1999/DDTank41`.
No Reborn essas classes são convertidas para TypeScript e executadas pelo runtime Pixi/Flash dele;
o recurso `apps/client/avatar.html` usa `ShowCharacter` para os retratos.

O sistema combina itens por categoria, sexo, cor e variante do cabelo sob o chapéu:

- `image/equip/{m|f}/{face,hair,cloth,head,glass}/{Pic}/{camada}/{GAME|SHOW}.png`;
- cabelo tem as variantes `A` (sob o chapéu) e `B`;
- em roupa e rosto, a camada `/2` é a máscara de pele; `/3` colore a roupa ou a íris;
- cabelo tem máscara de cor; chapéus atuais usam a própria silhueta para tintura;
- arma tem seu próprio `image/arm/{Pic}/1/0/{game|show}.png`;
- a folha de batalha tem **39 quadros de 114 × 95**, em 13 colunas e 3 linhas;
- retratos usam a arte SHOW de 250 × 312; o rosto tem quatro expressões lado a lado.

Na batalha, a ordem é arma atrás, rosto, cabelo/roupa/chapéu/óculos por cima. Todas as peças são
espelhadas juntas com o mesmo registro dos pés. A coloração segue a máscara com cor sólida e a
sobreposição HARDLIGHT de `BitmapUtils`, mantendo o relevo da arte.

## Integração no tankclone

O projeto continua usando Canvas 2D. Não foi necessário embutir o cliente inteiro, o runtime Flash
ou um iframe em cada jogador. O renderer clássico substitui os SVGs no jogo, nos retratos do HUD,
na sala e no vestiário. O boneco procedural só aparece durante o carregamento inicial dos arquivos.
Os retratos atualizam ao terminar de carregar, inclusive nas telas que não têm um loop de animação.

O catálogo inicial contém:

- masculino e feminino, com a escolha salva no mesmo JSON `Look` da conta;
- 3 rostos, 3 cabelos, 3 roupas, 2 chapéus, 1 óculos e as 3 armas;
- paletas de pele e cabelo, além de tinturas independentes por peça para roupa, íris e chapéu, com opção Original;
- animações básicas de parado, andando, mirando, disparando e recebendo dano;
- 1 asa clássica com animação GAME/SHOW da biblioteca SWF convertida.

Contas antigas sem `appearance.sex` recebem `m`, mantendo os outros índices. Não há migração destrutiva,
alteração de senha ou mudança de stats. Os testes de banco/rede verificam persistência e envio do sexo.
Os caches de composição acomodam o retrato e a batalha de até oito jogadores sem expulsões a cada frame.

## Recursos e versão

O próprio Reborn documenta que o pacote de recursos gráfico do 4.1 não vem completo no repositório.
Ele usa recursos clássicos compatíveis de outros pacotes como doadores. Esta integração usa **139 PNGs
inalterados** do mesmo doador documentado: `dk-khoado/Gunny-3.0`, commit
`16e24b119f96b93b34ddb148f9a035f71a234e67`, aproximadamente 2 MB.
Isso é arte clássica compatível com o renderer 4.1; não é uma alegação de ter todo o pacote gráfico
exato do 4.1 ou todo o catálogo de itens do Reborn.

Importação reproduzível: `python scripts/import-avatar.py`. Os caminhos e hashes SHA-256 ficam em
`packages/core/src/reference/avatar.json`, e os arquivos servidos ficam em `client/public/assets/avatar`.
Durante o jogo todos são locais, sem consulta aos repositórios ou a CDNs.
Créditos em `third_party/classic-avatar/NOTICE.md`.

## Prévia e validação

`/dev/avatar.html` permite inspecionar os dois lados, trocar peças/cores/sexo e testar animações sem alterar
a conta. A escolha permanente continua no vestiário de `/play.html`.

Testes cobrem hashes e dimensões de todos os PNGs, todas as opções do catálogo, variantes A/B,
quadros, máscaras de cor, persistência na conta, setup da partida, direção e continuidade do vento.
O retrato e a batalha foram inspecionados no navegador com os dois sexos e equipamentos combinados.

## Asa, alma e lápide

A asa `wing002` usa a biblioteca convertida `wings` do clone local Reborn, incluindo os quadros GAME e SHOW. No GAME os clipes esquerdo e direito ficam, respectivamente, atrás e à frente do corpo; os quadros selecionam repouso ou disparo, enquanto o clipe interno anima durante movimento e ação. O registro usa `weaponX` e `weaponY` de `GameCharacter` e `GamePlayer.addWing`. A lápide usa `asset.game.tombAsset` de `game.swf`; a alma recompõe o quadro 36 e o rosto reduzido em escala de cinza, com os corpos animados `ghostManMovieAsset` e `ghostGirlMovieAsset` do `gameii.swf`, seguindo `GameCharacter.drawSoul`, `doAction` e `GamePlayer.die`. O movimento suave da alma é uma aproximação. Os hashes dos arquivos importados constam em `packages/client/public/character-effects/manifest.json`; a importação é reproduzida por `python scripts/import-character-effects.py /caminho/ddtank-reborn`. Conversão SWF local do clone `dab2b445f153a6852b48182d4afe5c43ebbe3e16`.

O rosto SOUL usa a origem original `GameCharacter._body=(-62,-83)` e deslocamento de composição `(7,5)` após escala 0,75; o corpo animado usa `ghostMovie=(-26,-50)` no mesmo sistema de coordenadas. O registro de pés `(-62,-91)` usado para o avatar vivo não deve ser aplicado à alma.
