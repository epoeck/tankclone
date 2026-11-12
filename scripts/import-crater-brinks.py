"""Importa bordas de cratera do cache local Reborn. Não executa código externo.

Uso: python scripts/import-crater-brinks.py /caminho/ddtank-reborn
"""
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) / 'vendor/_assets/gunny30/inetpub/wwwroot/Resource/image/bomb/crater'
target = root / 'packages/client/public/assets/craters'
target.mkdir(parents=True, exist_ok=True)
manifest = {'source': 'ddtank-reborn dab2b445f153a6852b48182d4afe5c43ebbe3e16; vendor/_assets/gunny30/inetpub/wwwroot/Resource/image/bomb/crater', 'files': {}}
for ball in (101, 111, 161, 171, 381, 391):
    candidates = [p for p in (source / str(ball)).iterdir() if p.name.lower() == 'craterbrink.png']
    if len(candidates) != 1:
        raise ValueError(f'Borda {ball}: {candidates}')
    data = candidates[0].read_bytes()
    (target / f'{ball}.png').write_bytes(data)
    manifest['files'][f'{ball}.png'] = {'source': f'{ball}/{candidates[0].name}', 'sha256': hashlib.sha256(data).hexdigest()}
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
