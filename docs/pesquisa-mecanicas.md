# Pesquisa de mecânicas do original (2026-11-11)

Fontes públicas de jogadores (blogs, guias). **Nenhum código vazado foi consultado nem deve ser.** Confiança:
**alta** = várias fontes concordam ou confirmado pelo Izzy; **média** = uma fonte coerente; **baixa** = fontes conflitantes ou suposição.
Tudo aqui vira **dado configurável** (JSON) para ajustar depois sem mexer em código.

## 1. Itens de batalha (teclas 1–8)

Mapeamento padrão das teclas 1–8 (fonte: tutorial pt-BR [i227](https://i227.blogspot.com/2012/03/tutorial-completo-ddtank.html)) e custo de
energia (fonte: guia chinês [doyo](https://www.doyo.cn/article/11674); teclas 1 e 4 confirmadas pelo dono).

| Tecla | Item | Efeito | Energia | Confiança |
|---|---|---|---|---|
| 1 | +2 tiros | 2 disparos extras; **−40%** de dano por disparo | 110 | alta (dono; doyo e i227 batem) |
| 2 | Tiro triplo | 3 projéteis num disparo, em leque; −50% de dano por projétil; **só 1 vez por turno** | 110 | alta (dono) |
| 3 | +1 tiro | 1 disparo extra; **−10%** de dano por disparo | 110 | alta (dono; doyo e 4399 batem) |
| 4 | +50% dano | | 85 | alta (dono) |
| 5 | +40% dano | | 80 | alta (dono) |
| 6 | +30% dano | | 70 | alta (dono) |
| 7 | +20% dano | | 55 | alta (dono) |
| 8 | +10% dano | | 50 | alta (dono) |
| F | Voar (avião de papel) | o personagem vai até onde o projétil cai; tiro sem dano | 150 | alta (dono) |

- **Correção (dono, 2026-11-11):** a tecla 1 custa **110** e a 4 custa **85**, e com a energia inicial só dá para jogar "14". Isso bate com o guia
  [doyo](https://www.doyo.cn/article/11674): +1/+2 tiros 110, triplo 110, +50% 85, +40% 80, +30% 70, +20% 55, +10% 50, teleporte/voar 150.
  **Adotamos os custos do doyo**; os do 4399 eram de outra versão. "124" e "1446" só cabem com a energia maior de fim de jogo.

Regras que se deduzem dos combos (a confirmar): itens de dano **somam** (+50 +50 +30 = +130%); **todos os itens repetem no turno, exceto o 2 (triplo)** (confirmado pelo dono);
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

**Implementado** em `core/src/stats.ts` (`DamageConfig` guarda os divisores). Suposições minhas: o stat "Dano" dos equipamentos soma ao dano base da arma;
FC (placeholder) = (ATK+DEF+AGI+Sorte+Dano+Armadura) × Vida / 200, que dá ≈ 359,0 milhões na conta de referência (forma suposta, 1 ponto).
**Problema de escala:** com a conta de referência atacando outra igual, bruto ≈ (200+8912+3328) = 12 440 e armadura ≈ 8550+28663/25 ≈ 9 700 → redução 99% → ~124 de dano contra 531 164 de vida (~4 300 tiros). O jogo real não é assim; a constante K = 100 de A/(A+K) ou a própria forma devem ser de outra escala. **Perguntar ao dono** quanto dano/vida vê no fim de jogo. Crítico: com Sorte 26 078 as fórmulas cruas dão 1 300% de chance; usei tetos provisórios (100% de chance, +100% de dano).

**Hipótese (planejadora, a confirmar com o dono):** o painel do original provavelmente já mostra valores **finais** — a "Armadura 8550" já incluiria a parte vinda da DEF e o "Dano 8912" já incluiria o dano da arma. Aplicar a fórmula de 2011 por cima conta tudo em dobro e é um dos motivos do ~124. Nada foi alterado no código; tudo segue configurável até a resposta do dono.

**Decisão do dono (item 32 de decisoes.md):** a build PvP usa a escala antiga (2011), vida ~5000 e K = 100; a escala de 2022 fica para quando houver forja/pérolas/pets. A hipótese acima fica registrada para essa etapa.

Exemplo do 4399 (Fogo Intenso +8, ATK somado 560, +50+50+30 e fúria +50%): (205 × 1,96 + 56) × 2,8 = 1281,8. Vira teste de regressão
quando houver forja. Queda radial e dano de queda **não encontrados** → placeholders.

## 4. Turnos, energia e fúria

- **Delay** (fonte oficial de servidor TW, [efunfun](https://ddt.efunfun.com/guide-04.htm)): valor oculto que define a ordem; mover e usar itens
  aumentam o delay; **agilidade reduz o delay ganho por turno**. Primeiro turno: maior agilidade começa. Depois joga quem tem menor delay acumulado.
  Passar a vez gasta menos delay, então volta mais cedo.
- **Energia (movimento)**: zera → não anda; volta ao valor inicial no próximo turno. **Energia = 240 + AGI/30** (regra AGI/30 do Izzy; base 240 deduzida do print §6: 240 + 29551/30 = 1225, exato; o Izzy lembrava 220).
- **Fúria**: 0–100; cheia libera o especial da arma. Enche ao atacar, ao passar e ao levar dano (Izzy). Valores por evento **não encontrados** → configurável.
- **Tempo de turno**: 10 s; 5 s acima de um limiar de FC (Izzy).

## 5. Pérolas (nível 18; fase própria)

Fonte: [DDTank World](http://ddtworld7.blogspot.com/p/perolas.html) (versão ~2012; a de 2022 precisa de confirmação do Izzy).
Três tipos: **ataque** (ativa ao atirar: Ataque, Sorte, Dano, Míssil, Gelo, Bomba Atômica, Perfurante, Crítico, Vampiro, Selo, Leopardo,
Cansaço, Queimação, Algemas, Duplo Ataque, Enfraquecer), **defesa** (ativa ao levar dano: Pele de Pedra, Resistente, Recuperação,
Evita Buraco, Diminuir Dano, Absorção, Raiva) e **atributo** (passivas: ATK, DEF, AGI, Sorte, Dano, Armadura).
### 5.1 Layout da versão de ~2022 (captura de tela do Izzy, 2026-11-11)
- Painel "Pérolas" na mochila (abas vizinhas: Dado, Treino, Cartas, Totem).
- **Centro (triângulo): 3 slots** — 1 pérola de **ataque** (no topo; ex.: Leopardo Nv 21) e 2 de **defesa** (embaixo; ex.: Absorção Nv 21,
  Evita Buraco Nv 19).
- **Anel + fileira de baixo: ~15 slots de pérola de atributo** (ex.: "Dano de ataque"), todas passivas.
- Slots extras: "Pérola Avanço", "Atualizar Joia", "Encaixe de pérola preciosa de atributo".
- **"Canal de Aumento de Nível de Pérolas"** com barra de % (subir nível das pérolas). Níveis vistos: 19–21.
- Obtenção: **4 estandes** clicáveis para abrir pérolas, opção "Abertura Contínua", limite de compras ("pode comprar Pérola 6 vezes").
- Pérolas podem ser **travadas** (cadeado) para não serem consumidas por engano.

Faltam: como funciona o canal de nível (o que consome), os estandes (custo/chances) e os números por nível → perguntar ao Izzy na Fase F.

## 6. Conta de referência (print do Izzy, 2026-11-11; conta de fim de jogo)

| Stat | Valor | | Stat | Valor |
|---|---|---|---|---|
| Ataque | 33281 | | Dano | 8912 |
| Defesa | 28663 | | Armadura | 8550 |
| Agilidade | 29551 | | Vida | 531164 |
| Sorte | 26078 | | Força física (energia) | 1225 |
| Ataque mágico | 9957 | | Resistência mágica | 15048 |
| FC | ~359 milhões (cortado no print) | | | |

Uso: escala de números para testes de sanidade das fórmulas (ex.: energia confere exato com 240 + AGI/30). Abas do perfil em 2022:
Dado, Treino, Cartas, Totem, Pérolas, Figura, Pedra, Templo, Batismo, Contramarca — só Pérolas e Cartas estão no escopo.
