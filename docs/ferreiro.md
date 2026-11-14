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

Fusão de acessórios: quatro cópias iguais e sem equipar viram o próximo tier CN, sem sorteio.
Pulseira de Aniversário: `8015`→`85154` (+10); Anel do Romance: `9024`→`95242` (+8).
A interface não vende tiers intermediários. A fusão reinicia composição e fortalecimento;
os atributos de template do novo tier são os que entram nos stats.

## Interface funcional do Ferreiro e dos pets

A interface usa DOM e CSS próprios: moldura em ouro e madeira, painéis legíveis e
layout responsivo. Os sprites de UI CN, coordenadas Flash, canvas de moldura e
helpers de nove fatias foram retirados das telas. Apenas a arte dos itens, pedras
e pets continua sendo usada. Os ícones base das armas são importados por
`scripts/import-cn-equipment-icons.py` para `ui-local/forge/`, sem depender do
pacote antigo de skins `ui-local/cn-ui/`.

O Ferreiro tem somente três operações: Fortalecer, Compor e Fusão. A mochila
mostra equipamentos compatíveis com a operação e pedras com o estoque real.
Fortalecer exibe nível, EXP, quantidade exata de Super Pedras para o próximo
nível e o efeito real no dano ou na armadura. Compor compara o bônus atual com o
valor da pedra escolhida e consome uma unidade. A compra de materiais tem
seletor próprio, quantidade, custo em ouro e confirmação explícita; selecionar
uma pedra da mochila não realiza uma compra.

A fusão reúne as receitas das duas cadeias de acessórios, até seus tiers máximos,
em uma lista com disponibilidade real e filtro persistente. Quatro cópias iguais
livres geram uma peça do próximo tier; a seleção das quatro instâncias é
automática. A tela mostra o material, a nova peça, seus atributos e custo zero
conforme a regra existente do servidor. As composições e o fortalecimento das
peças consumidas são reiniciados. Não há categorias ou operações sem backend.

A tela de pets lista somente os pets possuídos, com rolagem quando necessário.
A seleção mostra nome, ícone, quatro atributos reais e estado de equipamento.
Equipar e retirar são as únicas ações; não há níveis, EXP, felicidade, habilidades
ou alimentação simulados. O ícone local `ui-local/slots/pet.png` continua sendo um
substituto visual de `chicken0/icon.png`, pois o diretório do modelo animado
`Pic="chicken"` não está presente nesta cópia do cliente. O estado vazio orienta
abrir a Loja existente após voltar ao saguão.

Seleção, operação, filtro, material e quantidade de compra são preservados nas
atualizações do servidor. Resultados e erros ficam visíveis no status da tela.
O envio pendente bloqueia ações duplicadas; rejeições liberam a ação e solicitam
uma nova mochila sem apagar a mensagem de erro. O servidor continua autoritativo,
com as mesmas mensagens e regras de gameplay.

A reconstrução passou no typecheck e no build do cliente, além da inspeção de desktop e celular
(390px), sem overflow horizontal, erros JavaScript, respostas HTTP faltantes ou
requisições às skins `ui-local/cn-ui/`. O E2E validou compra e quantidades, fortalecimento, composição com a última pedra,
as 18 receitas, fusão de quatro cópias, persistência do filtro, rejeição seguida de
ressincronização e recuperação, equipar/retirar pets com seus atributos e estado
vazio. Também validou rolagem com 39 equipamentos e 13 pets, em 390px e 800px, sem
erros JavaScript, HTTP 404 ou requisições às skins CN. Essas verificações usam
somente a conta e a base isoladas de revisão; não alteram a base do usuário.
