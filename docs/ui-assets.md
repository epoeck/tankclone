# UI e assets do DDClank

Guia de formato entre a arte e o código. Nome do jogo, pela logo do Izzy: **DDClank — O Retorno**.

## Identidade

- Latão rebitado (primária), brasa laranja (ação e perigo), contorno azul-marinho `--ink` em tudo, sombra roxa deslocada sem blur (o "adesivo" da logo), asas brancas e engrenagens como motivos.
- Fontes: **Lilita One** (títulos, botões, números grandes) e **Nunito** (texto). Ambas OFL, empacotadas em `public/assets/fonts/`.
- Tokens em `packages/client/src/ui/tokens.css`. Componentes em `packages/client/src/ui/components.css`. Não use cor solta fora dos tokens.

## Telas de referência

`packages/client/dev/design.html` (abra com `npm run dev -w @tankclone/client` e vá em `/dev/design.html`). São 6 telas 1280×720 em HTML estático com as classes prontas:

1. Entrada (apelido + senha)
2. Saguão (lista de salas, quem está online, conversa geral)
3. Sala (times azul/vermelho com 4 vagas, mapa, tempo de turno, arma, Iniciar)
4. Partida (HUD: ordem de turno, vento + relógio, minimapa, console com vida/energia, força, itens 1–8/F, ângulo, pressão)
5. Oficina (perfil, slots de equipamento, atributos, inventário)
6. Visual (pele, cabelo, cor do cabelo, rosto)

Menus e HUD são **HTML/CSS por cima do canvas**. O canvas desenha só mapa, tanques, projéteis e efeitos.

## Nomes próprios usados na UI

| Interno / original | Na UI |
|---|---|
| fúria | **Pressão** (manômetro de vapor) |
| especial | **Estouro** |
| FC (força de combate) | **Poder** |
| Canhão Arco-Íris | **Prisma** |
| Quebra-Tijolos | **Marreta** |
| Fogo Intenso | **Fornalha** |
| pets | **Mascotes** |
| item 1 / 2 / 3 | Rajada (+2 tiros) / Leque (triplo) / Bis (+1 tiro) |
| item 4–8 | Pólvora +50 / +40 / +30 / +20 / +10% |
| F | Voo |

Os ids de dados podem continuar neutros (`item-1`, `weapon-prism`); só o texto exibido muda.

## Arquivos

```
packages/client/public/assets/
  manifest.json          id -> { file, w, h, anchor }   (anchor em fração 0..1 do tamanho)
  brand/  logo.png (fundo transparente, 1200×531)  mark.svg (emblema/ícone)
  fonts/  lilita-one-latin.woff2  nunito-latin-var.woff2  LICENSE.txt
  ui/items/    item-1..item-8, item-f        64×64
  ui/stats/    stat-atk, -def, -agi, -luck, -hp, -armor, -dmg, -energy, -power, -xp, icon-lock, -gear, -crown, -chat   32×32
  ui/weapons/  weapon-prism, -sledge, -furnace   96×48
  ui/hud/      wind-arrow, pressure-gauge + pressure-needle (mesmo centro), angle-dial, shell, turn-marker
  chars/<camada>/<camada>-<n>.svg   boneco em camadas, 96×128, pés em (48,124), olhando para a direita
  maps/        miniaturas 160×90 dos 5 mapas provisórios
```

### Regras para o código

- Carregue sempre pelo `manifest.json` (ids estáveis). Arte nova troca o arquivo, não o id.
- SVG no canvas: carregue como `Image` e rasterize no tamanho do manifest × devicePixelRatio (ou `this.load.svg(id, file, { width, height })` no Phaser).
- **Boneco em camadas** (placeholder; o sistema é o que importa). Todas as camadas têm canvas 96×128 com os pés em (48,124), então empilham sem ajuste. Ordem de trás para frente: `wings`, `hair-back`, `body`, `outfit`, `face`, `hair-front`, `glasses`, `hat`, `weapon`, `arm`. Opções hoje: body 1, face 3, hair 3 (cada um em `hair-back-n` + `hair-front-n`), outfit 3, hat 2, glasses 1, wings 1. Em hat, glasses e wings o índice 0 = sem item.
- Aparência base (escolhida pelo jogador): pele, rosto, cabelo, cor do cabelo. Equipamento (vem do item): roupa, chapéu, óculos, asas, arma.
- **Cor de pele e de cabelo por tinta:** `body`, `arm` e `hair-*` usam `currentColor`, e a raiz do SVG tem `color="#..."` com a cor padrão. Carregue o SVG como texto, troque esse atributo pelo hex escolhido e rasterize. Paletas em `manifest.json > character.tint` (6 peles, 8 cores de cabelo). Sombras e brilhos são pretos/brancos translúcidos, então funcionam com qualquer cor.
- **Braço + arma giram juntos** em torno do ombro (56,82). O braço (`arm-1`, 48×20) aponta para a direita com pivô em (8,10) do arquivo; a mão fica em (38,10). A arma (`ui/weapons/*`, 96×48) tem o cabo em (10,27) e vai presa na mão, escalada para ~55%.
- Escala no jogo: boneco com ~52 px de altura → escala 0,433. O projétil nasce no ponto da física (`MUZZLE_HEIGHT` = 30 px acima dos pés); visualmente fica perto da ponta da arma entre 30° e 60°.
- Virar para a esquerda = espelhar X do grupo inteiro.
- Ponteiro da pressão: `rotate(-135° + pressão × 270°)` em torno do centro (70, 70).
- Barra de força: CSS `--power` (0–100%) e `--last` (último tiro). Ângulo: `--angle` em graus absolutos.
- Energia (240 + AGI/30): barra `.bar--energy` com `.bar__cost` mostrando o custo dos itens escolhidos (posição = energia restante).
- Texto nunca vai dentro de SVG (SVG como imagem não carrega a fonte do jogo). Número de tecla, custo e % são HTML sobre o ícone (`.slot__key`, `.slot__cost`, `.slot__tag`).

## Arquivos editáveis (ArtCraft)

Fonte editável de cada asset fica em `art/fontes/` no formato do ArtCraft (`.vectorcraft` para vetores). O que o jogo usa fica em `packages/client/public/assets/`. Fluxo para corrigir algo:

1. Abrir o `.vectorcraft` no VectorCraft e editar (uma camada por peça, com nome).
2. Exportar SVG por cima do arquivo correspondente em `public/assets/` (ou: `vectorcraft-cli convert art/fontes/ui/items/item-1.vectorcraft packages/client/public/assets/ui/items/item-1.svg`).
3. Manter o tamanho (viewBox) e a âncora do manifest; se mudar, atualizar o `manifest.json`.

## HUD da partida (disposição v2, pedida pelo Izzy em 2026-11-11)

Posições na tela 1280×720, seguindo a disposição do original (arte e nomes próprios):

| Onde | O quê | Classe |
|---|---|---|
| canto sup. esquerdo | meu boneco **em pé** num anel, nome, arma, nível | `.me` |
| abaixo dele | conversa e registro da partida, sem fundo | `.feed` |
| topo, à esquerda do centro | ordem de turno compacta | `.turns` |
| topo central | vento (seta + valor) | `.windbox` |
| abaixo do vento | relógio grande + botão Passar | `.clock` |
| canto sup. direito | minimapa com Opções e Sair | `.minimap` |
| abaixo do minimapa | rodada e vivos por time | `.roundinfo` |
| borda direita | itens 1–8 em coluna | `.itemcol` |
| canto inf. esquerdo | mostrador redondo de ângulo | `.dial` |
| embaixo, quase toda a largura | barra de força com régua 0–100 e dica | `.powerbar` |
| acima da barra | F (voo), Q (escudo, depois) e Estouro | `.skills` |
| canto inf. direito | Z/X/C (depois), energia, vida, manômetro de pressão | `.zxc`, `.vitals2`, `.gauge` |

- Nome, nível e vida de cada boneco ficam **abaixo** dele no mapa (`.nameplate--below`).
- Dentro da partida o boneco fica **agachado** e só a cabeça balança (`.char--crouch`; números em `manifest.json > character.poses`). Em pé só no inventário, no saguão, na sala e no retrato `.me`.
- Para poder balançar a cabeça, o corpo foi separado: `chars/body/body-1` (corpo) e `chars/head/head-1` (cabeça, tinta de pele).
- Projétil escuro para contraste (`ui/hud/shell.svg`, quase preto com halo claro). Se o projétil for desenhado no canvas, use `#1b1d24` com contorno claro.
- Força: segurando Espaço, a barra vai de 0 a 100 e volta; soltar atira; se voltar a 0 sem soltar, passa a vez.
