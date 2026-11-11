# Arte do DDClank

- `fontes/` — projetos editáveis do ArtCraft (`.vectorcraft`). Abra no **VectorCraft** para editar.
  Mesma estrutura de pastas de `export/` (ex.: `fontes/ui/items/item-1.vectorcraft` ↔ `export/ui/items/item-1.svg`,
  `fontes/chars/body/body-1.vectorcraft` ↔ `export/chars/body/body-1.svg`).
  Cada arquivo tem uma camada com o nome do asset e objetos nomeados (`circulo-2-steel`, `forma-1-pele`…;
  nos personagens, os `<g>` do SVG viram grupos com o mesmo nome, ex.: `corpo`, `cabeca`).
- `export/` — espelho do que o jogo usa (`packages/client/public/assets`), com `manifest.json`. Não edite à mão:
  edite o `.vectorcraft` e reexporte.
- `_obsoleto/` — arte que saiu do jogo (o antigo tanque, `export/` e `fontes/`). Fica só como histórico.

## Personagem (boneco em camadas)

O personagem é um boneco montado por camadas sobrepostas, todas numa prancheta de **96×128**
(menos o braço), com os **pés em (48, 124)** — esse é o ponto de ancoragem no chão.

Ordem de desenho, de trás para frente:

| # | camada (`chars/…`) | observação |
|---|---|---|
| 1 | `wings` | asas |
| 2 | `hair-back` | parte de trás do cabelo (cor de cabelo) |
| 3 | `body` | corpo e cabeça (cor de pele) |
| 4 | `outfit` | roupa |
| 5 | `face` | rosto |
| 6 | `hair-front` | franja (cor de cabelo) |
| 7 | `glasses` | óculos |
| 8 | `hat` | chapéu |
| 9 | `weapon` | arma |
| 10 | `arm` | braço da frente (cor de pele), prancheta 48×20, gira em torno do ombro |

O braço (`arm-1`) tem o ponto de giro em **(8, 10)** do próprio arquivo; no boneco esse ponto fica em
**(56, 82)** e o braço gira com o ângulo de mira.

`fontes/chars/boneco-montado.vectorcraft` é o boneco montado (asas, cabelo-tras, corpo, roupa, rosto,
cabelo-frente, oculos e braço a −20°), uma camada nomeada por peça — **só para referência**, não é exportado.

### Cor de pele e de cabelo (`currentColor`)

`body`, `arm`, `hair-back` e `hair-front` pintam pele/cabelo com `fill`/`stroke="currentColor"` e têm a cor
padrão no atributo `color` do `<svg>` raiz; o jogo troca esse `color` para mudar a pele ou o cabelo.

| camadas | cor padrão (cor-chave) |
|---|---|
| `body`, `arm` | `#F2C79F` (pele) |
| `hair-back`, `hair-front` | `#6B3A1F` (cabelo) |

**O VectorCraft não preserva `currentColor`**: ao importar, ele vira a cor literal, e o SVG reexportado sai com
`fill="#f2c79f"` e sem o atributo `color`. Por isso a cor padrão funciona como **cor-chave**: nesses arquivos ela
só aparece onde era `currentColor` (há uma amostra `currentColor pele #F2C79F` / `currentColor cabelo #6B3A1F`
no painel de amostras). Ao editar, pinte a pele/cabelo exatamente com essa cor e não use essa cor para mais nada.
Não mude a cor dessas partes no VectorCraft — quem troca a cor é o jogo.

Para reexportar, use o script. Ele converte, troca a cor-chave de volta por `currentColor` e põe o `color` no `<svg>`:

```bash
art/reexportar.sh art/fontes/chars/body/body-1.vectorcraft
```

(saída padrão: o mesmo caminho em `art/export/…`; aceita um 2º argumento com outro destino.) À mão, é o mesmo que:

```bash
vectorcraft-cli convert art/fontes/chars/body/body-1.vectorcraft art/export/chars/body/body-1.svg
sed -i -E -e 's/(fill|stroke)="#F2C79F"/\1="currentColor"/Ig' \
          -e '0,/<svg /s//<svg color="#F2C79F" /' art/export/chars/body/body-1.svg
```

(para `hair-back`/`hair-front`, troque `F2C79F` por `6B3A1F`; o `sed` é o GNU, do Linux.) Confira com
`grep -c currentColor art/export/chars/body/body-1.svg` — tem que dar mais que 0.

## Reexportar um arquivo editado

```bash
vectorcraft-cli convert art/fontes/ui/items/item-1.vectorcraft art/export/ui/items/item-1.svg
```

(ou `art/reexportar.sh` com o `.vectorcraft`, que faz o mesmo e ainda cuida do `currentColor` dos personagens;
sem `--outline-text`, para texto continuar como texto; o tamanho/viewBox vem da prancheta do arquivo.)
Depois copie o SVG para `packages/client/public/assets/` no mesmo caminho relativo.

No repositório (GitHub) só vão `fontes/`, `README.md` e `reexportar.sh`; o `export/` existe só no PC. No repositório, o destino do SVG reexportado é `packages/client/public/assets/<mesmo caminho>.svg` (passe como 2º argumento do script).
