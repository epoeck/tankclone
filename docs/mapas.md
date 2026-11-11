# Como fazer um mapa (guia para o Izzy)

Um mapa são **3 arquivos** numa pasta, mais um comando que confere tudo.

```
packages/client/public/maps/<id>/
  manifest.json   nome, tamanho, pontos de nascimento
  art.png         a arte do chão (a imagem que aparece no jogo)
  mask.png        a máscara: onde é ar, chão que quebra e chão que não quebra
  background.png  (opcional) o céu/fundo; sem ele o jogo usa um degradê de céu
```
`<id>` é só letras minúsculas, números, `_` ou `-` (ex.: `ferro`). Os 5 mapas provisórios (`colinas`, `ferro`, `ilhas`, `forja`, `nuvens`) já estão lá, gerados por script, para você ver o formato.

## Tamanho
- **Altura: 600 px.** **Largura: 2000 a 3000 px** (os provisórios têm 2400). Tudo dentro do mapa usa 1 px de arte = 1 px de jogo; o boneco tem ~52 px de altura e a tela mostra 1000 px de largura por vez.
- `art.png` e `mask.png` precisam ter **exatamente o mesmo tamanho** (o comando recusa o mapa se forem diferentes).

## A máscara (`mask.png`): só 3 cores, sem suavização
| Cor | Significa |
|---|---|
| **preto** `#000000` | ar (vazio; quem cai aqui cai para fora do mapa e morre se não houver chão embaixo) |
| **branco** `#FFFFFF` | chão **destrutível** (tatuzável) |
| **vermelho** `#FF0000` | chão **indestrutível** (a cratera não apaga) |

- **Sem antisserrilhado.** Desligue a suavização/"anti-alias" da ferramenta (use lápis, não pincel macio). Bordas cinza viram aviso, e bordas de vermelho meio-vermelho também. Branco→preto com cinza no meio é tolerado (o jogo decide pela claridade: ≥ 50% = chão), mas vermelho precisa ser **vermelho puro**.
- A máscara pode ser desenhada em cima do guia do ArtCraft; só exporte em PNG sem transparência.
- 2 mapas da primeira build têm chão indestrutível (qualquer vermelho conta) e 3 são só brancos.

## A arte (`art.png`)
- É a imagem do terreno. O jogo **recorta a arte pela máscara**: onde a máscara é preto, a arte vira transparente (então o céu da arte some e aparece o `background.png`/degradê). Quando uma cratera abre, a arte some junto.
- Para gerar no Qwen: peça só o terreno (grama, terra, pedra, aço) preenchendo a silhueta da máscara; o fundo que sobrar é descartado pela máscara.

## `manifest.json`
```json
{
  "id": "ferro",
  "name": "Pátio de Ferro",
  "width": 2400, "height": 600,
  "art": "art.png", "mask": "mask.png",
  "background": "background.png",
  "spawns": { "1": [180, 330, 480, 630], "2": [2220, 2070, 1920, 1770] },
  "windMultiplier": 1
}
```
- `spawns`: o `x` (em px) onde nasce cada jogador, na ordem em que entram em cada time (até **4 por time**). Precisa haver **chão na coluna** e o ponto do topo não pode estar dentro do chão. Time 1 olha para a direita, time 2 para a esquerda.
- `windMultiplier`: 1 = vento normal; 1.5 = vento 50% mais forte neste mapa (opcional).

## Conferir e ativar
Dentro do `distrobox enter dev`, na pasta do projeto:
```
npm run maps:build -w @tankclone/core
```
Ele lê cada pasta, confere (tamanhos, % de ar/destrutível/indestrutível, bordas cinza/vermelho suave, chão sob os spawns), grava o `mask.bin` e o `index.json`. **✓** = ok, **!** = aviso (funciona, mas confira), **✗** = erro (o mapa não entra). Reinicie o servidor e o mapa aparece na lista de salas.

`npm run maps:generate -w @tankclone/core` recria os 5 provisórios que **ainda não existirem** (`-- --force` sobrescreve; cuidado, apaga a sua arte).
