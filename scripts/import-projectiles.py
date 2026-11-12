"""Importa bibliotecas já convertidas pelo swf-export do clone Reborn local.

Uso: python scripts/import-projectiles.py /caminho/ddtank-reborn
O manifesto registra hashes de cada entrada para auditoria; não executa código externo.
"""
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) / 'apps/client/public/assets/resource/image/bomb'
target = root / 'packages/client/public/projectiles'
target.mkdir(parents=True, exist_ok=True)
manifest = {'source': 'thurdev/ddtank-reborn dab2b445f153a6852b48182d4afe5c43ebbe3e16, conversão local swf-export', 'files': {}}
for kind in ('bullet', 'blastout'):
    for ball in (3, 101, 111, 161, 171, 381, 391):
        name = f'{kind}{ball}'
        src = source / kind / name
        lib = json.loads((src / 'library.json').read_text())
        files = {'library.json'} | {c['img'] for c in lib['chars'].values() if c['k'] == 'shape' and 'img' in c}
        for file in sorted(files):
            data = (src / file).read_bytes()
            out = target / name / file
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
            manifest['files'][f'{name}/{file}'] = hashlib.sha256(data).hexdigest()
# ParticalShapLib.data, decompilada do shape.swf, é indexada a partir de zero:
# displayCreator 12/24/214/215/43/44 => classes 13/25/220/221/44/45.
particle_src = Path(sys.argv[1]) / 'apps/client/public/assets/flash/shape'
particle = json.loads((particle_src / 'library.json').read_text())
names = ['ParticalShap13', 'ParticalShap25', 'ParticalShap220', 'ParticalShap221', 'ParticalShap44', 'ParticalShap45']
selected = set()
def visit(char_id):
    if str(char_id) in selected: return
    selected.add(str(char_id))
    for frame in particle['chars'][str(char_id)].get('tl', {}).get('f', []):
        for op in frame:
            if 'id' in op: visit(op['id'])
for name in names: visit(particle['classes'][name]['id'])
particle['classes'] = {name: particle['classes'][name] for name in names}
particle['chars'] = {k: v for k, v in particle['chars'].items() if k in selected}
particle_dir = target / 'particles'
particle_dir.mkdir(exist_ok=True)
data = (json.dumps(particle, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
(particle_dir / 'library.json').write_bytes(data)
manifest['files']['particles/library.json'] = hashlib.sha256(data).hexdigest()
for char in particle['chars'].values():
    if char['k'] != 'shape' or 'img' not in char: continue
    file = char['img']; data = (particle_src / file).read_bytes(); out = particle_dir / file
    out.parent.mkdir(parents=True, exist_ok=True); out.write_bytes(data)
    manifest['files'][f'particles/{file}'] = hashlib.sha256(data).hexdigest()
# Os IDs de som vêm do seed Ball, não da aparência nem de suposições.
seed_path = Path(sys.argv[1]) / 'packages/db/seed/game/Ball.json.gz'
seed_data = seed_path.read_bytes()
manifest['ballSeedSha256'] = hashlib.sha256(seed_data).hexdigest()
rows = json.loads(gzip.decompress(seed_data))
audio = Path(sys.argv[1]) / 'apps/client/public/assets/flash/audio/sounds'
manifest['sounds'] = {}
for row in rows:
    if row['ID'] not in (3, 101, 111, 161, 171, 381, 391): continue
    manifest['sounds'][str(row['ID'])] = [row['ShootSound'], row['BombSound']]
    for sound in manifest['sounds'][str(row['ID'])]:
        matches = list(audio.glob(f'*_Sound{sound}.*'))
        if len(matches) != 1: raise ValueError(f'Som {sound}: {matches}')
        original = matches[0].read_bytes()
        manifest.setdefault('soundSourceSha256', {})[sound] = hashlib.sha256(original).hexdigest()
        ext = 'wav' if matches[0].suffix == '.flv' else 'mp3'
        out = target / 'sounds' / f'{sound}.{ext}'
        out.parent.mkdir(parents=True, exist_ok=True)
        if ext == 'wav':
            ffmpeg = Path(sys.argv[1]) / 'vendor/_tools/ffmpeg/ffmpeg'
            if not ffmpeg.exists():
                ffmpeg = shutil.which('ffmpeg')
            if not ffmpeg: raise RuntimeError('ffmpeg necessário para decodificar Nellymoser')
            subprocess.run([str(ffmpeg), '-v', 'error', '-y', '-i', str(matches[0]), '-map_metadata', '-1', '-c:a', 'pcm_s16le', str(out)], check=True)
        else:
            out.write_bytes(original)
        manifest['files'][f'sounds/{sound}.{ext}'] = hashlib.sha256(out.read_bytes()).hexdigest()
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
print(f"Importados {len(manifest['files'])} arquivos")
