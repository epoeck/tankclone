#!/usr/bin/env python3
"""Copia vestuário CN, restaura PNGs protegidos e gera catálogo reproduzível.
Uso: python3 scripts/import-cn-wardrobe.py /caminho/NaiKuaiDDT
"""
import hashlib, json, shutil, struct, sys, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]).resolve()
RAW = ROOT / 'assets-local/cn-wardrobe/raw'
OUT = ROOT / 'packages/client/public/assets/avatar/cn'
CAT = ROOT / 'packages/core/src/reference/cn-wardrobe.json'
MANIFEST = ROOT / 'assets-local/cn-wardrobe/manifest.json'
ORIGINS = {'resource': SOURCE/'Resource/image/equip', 'newpanel': SOURCE/'NewPanel/apk/image'}
SLOTS = ('face', 'hair', 'cloth', 'head', 'glass', 'eff', 'suits')
LEGACY = {'face':['default','face1','face2'], 'hair':['default','hair3','hair5'], 'cloth':['cloth1','cloth2','cloth3'], 'head':['head1','head2'], 'glass':['glass1']}
if not all(p.is_dir() for p in ORIGINS.values()): raise SystemExit('Fontes não encontradas')
for path in (RAW, OUT):
    if path.exists(): shutil.rmtree(path)
records = []
def png(data):
    protected = data.startswith(b'\x00\x03^_^')
    if protected:
        data = bytearray(data[5:]); data[16] ^= 255; data = bytes(data)
    if not data.startswith(b'\x89PNG\r\n\x1a\n'): return None
    pos = 8
    while pos + 12 <= len(data):
        n = int.from_bytes(data[pos:pos+4], 'big'); end = pos+12+n
        if end > len(data) or zlib.crc32(data[pos+4:pos+8+n]) != int.from_bytes(data[pos+8+n:end], 'big'): return None
        kind = data[pos+4:pos+8]; pos = end
        if kind == b'IEND': return data if pos == len(data) else None
    return None
for origin, root in ORIGINS.items():
    for source in sorted(root.rglob('*')):
        if not source.is_file(): continue
        rel = source.relative_to(root)
        # Resource contém outros equipamentos; só vestuário, efeitos e asas são relevantes.
        if origin == 'resource' and not (rel.parts[0] == 'wing' or (rel.parts[0] in ('m','f') and len(rel.parts)>1 and rel.parts[1] in SLOTS)): continue
        raw = RAW/origin/rel; raw.parent.mkdir(parents=True,exist_ok=True); data=source.read_bytes(); raw.write_bytes(data)
        decoded = png(data) if source.suffix.lower() == '.png' else None
        if decoded:
            target=OUT/origin/rel; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(decoded)
        records.append({'source':f'{origin}/{rel.as_posix()}', 'sha256':hashlib.sha256(data).hexdigest(), 'size':len(data), 'decoded':bool(decoded)})
MANIFEST.parent.mkdir(parents=True,exist_ok=True); MANIFEST.write_text(json.dumps({'files':records},ensure_ascii=False,separators=(',',':'))+'\n')

def image(origin, rel):
    p=OUT/origin/rel
    if not p.is_file(): return None
    data=p.read_bytes(); width,height=struct.unpack_from('>II',data,16)
    return (f'cn/{origin}/{rel.as_posix()}',width,height)

def choose(sex,slot,pic):
    # Não mistura camadas entre fontes: seleciona a cópia com mais arquivos válidos.
    roots=[('resource',Path(sex)/slot/pic),('newpanel',Path('equip')/sex/slot/pic)]
    best=None
    for origin, base in roots:
        files={p.relative_to(OUT/origin/base).as_posix().lower():p.relative_to(OUT/origin).as_posix() for p in (OUT/origin/base).rglob('*') if p.is_file()} if (OUT/origin/base).is_dir() else {}
        def get(name):
            rel=files.get(name.lower()); return image(origin,Path(rel)) if rel else None
        variants={}; valid=True
        for variant in (('A','B') if slot=='hair' else ('default',)):
            modes={}
            for mode in ('game','show'):
                paths=[]
                for layer in range(1, (2 if slot in ('head','glass') else 3 if slot=='hair' else 4)):
                    f=get(f'{layer}/{variant}/{mode}.png' if slot=='hair' else f'{layer}/{mode}.png')
                    expected=(1482,285) if mode=='game' else None
                    if f is None or (expected and f[1:]!=expected) or (mode=='show' and (f[1]<250 or f[2]!=312)): valid=False
                    paths.append(f[0] if f else None)
                modes[mode]=paths
            variants[variant]=modes
        icon=get('icon_1.png') or get('icon.png')
        show=variants['B' if slot=='hair' else 'default']['show'][0]
        score=(int(valid),int(bool(show)),len(files),int(origin=='newpanel'))
        if best is None or score>best[0]: best=(score,{'pic':pic,'complete':valid,'variants':variants,'icon':icon[0] if icon else None,'source':origin,'show':bool(show)})
    return best[1]

catalog={'sexes':{}}
for sex in ('m','f'):
    catalog['sexes'][sex]={}
    for slot in ('face','hair','cloth','head','glass'):
        pics=set()
        for origin,base in [('resource',Path(sex)/slot),('newpanel',Path('equip')/sex/slot)]:
            d=OUT/origin/base
            if d.exists(): pics.update(p.name for p in d.iterdir() if p.is_dir())
        pics.difference_update(LEGACY[slot])
        catalog['sexes'][sex][slot]=[choose(sex,slot,pic) for pic in sorted(pics)]
CAT.write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(records)} arquivos crus, {sum(r["decoded"] for r in records)} PNGs válidos')
for sex in ('m','f'):
 print(sex, {k:(len(v),sum(x['complete'] for x in v)) for k,v in catalog['sexes'][sex].items()})
