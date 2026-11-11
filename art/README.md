# Arte do DDClank

- `fontes/` — projetos editáveis do ArtCraft (`.vectorcraft`). Abra no **VectorCraft** para editar.
  Mesma estrutura de pastas de `export/` (ex.: `fontes/ui/items/item-1.vectorcraft` ↔ `export/ui/items/item-1.svg`).
  Cada arquivo tem uma camada com o nome do asset e objetos nomeados (`circulo-2-steel`, `forma-1-brass`…).
  `fontes/sprites/tank/tank-montado.vectorcraft` é o tanque montado (esteira, casco, bandeira, cano a −30°, torre),
  só para referência — não é exportado para o jogo.
- `export/` — espelho do que o jogo usa (`packages/client/public/assets`), com `manifest.json`. Não edite à mão:
  edite o `.vectorcraft` e reexporte.

## Reexportar um arquivo editado

```bash
vectorcraft-cli convert art/fontes/ui/items/item-1.vectorcraft art/export/ui/items/item-1.svg
```

(sem `--outline-text`, para texto continuar como texto; o tamanho/viewBox vem da prancheta do arquivo.)
Depois copie o SVG para `packages/client/public/assets/` no mesmo caminho relativo.

No repositório (GitHub) só vão os `fontes/`; o `export/` existe só no PC. No repositório, o destino do SVG reexportado é
`packages/client/public/assets/<mesmo caminho>.svg`.
