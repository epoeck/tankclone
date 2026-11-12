# Referência dos cálculos PvP

A adaptação posterior do Reborn está em `docs/ddtank-reborn.md`: confirma delay 200 das bolas,
acrescenta física float32, máscaras reais e apresentação simultânea dos leques.

Atualizado em 2026-11-12, por solicitação do dono. A referência para física e combate passa a ser
[pnkl1999/DDTank41](https://github.com/pnkl1999/DDTank41/tree/7fcb55290e4c7aabd6887d3c1ccd2621b5080924),
commit `7fcb55290e4c7aabd6887d3c1ccd2621b5080924`. As aproximações anteriores dos guias ficam como histórico.

## Física

- `Game.Logic/Phy/Maths/EulerVector.cs`, `Phy/Object/BombObject.cs` e `SimpleBomb.cs`: Euler semi-implícito em passos de **0,04 s**.
- `Tank.Request/LoadMapsItems.xml`: mapa padrão `Weight=10`, `DragIndex=2` (há uma exceção de peso 6, não usada nos mapas próprios).
- `Tank.Request/BallList.xml`: bolas usadas pelas três armas com massa 10, peso 70, vento 240 e arrasto 1.
- Portanto, na representação do core: gravidade **700**, arrasto **0,2**, aceleração por vento **24**.
- `Source Flash/src/game/view/EnergyView.as`: força máxima 2000. A barra própria continua 0–100, com **20 de velocidade por ponto**.
- `Living.ShootImp`: velocidades iniciais truncadas para inteiros. Leque central, força ×0,9 a −5° no ângulo de tela, força ×1,1 a +5°; conversão para a convenção de ângulo do core também considera o lado para onde o personagem olha.
- `BaseGame.GetNextWind`: vento muda gradualmente, em incrementos de até 1 por turno, buscando um alvo sorteado em −4 a 3,9. O PRNG continua próprio e semeado; não reproduz a sequência do Random do .NET.

O perfil antigo foi preservado como `TABLE_PHYSICS`, somente para os testes e o comando de calibração das tabelas da comunidade.
`DEFAULT_PHYSICS` agora é o perfil do repositório. Cliente e servidor recebem o tempo de voo, incluindo a fração do último passo;
a reprodução interpola pelo tempo decorrido, sem arredondar pontos por quadro.

## Dano, crítico e fúria

Fontes: `SimpleBomb.MakeDamage`, `Living.MakeCriticalDamage`, `Player.TakeDamage`, `TurnedLiving.SetDander`.
Para o PvP básico, sem buffs, pets ou perfuração:

```text
baseDamage = dano da arma + dano adicional dos equipamentos
DR1 = 0,95 × (armadura do alvo − 3 × nível do atacante) / (500 + armadura do alvo − 3 × nível do atacante)
DR2 = 0,95 × (defesa do alvo − sorte do atacante) / (600 + defesa do alvo − sorte do atacante)
      (zero quando a sorte supera a defesa)
dano = baseDamage × (1 + ataque × 0,001) × (1 − DR1) × (1 − DR2)
       × CurrentDamagePlus × CurrentShootMinus × queda radial
queda radial = 1 − distância / raio de dano / 4 (dentro do raio; fora, zero)
```

`DR1` pode ser negativo no servidor de referência; não é limitado artificialmente a zero.
O dano base é truncado antes do crítico, e o adicional do crítico também é truncado separadamente.
Taxa de crítico = `sorte × 45 / (800 + sorte)`, comparada com `>= Random.Next(100)`.
Essa comparação inclusiva permite crítico com sorte zero quando o sorteio é zero.
Bônus de crítico = `0,5 + sorte × 0,00015`, sem o teto provisório anterior.

`Stats.grade` permite informar o nível usado na fórmula; quando ausente, usa 1. A progressão das contas
continua sem acrescentar atributos às builds e não preenche esse campo automaticamente.

Fúria nativa de 0 a **200**, +20 por ataque ou passe; o HUD apresenta a escala como 0–100%.
Ao sobreviver a um golpe: `trunc((trunc(dano base × 2 / 5) + 5) / 2)`, excluindo o adicional crítico.
O especial custa 200. Energia continua `240 + trunc(AGI/30)`, já compatível com o repositório.

## Itens, armas e delay

`Tank.Request/TemplateAlllist.xml`, `bombconfig.xml` e `BallList.xml` conferem os custos e os parâmetros.
Mapeamento: Prisma → template 7007 / bolas 101 e 111; Marreta → 7010 / 381 e 391;
Fornalha → 7006 / 161 e 171. Nomes e arte continuam próprios.

| Tecla | Energia | Delay |
|---|---:|---:|
| 1 | 110 | 600 |
| 2 | 110 | 600 |
| 3 | 110 | 500 |
| 4 | 85 | 400 |
| 5 | 80 | 340 |
| 6 | 70 | 200 |
| 7 | 55 | 150 |
| 8 | 50 | 70 |
| F | 150 | 200 |

`AddAttackSpell` mantém os fatores 0,6 (+2 tiros) e 0,9 (+1 tiro), multiplicativos.
`AddBallSpell` multiplica **CurrentDamagePlus** por 0,5; `AddWoudSpell` soma bônus a esse mesmo acumulador.
A ordem importa: `24` resulta em multiplicador 1,0 e `42` em 0,75. Não aplicar outra redução de 0,5 depois.
Foi preservada a decisão do dono de permitir triplo uma única vez por turno.

O raio de dano comum é 55, independente da cratera. Nos especiais é 65, 65 e 45, respectivamente.
O especial da Fornalha usa **3 bolas no mesmo leque**, em vez de três disparos com a mesma trajetória.
O XML traz `Power` de 1,3 / 1,5 / 0,6 nos especiais, mas `SimpleBomb.MakeDamage` não usa `m_power`;
a adaptação segue o cálculo efetivamente executado, sem inventar um multiplicador a partir desse campo.

Delay de turno: `trunc(1600 − 1200 × AGI/(AGI+1200) + ATK/10)`.
O delay inicial participa da escolha de quem começa; a fila é normalizada ao selecionar a vez e o jogador
recebe novamente o delay de turno ao começar a agir. Itens somam seu próprio delay, independentemente da energia.
Passar soma 100; atirar soma `segundos inteiros gastos × 20`, mais os delays da arma e da bola.
Há uma particularidade no código: `PrepareShoot` limita esse tempo pelo identificador do modo de sala
retornado por `GetTurnWaitTime()`, não pela duração da outra sobrecarga. Assim, o limite é 3 no modo de 10 s
e 1 no modo de 5 s; essa particularidade também foi reproduzida.
Andar consome energia e tempo, sem converter energia diretamente em delay.

## Limites da equivalência

- `BallInfo.Delay` não aparece nos XMLs, mas foi confirmado depois no banco exportado pelo Reborn:
  `WeaponDef.ballDelay` agora é **200** para as três armas.
- Tempos de turno 10/5 s e limiar de FC continuam como decisão do projeto; a referência permite configurar a sala.
  A fórmula própria de FC permanece provisória.
- Crateras agora usam as seis máscaras importadas do Reborn. Hitboxes, ponto de saída do tiro,
  movimento em rampas e colisão contínua continuam na geometria do projeto.
- O core simula o leque contra o mesmo terreno e aplica os impactos por tempo de chegada.
  O cliente apresenta os voos simultaneamente e o servidor pausa pelo fim do leque.
- A integração agora reproduz os arredondamentos float32 do C#, com igualdade nos vetores publicados
  pelo Reborn. A geometria de colisão e o tempo parcial do último passo continuam próprios.
- Não foram adicionados sistemas fora do PvP básico (pets, pérolas, cartas, buffs, PvE).

## Verificação

`packages/core/test/fixtures/ddtank41.json` registra o commit, os valores dos XMLs e casos numéricos independentes.
Os casos de dano foram calculados separadamente; os de voo reproduzem as operações float32 do EulerVector.
Testes cobrem ordem dos itens, velocidades do leque, delay, crítico inclusivo, fúria e reprodução em 30/60/144 FPS.
