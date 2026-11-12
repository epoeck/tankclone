# Mochila original, Super Pedra e loja

Implementa `docs/especificacao-mochila.md` (sem RNG, tudo a 1 gold, assets do original só locais).

- **Itens por instância** (`items` no SQLite): `kind`, `ref`, `sex`, `level`/`exp` (+0..+12), composição `atk/def/agi/luck` e `place` (null = mochila). Contas antigas migram sozinhas na primeira entrada (`Db.ensureStarter`): peças do Look e as 3 armas (com a evolução da tabela `weapons`). Pedras `str1..str5` viram Super Pedras por EXP.
- **Look derivado**: o Look salvo reflete o equipado (`server/src/bag.ts: deriveLook`); a loja só salva sexo, pele, cor do cabelo e tinturas.
- **Super Pedra** (`super`, ícone `strength11`, 10 EXP): fortalece chapéu, roupa, arma e secundária. Chapéu/roupa dão armadura `round(60·1,1^N) − 60`; a arma, dano × 1,1^N.
- **Composição**: chapéu, óculos, roupa, arma, bracelete e anel (listas em `core/src/items.ts`).
- **Protocolo**: `bag`, `equip`, `unequip`, `buy {catalogKind, ref, sex}` / `buy {item, count}`, `strengthen {itemId, count}`, `compose {itemId, stone}`; resposta `{t:"bag", gold, materials, items, stats}`.
- **Partida**: `weaponLevel`, `compose` somado e `armorBonus` vêm do equipado (`gearOf`).
- **UI**: Mochila (`client/src/bag.ts`, equipar por duplo clique ou arrastar), Loja (`wardrobe.ts`, Comprar 1 gold, Experimentar só prévia) e Ferreiro (`forge.ts`, sobre qualquer item).
- Lugares sem arte nesta versão (efeito, bracelete, anel, traje, colar, secundária) aparecem bloqueados.
