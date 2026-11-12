"""Copia wing002 convertido e a lápide do Reborn local, com hashes SHA-256."""
import hashlib, json, shutil, sys
from pathlib import Path
src = Path(sys.argv[1]) / 'apps/client/public/assets'
out = Path(__file__).resolve().parent.parent / 'packages/client/public/character-effects'
wing = src / 'resource/image/equip/wing/wing002/wings'
lib = json.loads((wing / 'library.json').read_text())
files = {'wing/library.json': wing / 'library.json', 'tomb.png': src / 'flash/ui/vietnam/swf/game/images/241_asset.game.tombAsset.png'}
for c in lib['chars'].values():
    if c['k'] == 'shape' and c.get('img'): files['wing/' + c['img']] = wing / c['img']
ghost = src / 'flash/ui/vietnam/swf/gameii'
ghost_lib = json.loads((ghost / 'library.json').read_text())
classes = ['asset.game.ghostManMovieAsset', 'asset.game.ghostGirlMovieAsset']
ids = set(); pending = [ghost_lib['classes'][name]['id'] for name in classes]
while pending:
    ident = str(pending.pop())
    if ident in ids: continue
    ids.add(ident); part = ghost_lib['chars'][ident]
    if part['k'] == 'shape' and part.get('img'): files['ghost/' + part['img']] = ghost / part['img']
    pending.extend(p['id'] for frame in part.get('tl', {}).get('f', []) for p in frame if 'id' in p)
subset = {'frameRate': ghost_lib['frameRate'], 'chars': {i: ghost_lib['chars'][i] for i in sorted(ids, key=int)}, 'classes': {name: ghost_lib['classes'][name] for name in classes}}
ghost_json = json.dumps(subset, ensure_ascii=False, separators=(',', ':')).encode()
manifest = {'source': 'ddtank-reborn dab2b445f153a6852b48182d4afe5c43ebbe3e16; SWF convertido localmente', 'files': {}}
for name, source in sorted(files.items()):
    data = source.read_bytes(); target = out / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    manifest['files'][name] = hashlib.sha256(data).hexdigest()
target = out / 'ghost/library.json'; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(ghost_json)
manifest['files']['ghost/library.json'] = hashlib.sha256(ghost_json).hexdigest()
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
