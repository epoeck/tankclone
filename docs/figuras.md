# Figuras: lógica do álbum de equipamentos

Referência inspecionada em 2026-11-12: pacote local `DDT-CN-14.7/NaiKuaiDDT`.
O sistema equivalente se chama `AvatarCollection`; algumas classes usam a grafia
`AvatarColection`. A pedido do dono, esta extração registra **somente a lógica**,
para um sistema com equipamentos próprios. Não importa catálogo, imagens, interface,
banco ou executáveis. Nenhuma regra abaixo foi ligada ao combate do tankclone ainda.

## Estrutura essencial

O sistema mantém três conjuntos de dados separados:

1. **Definição do álbum:** identificador, nome, lista de equipamentos aceitos e bônus.
2. **Regras de cada entrada:** equipamento necessário e custo para registrá-lo.
3. **Progresso do jogador:** entradas já registradas e validade do bônus daquele álbum.

O álbum independe dos equipamentos que o personagem está vestindo. Os bônus são
passivos do progresso registrado e podem somar os valores de vários álbuns.
Ter os itens na mochila não basta no fluxo comum: existe uma ação de registro.

Na fonte, os bônus possíveis são Ataque, Defesa, Agilidade, Sorte, Vida, Dano e
Armadura. Os cinco primeiros entram em `PlayerEquipInventory.UpdatePlayerProperties`;
Dano e Armadura entram por `GamePlayer.GetBaseAttack` e `GetBaseDefence`.

## Registro de uma entrada

O caminho principal é `AvatarCollectionActive.CommandHandler` →
`PlayerAvataInventory.ActiveAvatarColection`:

1. O servidor recebe o álbum e o item que o jogador quer registrar.
2. Confere bloqueio da mochila e se o item corresponde a uma entrada do álbum.
3. Confere se o jogador consegue pagar o custo exigido.
4. Procura uma instância do equipamento na mochila e rejeita registro repetido.
5. Registra o identificador no progresso e vincula o equipamento ao jogador.
6. Cobra o custo após o registro bem-sucedido e envia a atualização ao cliente.

**Esse caminho não consome nem destrói o equipamento.** Ele altera o vínculo e
registra sua participação. O progresso é salvo separadamente do inventário.
A remoção futura do equipamento não é consultada na rotina que soma os bônus:
ela usa os registros do álbum. O sistema também admite IDs alternativos para
atender uma entrada; isso é opcional para a nossa versão.

O pacote tem outra sobrecarga de ativação que registra diretamente um ID, sem
buscar ou vincular uma instância. Ela não deve ser usada como autorização para
o cliente marcar entradas livremente. Para uma implementação própria, a validação
e a alteração do inventário, saldo e progresso devem pertencer à mesma operação.

## Marcos de conclusão e bônus

O total necessário é a quantidade de entradas definida para o álbum. Para N entradas:

```text
limiar_parcial = ceil(N / 2)

menos que o limiar parcial → nenhum bônus
do limiar parcial até N−1  → 1 × bônus definido no álbum
N entradas                → 2 × bônus definido no álbum
```

O marco completo **substitui** o parcial. Não se somam 1× e 2× para chegar a 3×.
Para N=1, o único registro já alcança o marco completo e concede 2×.

Exemplo ilustrativo com equipamentos próprios: em um álbum de cinco entradas,
o bônus parcial começa na terceira. Se o bônus configurado for +20 Ataque e
+100 Vida, três ou quatro registros concedem +20/+100; cinco concedem +40/+200.

A soma dos álbuns é feita atributo por atributo:

```text
bônus_total[atributo] = soma(
    bônus_configurado_do_álbum[atributo] × multiplicador_do_marco
    para cada álbum cujo bônus esteja válido
)
```

O cliente pode exibir progresso e previsão, mas o servidor deve calcular o resultado.
Para nosso projeto, Dano precisa continuar separado de Ataque, assim como Armadura
de Defesa, conforme `Stats` em `packages/core/src/stats.ts`.

## Validade e renovação na referência

Esta parte é uma regra da versão inspecionada, não uma necessidade de todo sistema
de Figuras:

- O progresso dos itens registrados permanece salvo quando o bônus expira.
- Um novo registro de álbum do jogador nasce com validade de agora + 7 dias.
- Ao registrar um item, se o álbum estiver incompleto, alcançar pelo menos metade
  e estiver expirado, o handler reinicia a validade para agora + 7 dias.
- **Completar o álbum não torna o bônus permanente:** as rotinas de soma verificam
  validade tanto no marco parcial quanto no completo.
- Renovar um álbum ainda válido acrescenta os dias à validade existente.
- Renovar um álbum expirado usa agora como início e depois acrescenta os dias.
- O custo de renovação é `custo_diário_do_álbum × dias`, pago em `myHonor` na fonte.
- A validade compara datas, ignorando a hora: `endTime.Date >= agora.Date`.
  Portanto o bônus continua válido durante todo o dia indicado como vencimento.

Os custos de registrar equipamentos usam ouro e, em certos tipos de coleção,
contadores específicos de reputação. Esses nomes e moedas não precisam ser
transportados para o tankclone; basta manter uma regra explícita de custo.

## Modelo para equipamentos próprios

Este é um contrato proposto para a adaptação, e não uma cópia das tabelas do CN:

```ts
type CollectionBonus = Partial<Pick<Stats,
  "atk" | "def" | "agi" | "luck" | "hp" | "damage" | "armor"
>>;

interface AlbumDef {
  id: string;
  name: string;
  entries: {
    id: string;                  // posição lógica no álbum
    acceptedEquipmentIds: string[];
    activationCost: { currency: string; amount: number };
  }[];
  partialBonus: CollectionBonus; // completo concede 2× estes valores
}

interface AlbumProgress {
  playerId: string;
  albumId: string;
  registeredEntryIds: string[];
  bonusValidThrough?: string;    // data do último dia válido, se houver expiração
}
```

Usar IDs de **entradas** no progresso permite aceitar equipamentos alternativos
sem contar duas vezes a mesma posição. O número total vem da definição do álbum;
não deve ser fornecido pelo cliente. Álbuns devem ter ao menos uma entrada.

Pseudocódigo da operação de registro para a adaptação:

```text
registrar(jogador, álbum, entrada, instância_do_equipamento):
  carregar definição e progresso no servidor
  validar entrada, proprietário, equipamento aceito, bloqueios e saldo
  rejeitar se a entrada já foi registrada
  em uma operação atômica:
    cobrar o custo
    vincular o equipamento ao jogador
    adicionar a entrada ao progresso
    atualizar validade, se essa política estiver habilitada
    salvar tudo
  recalcular atributos efetivos e enviar novo progresso
```

```text
calcularBônus(definição, progresso, hoje):
  se bônus expirou: retornar zero
  quantidade = contar entradas válidas distintas do progresso
  se quantidade >= total: retornar bônus × 2
  se quantidade >= ceil(total / 2): retornar bônus
  retornar zero
```

O recálculo parte sempre dos atributos sem o bônus de Figuras, evitando acrescentar
o mesmo bônus novamente a cada atualização. Registro, renovação, expiração e login
precisam refletir o estado atual. Não basta atualizar o número exibido na interface.
Para a integração futura, o aumento de Vida também exige uma regra explícita para
vida máxima versus vida atual e para mudanças ocorridas durante uma partida.

## Particularidades que não convém reproduzir automaticamente

- A fonte procura duplicatas e alguns IDs alternativos como substrings de texto.
  Na adaptação, usar comparação exata de IDs e conjuntos de entradas.
- Algumas coleções completas liberam habilidades adicionais. São uma extensão
  específica, separada da lógica de completar álbuns e conceder atributos.
- Há compatibilidade com versões antigas, campos de sexo/tipo e moedas próprias.
  Não são necessários para identificar álbuns e seus equipamentos no tankclone.
- A rotina de renovação inspecionada não mostra validação positiva dos dias antes
  de multiplicar custo e somar datas. Nossa operação deve exigir inteiro positivo,
  limitar a quantidade e conferir saldo no servidor.
- O handler original tem caminhos diferentes de recálculo para conclusão completa
  e parcial; nossa implementação deve recalcular sempre após uma alteração válida.

Assim, a lógica reutilizável é: **registrar equipamentos → manter progresso por
álbum → atingir marcos → somar bônus passivos**. Expiração, renovação, moedas,
habilidades e valores dos atributos são políticas configuráveis a definir quando
formos integrar o sistema com os equipamentos próprios.

## Evidência técnica

Inspeção estática, sem iniciar o servidor. As DLLs estão em recursos Costura do
`Service/Road/Road.Service.exe`. Métodos conferidos no IL:

| Assembly | Método | RVA |
|---|---|---|
| Game.Server | AvatarCollectionActive.CommandHandler | 0x1ed384 |
| Game.Server | AvatarCollectionDelayTime.CommandHandler | 0x1edb68 |
| Game.Server | PlayerAvataInventory.CheckNewAvatarColection | 0x9c14c |
| Game.Server | PlayerAvataInventory.ActiveAvatarColection (lista de IDs) | 0x9c5c0 |
| Game.Server | PlayerAvataInventory.ActiveAvatarColection (ID direto) | 0x9c7b8 |
| Game.Server | PlayerAvataInventory.DelayAvatarColection | 0x9c928 |
| Game.Server | PlayerAvataInventory.AddPropAvatarColection | 0x9c338 |
| Game.Server | PlayerAvataInventory.AddBasePropAvatarColection | 0x9c490 |
| SqlDataProvider | UserAvatarColectionInfo.HaftActive | 0x17dc0 |
| SqlDataProvider | UserAvatarColectionInfo.FullActive | 0x17e14 |
| SqlDataProvider | UserAvatarColectionInfo.get_isValidate | 0x17c3c |

A persistência usa `GetSingleUserAvatarColectionInfo`,
`AddUserAvatarColectionInfo` e `UpdateUserAvatarColectionInfo`.
Esta auditoria cobre o fluxo principal do servidor; não é uma execução do cliente
Flash nem uma auditoria de todos os chamadores ou procedimentos do banco.
