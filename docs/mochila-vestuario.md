# Mochila de vestuário

Implementada em 2026-11-12. Acessível pelo botão **Mochila** no saguão e na sala.
Substitui o seletor numérico do vestiário, reutilizando o visual salvo na conta.

## Comportamento

- Grade de peças com miniaturas isoladas, categorias, busca por nome e paginação.
- Roupas, cabelos, rostos, chapéus, óculos e asas do catálogo já instalado.
- Prévia do personagem e indicação das peças em uso no rascunho.
- Selecionar uma peça abre os detalhes; **Experimentar** a coloca no rascunho.
  Duplo clique na peça também permite experimentá-la.
- Chapéu, óculos e asas podem ser retirados. Roupa, cabelo e rosto são obrigatórios.
- Escolha de avatar masculino/feminino, tom de pele e cor do cabelo.
- A peça em uso oferece tintura para roupa, íris ou chapéu, com opção **Original**.
  Cada peça mantém sua própria cor ao ser trocada e escolhida novamente; experimente
  a peça selecionada para habilitar sua paleta.
- **Salvar visual** envia `setLook` e só confirma após o perfil retornar do servidor.
- **Desfazer** restaura o último visual confirmado. Voltar com alterações abre uma
  confirmação de descarte. Entrar na mochila não muda a conta.
- Salvar dentro da sala mantém a mochila aberta e atualiza o visual do membro na sala.
- Falha de conexão, erro ou timeout não exibem confirmação falsa de salvamento.

As peças do catálogo CN 14.7 trazem nome e atributos do `TemplateAlllist.xml` (quase todas +5 em ATQ/DEF/AGI/SOR;
itens de GM com 6666 são ignorados) via `scripts/cn-wardrobe-stats.py`. A soma das peças vestidas (`lookStats`) entra nos
stats da partida junto com a build e a composição da arma. O cabelo tem a opção **Original** (só a arte colorida, sem a
máscara de tintura). Ferreiro e loja: `docs/ferreiro.md`.

## Arquivos

- `packages/client/src/wardrobe.ts`: catálogo atual, rascunho e interface.
- `packages/client/src/ui/wardrobe.css`: layout desktop e tela estreita.
- `packages/client/src/chars.ts`: `drawWardrobePiece`, miniaturas das camadas SHOW
  com máscaras de pele e tintura e recorte de transparência em memória.
- `packages/client/src/play.ts` e `play.html`: navegação e confirmação pelo servidor.

O JSON `Look` inclui `tints` opcional, com índices de cor por peça para rosto, roupa
e chapéu; `-1` representa a cor original. `sanitizeLook` valida os índices e preenche
esses valores para contas antigas. A persistência usa o mesmo campo JSON do banco,
sem migração de esquema. O catálogo continua respeitando os índices aceitos por
`sanitizeLook`. Uma importação futura precisará atualizar catálogo, composição e
validação juntos, mantendo IDs estáveis.

Nas camadas de rosto e roupa, `/2` é a máscara de pele e `/3` a de íris ou roupa,
respectivamente. Os chapéus atuais não têm máscara separada: a tintura cobre toda
a silhueta do chapéu, preservando o relevo.

## Slots de equipamento e acessórios

A mochila tem slots ativos para arma principal, arma secundária, pet, efeito, traje,
colar, duas pulseiras e dois anéis, além do vestuário. Compra, equipar, troca e retirada
passam pelo servidor. Arma, traje, efeito, colar, arma secundária e pet de teste usam
templates CN 14.7 fixos; acessórios da loja são a **Pulseira de Aniversário** (`8015`)
e o **Anel do Romance** (`9024`). Seus atributos de template entram no painel e nos
stats autoritativos da partida junto com arma, roupa, chapéu, composição e forja.

O Ferreiro oferece fusão garantida de quatro instâncias iguais sem equipar:
`8015` vai até `85154` (+10); `9024` vai até `95242` (+8), conforme as cadeias CN.
Todas as etapas exigem quatro nesta versão, conforme o pedido do dono. Só os tiers +0
são vendidos. A fusão consome as quatro instâncias e cria uma nova com os atributos
fixos do tier seguinte; composição e fortalecimento não são transferidos.

Os ícones necessários são copiados apenas para `packages/client/public/ui-local/`
(gitignored), pelo importador reprodutível:
`python3 scripts/import-cn-equipment-icons.py /caminho/NaiKuaiDDT`. O restante do
pacote CN não é importado. Slots com arte de personagem ainda não integrada usam o
ícone do template na interface; seus atributos continuam valendo.
Pet e arma secundária fornecem somente seus atributos de template: habilidades de pet
e cura da arma secundária ainda não fazem parte do combate. Por isso, a arma secundária
não recebe Super Pedra nesta versão.

## Stats de equipamento e POW

Os presets de build foram removidos. A base da partida é neutra; atributos dos templates
de arma e demais itens, roupas, acessórios, composição e fortalecimento determinam os
stats. O painel mostra o dano da arma já fortalecido; o combate usa esse dano-base uma
vez no cálculo.

POW alterna com **B** quando a fúria está cheia e o jogador está na vez. O HUD e o
teclado chamam a mesma validação. Ao disparar, o evento autoritativo marca o especial:
todos os clientes mostram o boneco ampliado atrás do jogador, e quem ativou vê uma
prévia breve ao armar o POW.

## Verificação

- Typecheck do cliente, build de produção e testes existentes de core/servidor.
- Navegador com conta de teste: experimentar, descartar, salvar e entrar novamente;
  busca sem acentos e sem resultados, categorias e retirada de acessório.
- Dentro da sala: salvar sem fechar a mochila e voltar à mesma sala.
- Layout conferido em desktop e tela estreita, sem rolagem horizontal.
