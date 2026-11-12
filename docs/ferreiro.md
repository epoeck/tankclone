# Ferreiro, composição e loja

Decisão do dono (2026-11-12): **tudo garantido, sem sorteio**; recursos comprados na loja com gold; na fase de testes cada
recurso custa 1 gold. Botão **Ferreiro** no saguão e na sala.

## Fortalecer (+0 a +12)
- Regra do CN 14.7 (`loadstrengthexp.xml`), a mesma do sistema "6600" do Reborn: cada pedra soma EXP fixa; ao completar a
  EXP do próximo nível a arma sobe, e a sobra fica no nível novo. EXP por nível: 10, 50, 150, 350, 700, 1500, 2300, 3300,
  4500, 6000, 7500, 9000. Pedras Nv1–5 dão 10, 10, 15, 55 e 215 EXP (Property2, mínimo 10).
- "Subir de nível" gasta exatamente o necessário; nada se perde no +12.
- Dano-base da arma × 1,1^nível (Reborn `getHertAddition`): +12 = ×3,14.
- Modelo da arma (`itemstrengthengoodsinfo.xml`): +10/+11 → …2, +12 → …3 (brick2/brick3 etc.). As artes vêm de
  `scripts/import-cn-weapons.py` (CN, completando com o pacote "merged" do Reborn), só locais.

## Projéteis
`core/src/forge.ts` `WEAPON_BALLS` (ballconfig do Reborn): cada modelo tem bola comum, especial, +dano (AddWound) e +tiros
(MultiBall). Com uma bola só, o último item usado no turno decide: +1/+2 tiros → MultiBall; +% de dano → AddWound. O leque
de 3 e o especial mantêm suas bolas. As crateras seguem a bola-base da arma. Bibliotecas importadas por
`scripts/import-projectiles.py` (as que o Reborn tem convertidas; sem a variante, cai na bola-base).
Suposição: no original esse "Prop" (20002/20008) não está ligado no porte do Reborn; o mapeamento item → bola é nosso.

## Composição
Pedras Fênix (ATQ), Tartaruga (DEF), Dragão (AGI) e Tigre (SOR), Nv1–5 = 10, 20, 30, 40, 51 (CN 朱雀/玄武/青龙/白虎).
Grava o valor no atributo da arma (substitui o anterior), garantido. Os atributos somam nos stats da partida.

## Servidor
Tabelas `inventory` e `weapons`; mensagens `forge`, `buy`, `strengthen`, `compose` (respostas `{t:"forge"}`).
Compras e consumo são transacionais. A sala manda `weaponLevel` e `compose` no setup da partida.
