"""Copia do Reborn local (só no disco, fora do git) a UI de partida usada como placeholder:
ícones dos itens 1–8/F/POW, medidor de fúria e POW, efeito de fúria cheia no boneco, animação de uso de item,
vitória/derrota e as cartas do fim de partida. Uso: python scripts/import-reborn-ui.py /caminho/ddtank-reborn
Saída: packages/client/public/ui-local/<grupo>/library.json + imagens, com manifesto de hashes."""
import hashlib, json, shutil, sys
from pathlib import Path

src = Path(sys.argv[1]) / 'apps/client/public/assets/flash/ui/vietnam/swf'
out = Path(__file__).resolve().parent.parent / 'packages/client/public/ui-local'
GROUPS = {
    'game': ('game', ['asset.game.dander.bg', 'asset.game.dander.back', 'asset.game.dander.animate.back',
                      'asset.game.dande.animate', 'asset.game.winAsset', 'asset.game.lostAsset']),
    'gameii': ('gameii', ['asset.game.danderAsset', 'asset.game.ghostPcikPropAsset']),
    'gameover': ('gameover', ['asset.takeoutCard.LuckyCard', 'asset.takeoutCard.TitleBitmap', 'asset.takeoutCard.InstructionBitmap',
                              'asset.takeoutCard.GoldBitmap', 'asset.takeoutCard.GoldTxt'] + [f'asset.takeoutCard.CountDownNum_{i}' for i in range(10)]),
}
# tecla do nosso jogo → ícone do original (game.crazyTank.view.Prop<pic>Asset)
PROPS = {'1': 19, '2': 20, '3': 18, '4': 17, '5': 16, '6': 15, '7': 14, '8': 13, 'F': 2, 'pow': 11}

manifest = {'source': 'ddtank-reborn (swf convertido) — placeholders locais', 'files': {}}
def put(rel, data):
    target = out / rel; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    manifest['files'][rel] = hashlib.sha256(data).hexdigest()

for group, (lib_dir, classes) in GROUPS.items():
    base = src / lib_dir; lib = json.loads((base / 'library.json').read_text())
    ids, pending = set(), [lib['classes'][c]['id'] for c in classes]
    while pending:
        ident = str(pending.pop())
        if ident in ids or ident not in lib['chars']: continue
        ids.add(ident); part = lib['chars'][ident]
        if part.get('img'): put(f'{group}/{part["img"]}', (base / part['img']).read_bytes())
        pending.extend(p['id'] for frame in part.get('tl', {}).get('f', []) for p in frame if 'id' in p)
    subset = {'frameRate': lib['frameRate'], 'chars': {i: lib['chars'][i] for i in sorted(ids, key=int)},
              'classes': {c: lib['classes'][c] for c in classes}}
    put(f'{group}/library.json', json.dumps(subset, ensure_ascii=False, separators=(',', ':')).encode())

# Marcadores nativos de ArrowView e EnergyView.
game = src / 'game'; lib = json.loads((game / 'library.json').read_text())
for name, cls in [('arrow-clone', 'asset.game.arrowCloneAsset'), ('power-gray', 'asset.game.rulingGrayStripAsset')]:
    char = lib['chars'][str(lib['classes'][cls]['id'])]
    put(f'markers/{name}.png', (game / char['img']).read_bytes())

corei = src / 'corei'; lib = json.loads((corei / 'library.json').read_text())
for key, pic in PROPS.items():
    put(f'props/{key.lower()}.png', (corei / lib['chars'][str(lib['classes'][f'game.crazyTank.view.Prop{pic}Asset']['id'])]['img']).read_bytes())
put('props/special.png', (corei / lib['chars'][str(lib['classes']['game.crazyTank.view.specialKillAsset']['id'])]['img']).read_bytes())
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print(f'{len(manifest["files"])} arquivos em {out}')
