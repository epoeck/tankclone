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

As peças desta build são opções visuais livres e não concedem atributos. Isso não
implementa inventário de instâncias, compras, forja, Figuras ou equipamentos com stats.

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

## Importação CN pendente de aval

O dono determinou: primeiro deixar o sistema funcional e revisável; **somente depois
de seu aval copiar os assets crus do CN e integrá-los**. Nenhum arquivo do pacote
CN foi importado para esta implementação. As miniaturas usam apenas assets já presentes
no projeto e o recorte é feito em memória.

Na etapa posterior, conferir completude GAME/SHOW, camadas, variantes de cabelo,
expressões, arquivos codificados e itens com apenas ícone antes de oferecer as peças.
Não ampliar os limites de seleção para imagens ausentes.

## Verificação

- Typecheck do cliente, build de produção e testes existentes de core/servidor.
- Navegador com conta de teste: experimentar, descartar, salvar e entrar novamente;
  busca sem acentos e sem resultados, categorias e retirada de acessório.
- Dentro da sala: salvar sem fechar a mochila e voltar à mesma sala.
- Layout conferido em desktop e tela estreita, sem rolagem horizontal.
