# Adaptação do DDTank Reborn

Atualização de 2026-11-12, solicitada pelo dono. Complementa `docs/ddtank41.md`.
Fonte fixada: [thurdev/ddtank-reborn, commit dab2b445](https://github.com/thurdev/ddtank-reborn/tree/dab2b445f153a6852b48182d4afe5c43ebbe3e16).

## Alterações aplicadas

- **Delay das bolas = 200**, confirmado em `packages/fight/data/balls.json`, para as bolas
  101/111 (Prisma), 381/391 (Marreta) e 161/171 (Fornalha). Substitui o zero provisório.
- **Euler em float32**: `eulerStep` arredonda cada operação, incluindo o passo de 0,04 s.
  A física da partida passa a usá-lo com massa 10 e forças equivalentes aos parâmetros do mapa/bola.
  O perfil histórico `TABLE_PHYSICS` continua em double para comparar com as tabelas da comunidade.
- **Dano**: `CurrentDamagePlus` e `CurrentShootMinus` são convertidos para float32 antes das
  multiplicações, na ordem do código de referência. Não foram adicionados buffs ou sistemas novos.
- **Seis máscaras reais de explosão**, extraídas de `packages/fight/data/bombs.ddtb`:

| Arma | Bola comum | Máscara comum | Especial | Máscara especial |
|---|---:|---:|---:|---:|
| Prisma | 101 | 162 × 132 px | 111 | 180 × 146 px |
| Marreta | 381 | 114 × 86 px | 391 | 134 × 100 px |
| Fornalha | 161 | 132 × 100 px | 171 | 104 × 84 px |

As máscaras são dados de colisão, sem imagens novas. São guardadas por trechos horizontais,
embutidas no core e compartilhadas pelo cliente e servidor. O ponto de aplicação usa a coordenada
inteira do impacto menos metade inteira da largura/altura, como `Tile.Dig`.
O raio de dano continua separado do formato que cava o terreno.

`Terrain.carveShape` remove somente pixels destrutíveis. Nas bordas, recorta a máscara para dentro
do mapa; não reproduz as particularidades de escrita em bytes fora das bordas do Tile original.
O cliente também recorta a imagem pela máscara atual: chão indestrutível permanece visível.

**Leques simultâneos:** cada evento de tiro/impacto carrega `at`, em segundos na linha de animação
da partida. As bolas do leque saem no mesmo instante, com impactos na ordem de chegada. Disparos
extras começam depois do último impacto do leque anterior. `MatchPlayback` conserva a sobra de tempo
entre quadros e reproduz o mesmo log na reconexão. O servidor pausa pelo fim do último voo, sem somar
as durações das bolas simultâneas.

## Reprodução da importação

```bash
python scripts/import-reborn.py                  # busca somente os arquivos necessários do commit fixo
python scripts/import-reborn.py /caminho/clone   # usa uma cópia local do mesmo commit
```

Saídas: `packages/core/src/reference/reborn-craters.json`,
`packages/core/test/fixtures/reborn-golden.json` e avisos em `third_party/ddtank-reborn`.
O importador não executa código do repositório. Guarda hashes SHA-256 do pacote e das seis máscaras.
O código e os dados adaptados têm a atribuição e os avisos do projeto de origem preservados.

## Verificação e limites

- Os **500 passos** dos dez vetores Euler publicados pelo oráculo C# do Reborn batem exatamente
  em float32, tanto no integrador isolado quanto no `step` realmente usado pela partida.
- **21 casos de dano** compatíveis com o PvP atual batem com os inteiros publicados pelo oráculo.
  Casos com buffs, perfuração ou arma secundária ficam fora porque esses sistemas não existem aqui.
- Os **30 casos de delay** do oráculo também batem.
- As máscaras são comparadas pixel a pixel com os `.bomb` originais, incluindo alinhamentos, bordas,
  idempotência e chão indestrutível. Reaplicar os eventos reconstrói a mesma máscara do servidor.
- A reprodução é testada em 30/60/144 FPS, com impactos separados, leques, disparos sequenciais,
  logs de reconexão e pausa do relógio da sala.

Isso não equivale a portar todo o motor: o jogo mantém hitboxes próprias, ponto de saída do tiro,
busca do chão e colisão contínua de 1 px. A referência usa coordenadas inteiras, caixa de 6 × 6 px
e varredura de 3 px. Por isso, os testes de trajetória completa/colisão/terreno do Reborn não são
declarados como equivalentes; a igualdade comprovada é do integrador e dos cálculos listados acima.
