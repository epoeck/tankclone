# Mochila, loja e Ferreiro

Slots equipáveis vêm do equipamento real: arma principal, secundária, pet, efeito, traje, colar, roupa, chapéu, rosto, cabelo, óculos, dois braceletes e dois anéis. A loja de vestuário é também a loja de equipamento. Atributos vêm dos templates CN; não há presets nem modos de energia/dano. A compra de acessórios custa 1 gold, sem RNG.

- **Slots duplos**: bracelete 1/2 e anel 1/2 aceitam instâncias separadas; pet, secundária, efeito, traje e colar também podem ser equipados. Ícones locais CN necessários são importados por `scripts/import-cn-equipment-icons.py`.
- **Atributos da partida**: ATQ/DEF/AGI/SOR são somados a partir dos itens equipados e da composição. Armadura vem de chapéu e roupa; nível da arma fortalece seu dano. O painel usa esses mesmos valores autoritativos enviados no setup da sala.
- **Acessórios**: apenas Pulseira de Aniversário e Anel do Romance. A loja vende o nível base por 1 gold; a cadeia termina nos níveis CN máximos (+10 e +8, respectivamente). Sem RNG.
- **Fusão**: no Ferreiro, quatro instâncias diferentes do mesmo acessório e nível viram uma instância do próximo nível. Os quatro itens são consumidos; composição e fortalecimento não são transferidos. A cadeia não passa do teto CN.
- **Fortalecimento**: Super Pedra (`super`, ícone `strength11`, 10 EXP) aplica-se a chapéu, roupa e arma. Chapéu/roupa dão armadura `round(60·1,1^N)`; arma escala o dano por `1,1^N`. Secundária não recebe armadura inventada: o template CN representa cura, ainda não implementada no combate.
- **Migração**: contas antigas recebem peças do Look e as armas no primeiro acesso (`Db.ensureStarter`). Pedras `str1..str5` viram Super Pedras por EXP.
- **POW**: B alterna o especial com fúria cheia; o evento autoritativo do disparo anima o eco ampliado atrás do boneco para todos os jogadores.
- **UI/protocolo**: Mochila (`client/src/bag.ts`, clique duplo ou arrastar), loja de vestuário (`wardrobe.ts`), Ferreiro (`forge.ts`); `bag`, `equip`, `unequip`, `buy`, `strengthen`, `compose`, `fuse`. A resposta da mochila contém ouro, itens e stats.
