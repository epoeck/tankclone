# Dano no pacote local DDT CN 14.7

Inspeção estática em 2026-11-12 do pacote `../DDT-CN-14.7/NaiKuaiDDT`.
Estas são regras **deste servidor distribuído no pacote**, não uma confirmação das regras
de todo servidor oficial 14.7. Nenhum executável foi iniciado e nenhum banco foi restaurado.
O combate do projeto permanece inalterado, usando a referência 4.1 descrita em `ddtank41.md`.

## Origem e verificação

`Service/Fight/Fighting.Service.exe` contém `Game.Logic.dll` embutida como recurso Costura
`costura.game.logic.dll.compressed` (Deflate sem cabeçalho). Os métodos abaixo foram lidos
diretamente do IL da DLL extraída com `dnfile` e `dncil`.

- SHA-256 do EXE: `fdf9bb6e0f5ae03c7771a3c54b2809aff8b9801f64d4805073cbe20ecf788bbe`.
- SHA-256 de Game.Logic.dll: `a8c8e70c71428697f1e0a394e74526d6151a4c60a4479daf63b560205281c0ff`.
- O EXE de `Service/Fight - 副本` tem o mesmo hash.
- `Game.Logic.Phy.Object.SimpleBomb.MakeDamage`: RVA `0x43040`.
- `Game.Logic.Phy.Object.Living.MakeCriticalDamage`: RVA `0x2319c`.
- `Game.Logic.Phy.Object.Living.TakeDamage`: RVA `0x24888`.
- `Game.Logic.Phy.Object.Player.TakeDamage`: RVA `0x3dd04`.

## Atributos de entrada

`Player.Reset` recebe `BaseDamage` de `IGamePlayer.BaseAttack`, `BaseGuard` de
`IGamePlayer.BaseDefence` e `Attack`, `Defence`, `Lucky` do personagem. Depois soma
`DameAddPlus`, buffs de dano e aplica ajustes específicos de modos e sistemas.
Logo, `BaseDamage` já é um atributo agregado: não se deve somar novamente o dano da arma
a um valor de Dano que já o inclua. A composição completa de `IGamePlayer.BaseAttack`
no serviço Road não foi rastreada nesta inspeção.

Notação abaixo:

- `D`: BaseDamage após modificadores anteriores à fórmula.
- `A`: Attack do atacante.
- `G`: BaseGuard + AvoidInjury do alvo, após efeitos de armadura.
- `F`: Defence do alvo, após efeitos de defesa.
- `S`: SunderArmor do atacante, limitado superiormente a 2500; em PvE vira zero.
- `P`: CurrentDamagePlus; `M`: CurrentShootMinus.
- `r`: distância calculada por Living.Distance; `R`: raio de dano da bola.

## Dano físico por modo

O bloco central de `MakeDamage` está nos offsets IL `0x02ba–0x0425`:

```text
DR_armadura = min((G - S) / 12000, 0,6)
DR_defesa   = min(F / 80000, 0,9)

Freedom (1) e demais modos que entram no ramo padrão:
  físico = D × (0,6 + A × 0,00008)
             × (1 - DR_armadura) × P × M × (1 - DR_defesa)
             × (1 + D / 10000)

Match (0):
  físico = D × A × 0,0001 × P × M × (1 - DR_defesa) / 3

PeakBattle (77):
  DR_defesa = min(F / 18000, 0,9)
  físico = D × A × 0,001 × P × M × (1 - DR_defesa)
```

Os nomes/IDs foram conferidos no enum `Game.Logic.eRoomType`. Há apenas teto nas duas
reduções, sem piso zero nesse bloco. Match e PeakBattle não utilizam DR_armadura na
expressão física, embora ela seja calculada antes. Não subtraem Sorte da Defesa,
nem usam `3 × nível` na armadura.

Dentro do raio (`r < R`), o físico recebe `1 - r/R/4`: 100% no centro e aproximação
de 75% na borda. Fora do raio, o caminho comum de `BombImp` retorna zero, pois chama
`MakeDamage(alvo, false)`. Esse segundo argumento permite outro comportamento em
outros chamadores; não generalizar a todos os usos do método.

## Outras parcelas e ordem dos efeitos

Antes da fórmula:

- `AddArmor` soma o bônus do escudo à armadura e à defesa.
- `IgnoreArmor` multiplica G e F por 0,6.
- `AddDamage > 0` aumenta D pelo percentual indicado.
- `IgnoreGuard`, quando positivo e sem IgnoreArmor, reduz G e F pela diferença
  para `GuardDefence` do alvo. A defesa mágica recebe uma redução própria.

Depois da queda radial, o método acrescenta:

```text
mágico = max(0, MagicAttack × 0,8 - MagicDefence × 0,5)
elemental = max(0, ataque do elemento do emblema - defesa correspondente)
resultado = físico_com_queda + mágico + elemental
```

Nesse caminho, essas duas parcelas não recebem a mesma queda radial, P e M do físico.
Os elementos tratados são fogo, vento, terra, água, luz e trevas.

Há exceções por nome da bola: `11464` aumenta o resultado pelo tempo de voo tratado
pelo método (tempo abaixo de 3 vira 2; acima de 10 vira 10); `11422` altera o raio
para 200 e acrescenta dano proporcional à distância horizontal / 200.
Há ainda somas específicas de PvE e uma substituição da fórmula quando BaseGuard
do alvo é pelo menos 100000. Portanto, a expressão física isolada não explica todos os golpes.

Ao final, `KeepLife` devolve zero. Resultado não positivo devolve 1 nesse trecho;
nos demais casos o retorno é:

```text
trunc(resultado × ExtraDamage) × (100 + CulturalAdd_do_alvo) / 100
```

A última divisão é inteira. `CulturalAdd` recebe teto 30 e, apesar do nome/contexto,
**a operação aqui aumenta o dano recebido**. `ExtraDamage` inicia em 1.

## Crítico

Em `Living.MakeCriticalDamage`:

```text
limiar = 10 + Lucky / 2000 + PetEffects.CritRate
critica quando limiar >= Random.Next(100), ou MustCrit
adicional = trunc(dano_base × (0,5 + Lucky × 0,00002))
```

A comparação continua inclusiva. Sem pets, sorte 400 dá limiar 10,2 e 11 resultados
de sucesso entre os 100 inteiros possíveis (0 até 10); sorte zero dá 11%, também.
Não confundir limiar contínuo com a probabilidade discreta efetiva.

Ao adicional crítico somam-se buffs da sociedade; depois entra um bônus positivo de
`trunc(adicional / 15000) × (ViolenceInjury - Guard_do_alvo)`, convertido para inteiro.
A divisão por 15000 é **inteira antes da multiplicação**. Em seguida vêm reduções
por `EquipGhostReduceCritDamage / 300`, gemas e pet. A soma das reduções de gemas/pet
recebe teto 100. O método retorna só o adicional; `TakeDamage` o soma ao dano base.
Há exceções para bosses e para Element_PVE (75).

`Crit` e `Tenacity` são carregados em variáveis locais, mas não participam do sorteio
nesse método. Não deduzir que a chance depende deles apenas pelos nomes dos atributos.

## Aplicação do dano e fúria

`BombImp` calcula base, calcula adicional crítico, dispara eventos que podem alterar
os dois valores e chama `TakeDamage`. `Living.TakeDamage` ainda aplica efeitos,
redução percentual de `ReduceDamePlus + GoldenReduceDamage`, redução de forma de pet
em especial e proteção KeepLife, antes de descontar a vida.

Em `Player.TakeDamage`, se o jogador sobreviver:

```text
fúria_acrescida = trunc(dano_base × 200 / vida_máxima) + Random.Next(5)
```

Usa o argumento de dano base após possíveis mudanças pelos eventos, sem somar
diretamente o adicional crítico. O sorteio acrescenta de 0 a 4. Difere da 4.1,
que usa uma quantidade absoluta de dano. Limites e demais fontes de fúria não
foram auditados aqui.

## Comparação com tankclone

`packages/core/src/stats.ts` atualmente segue 4.1:

| Parte | Projeto / referência 4.1 | Pacote CN 14.7 |
|---|---|---|
| Ataque | 1 + A/1000 | 0,6 + A/12500 no padrão; A/10000 e /3 no Match |
| Armadura | Curva racional com nível | Linear /12000, teto 60%, com SunderArmor; ignorada na expressão Match |
| Defesa | Curva de DEF − Sorte | DEF/80000, teto 90% (PeakBattle usa /18000) |
| Escala de Dano | Linear | Padrão também multiplica por 1 + D/10000 |
| Crítico: limiar | Sorte × 45/(800 + Sorte) | 10 + Sorte/2000 + pet |
| Crítico: adicional | 0,5 + Sorte × 0,00015 | 0,5 + Sorte × 0,00002, antes de efeitos |
| Fúria por golpe | Base absoluta | Base / vida máxima, mais sorteio |

Exemplos aritméticos, centro do impacto, P=M=ExtraDamage=1, sem efeitos,
sem mágico/elemental e sem crítico; não são execução do servidor:

| Entradas | Ramo padrão | Match |
|---|---:|---:|
| D=450, A=1500, F=500, G=60 (build média com Prisma, D=200+250) | 334 | 22 |
| D=8912, A=33281, F=28663, G=8550 (D tratado como total agregado) | 14114 | 6344 |

Com sorte 26078, o adicional crítico básico é 102,156% do dano base neste pacote,
contra 441,17% na fórmula 4.1 atual. Isso ajuda a explicar por que transportar
atributos modernos para a fórmula antiga pode produzir críticos desproporcionais.

Para alinhar futuramente, convém selecionar explicitamente o perfil e o modo,
definir D agregado sem duplicar arma e migrar dano/crítico/fúria em conjunto.
A troca isolada na build antiga desequilibra a partida, especialmente no Match.
Antes de buscar equivalência completa, faltam rastrear BaseAttack no Road,
modificadores dos equipamentos e efeitos que alteram dano pelos eventos.
