# Especificação: mochila original, Super Pedra, evolução por equipamento e loja

Pedido do dono (2026-11-12). Fontes: CN 14.7 (`/run/media/bazzite/5c30424f-a21c-4799-94ee-89c1ba8949f0/DDT-CN-14.7/NaiKuaiDDT`,
`Request/TemplateAlllist.xml` é zlib) e Reborn (`~/Games/ddtank-reborn`). Regras que continuam valendo: **sem RNG** (quantidade
fixa de recurso, resultado garantido), **tudo a 1 gold na fase de testes**, assets do original **só locais** (gitignored).

## 1. Modelo de dados: itens possuídos (instâncias)
Hoje o visual é livre (`Look` com índices) e só as 3 armas têm estado (`weapons`). Passa a existir **inventário de instâncias**:

| campo | descrição |
|---|---|
| `id` | inteiro autoincremento |
| `nick` | dono |
| `kind` | `head` `glass` `hair` `eff` `cloth` `face` `weapon` `wing` (e futuramente `armlet`, `ring`, `offhand`, `suits`, `necklace`) |
| `ref` | chave estável da peça no catálogo: índice do slot no catálogo CN/legado (`cn-wardrobe.json`, `avatar.json`) ou `weaponId` |
| `strengthenLevel`, `strengthenExp` | evolução (+0..+12) |
| `atk`,`def`,`agi`,`luck` (compose) | composição |
| `place` | `null` = na mochila; senão o slot equipado |

- Contas existentes: migração cria 1 instância de cada peça hoje em uso no `Look` e das 3 armas (levando `level/exp/compose` da tabela `weapons`), todas equipadas. Itens "padrão" (rosto/cabelo/roupa default do sexo) nunca faltam: se a conta não tem, cria grátis.
- O `Look` salvo passa a ser **derivado do que está equipado** (o servidor recalcula ao equipar); cores (`tints`, `hairColor`) continuam no `Look`.
- A arma da sala (`setLoadout weaponId`) passa a ser a arma **equipada** na mochila.

## 2. Mochila (UI do original, aba Equipar)
Layout do `bagAndInfo` do DDTank41 (`vendor/DDTank41/Source Flash/FlashSV1/ui/vietnam/xml/bagAndInfo.xml`, pos1..pos19): personagem
no centro, **duas colunas de slots à esquerda** (x 30 e 82) e **duas à direita** (x 316 e 369), linhas y 88/139/191/242 e uma linha
de baixo (y 271, x 137/199/262). Ordem dos lugares (Place do original): 0 chapéu, 1 óculos, 2 cabelo, 3 efeito, 4 roupa, 5 rosto,
6 arma, 7–8 braceletes, 9–10 anéis, 11 traje, 12 colar, 13 asa, 15 arma secundária. Nesta build preencher os que temos arte:
chapéu, óculos, cabelo, efeito (sem arte de jogo ainda: só ícone), roupa, rosto, arma, asa; os demais aparecem vazios/bloqueados.
- À direita da tela: grade da mochila (abas **Equipamentos** e **Itens**; Itens = Super Pedra e pedras de composição com contagem).
- Duplo clique (ou arrastar) equipa/desequipa; item equipado troca de lugar com o anterior. Tooltip com nome, `+N`, atributos
  (base do template + composição) e o efeito do fortalecimento.
- Prévia SHOW do personagem ao lado (reusar `drawCharPortrait`), atualiza ao equipar.
- Painel de atributos do personagem (ATQ/DEF/AGI/SOR/Vida/Armadura/Dano) somando build + peças + composição + fortalecimento.

## 3. Super Pedra (nome do DDTank 337) e evolução de cada equipamento
- Pedra única: CN `11025 强化石` (Pic `strength11`, ícone em `Resource/image/unfrightprop/strength11/icon.png`), **"Super Pedra"**,
  10 EXP por unidade (Property2 = 10). Substitui as 5 pedras de fortalecer atuais (`str1..str5` saem da loja; contas que já
  têm convertem para Super Pedra por EXP: Nv1/2 = 1, Nv3 = 1,5→arredonda p/ cima 2, Nv4 = 6, Nv5 = 22).
- Tabela de EXP por nível igual (CN `loadstrengthexp.xml`: 10, 50, 150, 350, 700, 1500, 2300, 3300, 4500, 6000, 7500, 9000), +12 máx.
- **Fortalecíveis com Super Pedra** (CN `CanStrengthen=true`): **chapéu (cat. 1), roupa (5), arma (7), arma secundária (17)** e as
  versões temporárias (27, 31). Óculos, cabelo, rosto, efeito, asa, braceletes e anéis **não**.
- Efeito: arma = dano-base × 1,1^N (já existe). Chapéu e roupa = armadura do template (Property7 = 60) × 1,1^N; somar ao `armor`
  da build só o acréscimo (`round(60·1,1^N) − 60`), como o `getBaseDefence` do Reborn.
- Arma: modelo muda no +10/+12 (já existe, `forge.ts`). Chapéu/roupa não mudam de arte.

## 4. Composição (idêntica ao CN quanto a QUEM pode)
- **Componíveis** (CN `CanCompose=true`): **chapéu (1), óculos (2), roupa (5), arma (7), bracelete (8), anel (9)** (+ temporários).
  Cabelo, rosto, efeito, traje, colar, asa, arma secundária **não**.
- Pedras e valores já existentes (Fênix ATQ, Tartaruga DEF, Dragão AGI, Tigre SOR; Nv1–5 = 10/20/30/40/51), garantido,
  substitui o valor do atributo naquele item.

## 5. Loja = UI atual do vestiário
- A tela "Mochila" atual (grade com categorias, busca, prévia, cores) vira a **Loja**: o botão principal vira **Comprar (1 gold)**,
  que cria uma instância na mochila. "Experimentar" continua só como prévia (não salva).
- Cores/tintura e cor do cabelo continuam escolhidas na loja/mochila e salvas no `Look`.
- A loja também vende **Super Pedra** e as pedras de composição (1 gold).
- O botão "Ferreiro" atual passa a trabalhar sobre **instâncias** (escolher qualquer item fortalecível/componível da mochila,
  não só as 3 armas).

## 6. Servidor / protocolo
- Tabela `items` (seção 1) + migração; manter `inventory` só para materiais (Super Pedra, pedras de composição).
- Mensagens: `bag` → `{t:"bag", items, materials, gold, stats}`; `equip {itemId}`; `unequip {place}`; `buy {catalogKind, ref}`
  (peça) e `buy {item, count}` (material, já existe); `strengthen {itemId, count}`; `compose {itemId, stone}`.
- Validações: item pertence ao nick; categoria fortalecível/componível segundo as listas acima; sem RNG; transações atômicas.
- Partida: stats = build + soma das peças equipadas (template) + composição de cada item + armadura do fortalecimento de
  chapéu/roupa; arma com `weaponLevel` da arma equipada.

## 7. Testes mínimos
- core: listas de fortalecíveis/componíveis; armadura por nível; conversão de pedras antigas.
- server: comprar peça cria instância; equipar troca; não deixa fortalecer óculos/asa; compor arma/óculos; migração de conta antiga.
- client: typecheck; abrir mochila, equipar por duplo clique, comprar na loja, fortalecer chapéu.
