# UI e assets do DDClank

Guia de formato entre a arte e o código. Nome do jogo, pela logo do Izzy: **DDClank — O Retorno**.

## Identidade

- Latão rebitado (primária), brasa laranja (ação e perigo), contorno azul-marinho `--ink` em tudo, sombra roxa deslocada sem blur (o "adesivo" da logo), asas brancas e engrenagens como motivos.
- Fontes: **Lilita One** (títulos, botões, números grandes) e **Nunito** (texto). Ambas OFL, empacotadas em `public/assets/fonts/`.
- Tokens em `packages/client/src/ui/tokens.css`. Componentes em `packages/client/src/ui/components.css`. Não use cor solta fora dos tokens.

## Telas de referência

`packages/client/design.html` (abra com `npm run dev -w @tankclone/client` e vá em `/design.html`). São 5 telas 1280×720 em HTML estático com as classes prontas:

1. Entrada (apelido + senha)
2. Saguão (lista de salas, quem está online, conversa geral)
3. Sala (times azul/vermelho com 4 vagas, mapa, tempo de turno, arma, Iniciar)
4. Partida (HUD: ordem de turno, vento + relógio, minimapa, console com vida/energia, força, itens 1–8/F, ângulo, pressão)
5. Oficina (perfil, slots de equipamento, atributos, inventário)

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
  sprites/tank/ tank-tracks, tank-hull, tank-flag-blue|red, tank-turret (120×96), tank-barrel (72×24)
  maps/        miniaturas 160×90 dos 5 mapas provisórios
```

### Regras para o código

- Carregue sempre pelo `manifest.json` (ids estáveis). Arte nova troca o arquivo, não o id.
- SVG no canvas: carregue como `Image` e rasterize no tamanho do manifest × devicePixelRatio (ou `this.load.svg(id, file, { width, height })` no Phaser).
- **Tanque em camadas**, de trás para frente: `tank-tracks`, `tank-hull`, `tank-flag-{team}`, `tank-barrel`, `tank-turret`. Âncora das camadas de 120×96: pés em `(60, 92)`. O cano gira em torno de `(8, 12)` do próprio arquivo, montado no centro da torre `(60, 46)`. Com escala 0,7 o centro da torre fica ~32 px acima dos pés, perto do `MUZZLE_HEIGHT` de 30 px da física.
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
