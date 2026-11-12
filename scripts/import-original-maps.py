"""Importa cinco mapas DDTM e imagens de um clone Reborn local convertido.
Uso: python scripts/import-original-maps.py /caminho/ddtank-reborn
Requer Pillow e NumPy. Não executa código do clone.
"""
import hashlib, json, struct, sys, zlib
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
out = root / 'packages/client/public/maps'
rows = {m['id']: m for m in json.loads((source/'packages/fight/data/maps.json').read_text())}
report = {'source': 'thurdev/ddtank-reborn dab2b445f153a6852b48182d4afe5c43ebbe3e16; imagens locais do overlay merged', 'files': {}}
for num, name in [(1001,'Arco-íris'),(1002,'Voo Fantasma'),(1003,'Construção'),(1004,'Sala de Magia'),(1005,'Floresta Tropical')]:
    mid = f'original-{num}'; target = out/mid; target.mkdir(parents=True, exist_ok=True)
    pack = (source/f'packages/fight/data/maps/{num}.ddtm').read_bytes()
    raw = zlib.decompress(pack,-15); assert raw[:5] == b'DDTM\x01'
    pos=6; layers=[]
    for flag in (1,2):
        if raw[5] & flag:
            length,=struct.unpack_from('<I',raw,pos);pos+=4
            tile=raw[pos:pos+length];pos+=length
            w,h=struct.unpack_from('<ii',tile); stride=w//8+1
            assert len(tile)==8+stride*h
            bits=np.unpackbits(np.frombuffer(tile[8:],dtype=np.uint8).reshape(h,stride),axis=1)[:,:w].astype(bool)
            layers.append(bits)
        else: layers.append(None)
    assert pos == len(raw)
    mask=np.zeros((h,w,4),dtype=np.uint8);mask[:,:,3]=255
    mask[layers[0],:3]=255
    if layers[1] is not None: mask[layers[1],:3]=[255,0,0]
    Image.fromarray(mask).save(target/'mask.png',optimize=True)
    assets=source/f'vendor/_assets/merged/image/map/{num}'
    fore=Image.open(assets/'fore.png').convert('RGBA'); assert fore.size==(w,h)
    if (assets/'dead.png').exists():
        dead=Image.open(assets/'dead.png').convert('RGBA'); assert dead.size==(w,h); fore.alpha_composite(dead)
    fore.save(target/'art.png',optimize=True)
    (target/'background.jpg').write_bytes((assets/'back.jpg').read_bytes())
    (target/'thumbnail.png').write_bytes((assets/'samll_map.png').read_bytes())
    row=rows[num]; positions={str(i): [[int(v) for v in p.split(',')] for p in row[k].split('|')] for i,k in [(1,'posX'),(2,'posX1')]}
    manifest={'id':mid,'name':name,'width':w,'height':h,'art':'art.png','mask':'mask.png','background':'background.jpg','thumbnail':'thumbnail.png','spawns':{t:[p[0] for p in v] for t,v in positions.items()},'spawnsY':{t:[p[1] for p in v] for t,v in positions.items()},'windMultiplier':1,'sourceMapId':num}
    (target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    report['files'][mid]={'statesSha256':hashlib.sha256(np.where(mask[:,:,0] == 0, 0, np.where(mask[:,:,1] == 0, 2, 1)).astype(np.uint8).tobytes()).hexdigest(),'ddtm':hashlib.sha256(pack).hexdigest(),'input':{f:hashlib.sha256((assets/f).read_bytes()).hexdigest() for f in ['fore.png','back.jpg','samll_map.png','dead.png'] if (assets/f).exists()},'output':{f:hashlib.sha256((target/f).read_bytes()).hexdigest() for f in ['art.png','mask.png','background.jpg','thumbnail.png','manifest.json']}}
(out/'original-sources.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
