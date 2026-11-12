# Estado atual e rumo do tankclone / DDClank

Atualizado em **12 de novembro de 2026**. Este documento resume a direção atual e as mudanças recentes.
Tem precedência sobre as estimativas e fases históricas de `DESENVOLVIMENTO.md`; os detalhes técnicos
ficam nos documentos vinculados abaixo.

## Objetivo

Criar um jogo de artilharia por turnos para jogar com cerca de 20 amigos, hospedado no PC do dono,
com a sensação de tiro e as regras clássicas do DDTank. O projeto continua sendo uma implementação
própria em TypeScript: usar o código de referência para entender e testar as regras, reescrevendo
cada sistema de forma pequena e compatível com a arquitetura atual.

O DDTank Reborn é uma referência e uma instalação separada para comparação. Seu cliente convertido
do Flash, a camada de compatibilidade, o PixiJS e o banco PostgreSQL **não foram incorporados** ao
tankclone. O tankclone desenha em Canvas 2D e usa Node, WebSocket e SQLite.

## O que mudou nesta atualização

### Tiro, combate e terreno

- O perfil padrão passou da aproximação por tabelas para os parâmetros do DDTank41: passos de
  **40 ms**, gravidade 700, velocidade 20 por ponto de força, vento 24 e arrasto 0,2.
- O integrador preserva os arredondamentos float32 por operação da referência C#; a velocidade
  inicial usa a conversão para inteiro do servidor original.
- Dano, crítico, fúria, energia e fila de delay foram alinhados à referência. Os modificadores de
  tiro respeitam a ordem de uso dos itens; o delay das bolas foi confirmado como 200.
- As três armas usam seis máscaras reais de explosão. O formato que escava o terreno é separado
  do raio de dano, e os pixels indestrutíveis permanecem intactos e visíveis.
- Os projéteis de um leque são apresentados simultaneamente. Eventos levam seu instante na linha
  do tempo; impactos seguem a ordem de chegada, e disparos extras vêm depois do leque anterior.
- O servidor pausa o relógio da sala pela duração da animação; o cliente reproduz os eventos
  recebidos, inclusive na reconexão, sem decidir novamente o resultado do tiro.

O perfil anterior, `TABLE_PHYSICS`, foi preservado para comparação com as tabelas da comunidade.
Documentação: [DDTank41](ddtank41.md) e [adaptação do Reborn](ddtank-reborn.md).

### Direção do personagem e vento

O flicker ao andar para a esquerda vinha de uma inferência pelo primeiro e último ponto do caminho.
Pacotes com apenas um ponto eram interpretados como movimento para a direita. Agora o evento de
movimento transmite o lado decidido pelo servidor, inclusive ao virar parado ou sem energia.

O vento conserva o valor anterior e um alvo, avançando gradualmente entre turnos. No perfil padrão,
a variação é de até uma unidade por turno antes do multiplicador do mapa. Mirar, mover, usar itens
ou esperar dentro do turno não sorteia um novo vento. A continuidade é testada em 300 turnos.

### Avatar clássico

A preferência atual do dono é pelo visual clássico, substituindo os personagens SVG provisórios.
A composição foi reimplementada diretamente em Canvas 2D:

- masculino/feminino, aparência salva na conta e transmitida na partida;
- retratos e sprites de batalha em camadas, com máscaras de pele/cabelo e cabelo adaptado ao chapéu;
- catálogo inicial de rostos, cabelos, roupas, chapéus, óculos, armas e uma asa;
- animações básicas de parado, andar, mirar, disparar e receber dano;
- prévia independente em `/avatar.html`, sem alterar a conta.

São 139 PNGs locais, de aproximadamente 2 MB, provenientes do pacote clássico compatível indicado
na pesquisa do Reborn. Isso não representa o catálogo gráfico completo do 4.1. A asa é estática;
animações SWF não foram portadas. As imagens de referência colocadas pelo dono na raiz foram preservadas.
Fontes, hashes e limites: [avatar](avatar.md) e [créditos dos recursos](../third_party/classic-avatar/NOTICE.md).

### HUD e geometria do personagem

O HUD v2 mantém a disposição revisada dos controles, chat, equipes e barras de vida/energia.
A hitbox provisória do personagem agachado mede 36 × 42 px; o ponto de saída do tiro continua
em 30,18 px acima dos pés. Esses parâmetros de colisão ainda são próprios do tankclone.

## Arquitetura que queremos preservar

1. **Servidor autoritativo:** valida ações e decide movimento, colisão, dano, vento e resultado.
2. **Core determinístico:** regras sem DOM, rede, relógio real ou aleatoriedade não semeada.
3. **Desenho independente da simulação:** manter as regras no passo correto sem prender o desenho à
   frequência da física. Não acelerar a lógica para tentar corrigir uma animação travada.
4. **Dados e assets locais:** tabelas pequenas e importações reproduzíveis, com origem e versão fixadas.
5. **Portar sistemas por partes:** aproveitar a regra e seus dados, sem trazer o cliente antigo inteiro.

O objetivo é simplicidade e fluidez. Isso é uma direção de implementação, não uma afirmação de que
já medimos ou otimizamos todos os gargalos. As medições feitas na instalação separada do Reborn
não são benchmarks do tankclone.

## Limites atuais

A equivalência comprovada cobre os vetores de integração e os casos documentados de dano/delay.
A geometria do tankclone ainda tem hitboxes, ponto de saída do projétil, movimento em rampas e
varredura de colisão próprios. Portanto, não se declara equivalência de todas as trajetórias e colisões.

Continuam em aberto a revisão de movimento junto a obstáculos/saliências, ajustes visuais de
rampas e arma, expansão do avatar e avaliação de fluidez em partidas reais com vários jogadores.
Força de combate e alguns limites de sala permanecem decisões do projeto.

Já existem aparência/equipamento visual, builds de teste e itens de turno. **Não há ainda inventário
completo, catálogo integral de equipamentos, forja, economia, novas habilidades, pets, pérolas,
cartas ou PvE portados do Reborn.** O bot dummy existente é uma ferramenta de teste, não uma IA PvE.

## Próximos passos propostos

Esta ordem é uma proposta técnica, não trabalho já implementado nem ampliação automática do escopo:

1. Estabilizar o PvP atual: direção, animações, colisão, rampas, HUD, rede e reconexão; medir a batalha
   e o custo de desenho antes de fazer otimizações.
2. Separar com clareza o catálogo de equipamentos, seus atributos e a aparência; depois criar o
   inventário/equipar/desequipar, com persistência e validação pelo servidor.
3. Ampliar habilidades e efeitos por dados, com regras testáveis, feedback visual e custo/delay explícitos.
4. Depois do PvP estável, trazer bots e PvE por partes. Pets, pérolas e cartas continuam etapas futuras,
   respeitando as liberações por nível já definidas pelo dono.

Loja/economia e sistemas que não ajudam o grupo a jogar agora não precisam acompanhar cada porte.

## Como verificar e testar

```bash
npm install
npm test
npm run typecheck --workspaces --if-present
npm run build -w @tankclone/client
```

Os testes incluem os vetores publicados pelo Reborn, casos de combate/delay, máscaras de terreno,
reprodução em 30/60/144 FPS, direção, vento, catálogo/hashes dos PNGs e persistência/transmissão da aparência.
Esses testes não substituem a avaliação do feeling durante partidas.

Para jogar pela instalação de um clique, usar `scripts/ddclank.sh`; para desenvolvimento, usar o
servidor e o cliente descritos em [operação](operacao.md). A prévia de avatar fica em `/avatar.html`.

As correções feitas na instalação independente do Reborn e seus atalhos no menu do Linux não fazem
parte deste repositório. Os avisos de terceiros e os importadores desta adaptação estão em
`third_party/` e `scripts/import-*.py`.
