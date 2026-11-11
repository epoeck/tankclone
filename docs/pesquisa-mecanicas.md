# Pesquisa de mecânicas do original (2026-11-11)

Fontes públicas de jogadores (blogs, guias). **Nenhum código vazado foi consultado nem deve ser.** Confiança:
**alta** = várias fontes concordam ou confirmado pelo Izzy; **média** = uma fonte coerente; **baixa** = fontes conflitantes ou suposição.
Tudo aqui vira **dado configurável** (JSON) para ajustar depois sem mexer em código.

## 1. Itens de batalha (teclas 1–8)

Mapeamento padrão das teclas 1–8 (fonte: tutorial pt-BR [i227](https://i227.blogspot.com/2012/03/tutorial-completo-ddtank.html)) e custo de
energia (fonte: guia chinês [4399](http://web.4399.com/ddt/youxigonglue/201106/26-10089.html)).

| Tecla | Item | Efeito | Energia | Confiança |
|---|---|---|---|---|
| 1 | +2 tiros | 2 disparos extras; −40% de dano por disparo (4399 diz −50%) | 40 | média |
| 2 | Tiro triplo | 3 projéteis num disparo, em leque; −50% de dano por projétil | 40 | média |
| 3 | +1 tiro | 1 disparo extra; −20% (4399 diz −10%) | 40 | média |
| 4 | +50% dano | | 40 | média |
| 5 | +40% dano | | ~33 | média |
| 6 | +30% dano | | 25 | média |
| 7 | +20% dano | | 20 | média |
| 8 | +10% dano | | 20 | média |
| F | Voar (avião de papel) | o personagem vai até onde o projétil cai; tiro sem dano | 80 | média |

Checagem com a memória do Izzy (energia base 220):
- "124" (tatuzar) = +2 tiros + triplo + 50% = 120 de energia → sobra ~100 (≈1 distância de caminhada). Coerente.
- "1446" (dano) = +2 tiros + 50% + 50% + 30% = 145 → sobra ~75. Coerente.
- Um guia de outra versão ([doyo](https://www.doyo.cn/article/11674), energia 240) lista custos bem maiores (+1/+2 = 110, +50% = 85).
  Com esses números o "1446" não caberia em 220, então **adotamos os custos do 4399**.

Regras que se deduzem dos combos (a confirmar): itens de dano **somam** (+50 +50 +30 = +130%); vários itens podem ser usados no mesmo turno;
+2 tiros e triplo combinam.

Itens para depois (fora da build PvP): Q = escudo / "dom de anjo"; Z/X/C = auxiliares (C = invisibilidade, 3 turnos); cura (300 HP, encerra o turno),
cura de time (200 HP), congelar (2 turnos), inverter vento, teleporte, guiado (−50% dano), "enfurecer" (+50% fúria).

## 2. Armas da build PvP

Fontes: [Crônicas de um Jogador](http://cronicasdeumjogador.blogspot.com/2013/03/tipos-de-armas.html),
[DDtank de jogador para jogador](https://ddtankdejogadorparajogador.blogspot.com/p/equipamento.html),
[DDTank na net](https://ddtank-na-net.blogspot.com/p/armas-do-jogo.html). Dano base informado pelo Izzy.

| Arma (inspiração) | Dano base | Faixa de ângulo | POW (especial) | Perfil |
|---|---|---|---|---|
| Canhão Arco-Íris | 200 | 55°–70° (estreita) | tiro único | defensiva (muita vida/defesa); cratera grande, boa para tatuzar |
| Quebra-Tijolos | 200 | 20°–65° (a mais larga) | tiro único forte | equilibrada; ruim para tatuzar |
| Fogo Intenso | 205 | 20°–50° | 3 disparos (difícil acertar os 3; usar ângulo alto/perto) | ofensiva |

**Faixa de ângulo por arma é mecânica central** e hoje não existe no código. Raio da cratera, fator de vento e o efeito exato de cada especial
**não foram encontrados**: entram como placeholders configuráveis e o Izzy ajusta jogando.

## 3. Fórmula de dano (hipótese, confiança baixa/média)

Guia [4399](http://web.4399.com/ddt/youxigonglue/201106/08-34654.html) (exemplo numérico reproduzido) + [ali213](https://app.ali213.net/gl/1390117.html):

```
dano_bruto = (dano_base_arma × (1 + forja × 12%) + ATK_total / 10) × (1 + Σ bônus%)    # forja = 0 na 1ª build
armadura   = armadura_equips + DEF / 25
redução    = armadura / (armadura + 100)                                            # ali213; combinação com o 4399 é suposição
dano_final = dano_bruto × (1 − redução) × queda_radial(distância ao centro)
crítico:   chance = SORTE / 20 (%)   bônus de dano crítico = SORTE / 25
```

Exemplo do 4399 (Fogo Intenso +8, ATK somado 560, +50+50+30 e fúria +50%): (205 × 1,96 + 56) × 2,8 = 1281,8. Vira teste de regressão
quando houver forja. Queda radial e dano de queda **não encontrados** → placeholders.

## 4. Turnos, energia e fúria

- **Delay** (fonte oficial de servidor TW, [efunfun](https://ddt.efunfun.com/guide-04.htm)): valor oculto que define a ordem; mover e usar itens
  aumentam o delay; **agilidade reduz o delay ganho por turno**. Primeiro turno: maior agilidade começa. Depois joga quem tem menor delay acumulado.
  Passar a vez gasta menos delay, então volta mais cedo.
- **Energia (movimento)**: zera → não anda; volta ao valor inicial no próximo turno. Base 220 ≈ 2,2 distâncias (Izzy). Agilidade/equips aumentam (Izzy).
- **Fúria**: 0–100; cheia libera o especial da arma. Enche ao atacar, ao passar e ao levar dano (Izzy). Valores por evento **não encontrados** → configurável.
- **Tempo de turno**: 10 s; 5 s acima de um limiar de FC (Izzy).

## 5. Pérolas (nível 18; fase própria)

Fonte: [DDTank World](http://ddtworld7.blogspot.com/p/perolas.html) (versão ~2012; a de 2022 precisa de confirmação do Izzy).
Três tipos: **ataque** (ativa ao atirar: Ataque, Sorte, Dano, Míssil, Gelo, Bomba Atômica, Perfurante, Crítico, Vampiro, Selo, Leopardo,
Cansaço, Queimação, Algemas, Duplo Ataque, Enfraquecer), **defesa** (ativa ao levar dano: Pele de Pedra, Resistente, Recuperação,
Evita Buraco, Diminuir Dano, Absorção, Raiva) e **atributo** (passivas: ATK, DEF, AGI, Sorte, Dano, Armadura).
Faltam: slots, níveis, síntese/experiência e números → perguntar ao Izzy quando chegar a fase.
