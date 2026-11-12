"""Copia dígitos e fundo de crítico convertidos do game.swf do Reborn local."""
import hashlib, json, sys
from pathlib import Path
source = Path(sys.argv[1]) / 'apps/client/public/assets/flash/ui/vietnam/swf/game'
out = Path(__file__).resolve().parent.parent / 'packages/client/public/damage-popup'
lib = json.loads((source / 'library.json').read_text())
classes = {str(i): f'asset.game.bloodNUm{i}Asset' for i in range(10)} | {'critical': 'asset.game.redNumberBackgoundAsset'}
manifest = {'source': 'ddtank-reborn dab2b445f153a6852b48182d4afe5c43ebbe3e16; game.swf convertido localmente', 'files': {}, 'classes': classes}
out.mkdir(parents=True, exist_ok=True)
for name, cls in classes.items():
    part = lib['chars'][str(lib['classes'][cls]['id'])]
    data = (source / part['img']).read_bytes(); filename = name + '.png'; (out / filename).write_bytes(data)
    manifest['files'][filename] = hashlib.sha256(data).hexdigest()
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
