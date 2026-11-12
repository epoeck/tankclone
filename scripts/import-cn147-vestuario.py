"""Copia ≥15 itens de cada categoria de vestuário do cliente DDTank CN 14.7 local para testar o vestuário novo.
Placeholders SÓ locais: packages/client/public/vestuario-local (gitignored; nunca no git nem no servidor público).
Uso: python scripts/import-cn147-vestuario.py "/caminho/DDT-CN-14.7/NaiKuaiDDT" [quantidade]
Gera catalog.json com nome (chinês), TemplateID, Pic, sexo, cores, atributos e os arquivos copiados."""
import hashlib, json, re, shutil, sys, zlib
from pathlib import Path

src = Path(sys.argv[1]); per = int(sys.argv[2]) if len(sys.argv) > 2 else 15
img = src / 'Resource/image'
out = Path(__file__).resolve().parent.parent / 'packages/client/public/vestuario-local/cn147'
raw = (src / 'Request/TemplateAlllist.xml').read_bytes()
xml = zlib.decompress(raw).decode('utf-8', 'replace') if raw[:1] == b'x' else raw.decode('utf-8', 'replace')
items = [dict(re.findall(r'(\w+)="([^"]*)"', m)) for m in re.findall(r'<Item ([^>]*)/?>', xml)]

CATS = {1: 'head', 2: 'glass', 3: 'hair', 4: 'eff', 5: 'cloth', 6: 'face', 13: 'suits'}
SEX = {'1': 'm', '2': 'f'}

def complete(folder: Path) -> list[Path]:
    """Pastas de camada com game.png e show.png (o mesmo formato do avatar atual)."""
    layers = [p.parent for p in folder.rglob('game.png') if (p.parent / 'show.png').exists()]
    return sorted(set(layers))

if out.exists(): shutil.rmtree(out)
catalog = {'source': 'DDTank CN 14.7 (NaiKuaiDDT) — placeholders locais', 'items': []}
def unprotect(dest: Path):
    """Alguns PNGs do CN vêm "protegidos": 5 bytes de cabeçalho (00 03 '^_^') e o byte 16 invertido (mesma regra de import-cn-wardrobe.py)."""
    for f in dest.rglob('*.png'):
        b = f.read_bytes()
        if b.startswith(b'\x00\x03^_^'):
            d = bytearray(b[5:]); d[16] ^= 255; f.write_bytes(bytes(d))

def add(it, category, sex, folder: Path, rel: str, kind='sprite'):
    dest = out / rel; shutil.copytree(folder, dest); unprotect(dest)
    files = sorted(str(p.relative_to(out)) for p in dest.rglob('*') if p.is_file())
    catalog['items'].append({
        'templateId': int(it['TemplateID']), 'name': it.get('Name', ''), 'pic': it['Pic'], 'category': category, 'sex': sex, 'kind': kind,
        'colors': it.get('Colors', ''), 'quality': int(it.get('Quality', 0) or 0), 'needLevel': int(it.get('NeedLevel', 0) or 0),
        'attack': int(it.get('Attack', 0) or 0), 'defence': int(it.get('Defence', 0) or 0), 'agility': int(it.get('Agility', 0) or 0), 'luck': int(it.get('Luck', 0) or 0),
        'canStrengthen': it.get('CanStrengthen') == 'true', 'canCompose': it.get('CanCompose') == 'true', 'files': files,
    })

counts = {}
for cid, cat in CATS.items():
    for sx, s in SEX.items():
        seen, n = set(), 0
        for it in sorted((i for i in items if i.get('CategoryID') == str(cid) and i.get('NeedSex') in (sx, '0')), key=lambda i: -int(i['TemplateID'])):
            pic = it.get('Pic', ''); folder = img / 'equip' / s / cat / pic
            if not pic or pic in seen or not folder.is_dir() or not complete(folder): continue
            seen.add(pic); add(it, cat, s, folder, f'{cat}/{s}/{pic}'); n += 1
            if n >= per: break
        counts[f'{cat}/{s}'] = n

# asas: no original são SWF (wings.swf) — copiados como estão; precisam de conversão para o leitor de timelines
seen, n = set(), 0
for it in sorted((i for i in items if i.get('CategoryID') == '15'), key=lambda i: -int(i['TemplateID'])):
    pic = it.get('Pic', ''); folder = img / 'equip/wing' / pic
    if not pic or pic in seen or not (folder / 'wings.swf').exists(): continue
    seen.add(pic); add(it, 'wing', 'both', folder, f'wing/{pic}', 'swf'); n += 1
    if n >= per: break
counts['wing'] = n

# armas: arm/<pic>/1/0 (na mão/loja) e arm/<pic>/1/1 (nas costas)
seen, n = set(), 0
for it in sorted((i for i in items if i.get('CategoryID') == '7'), key=lambda i: -int(i['TemplateID'])):
    pic = it.get('Pic', ''); folder = img / 'arm' / pic
    if not pic or pic in seen or not (folder / '1/1/game.png').exists() or not (folder / '1/0/show.png').exists(): continue
    seen.add(pic); add(it, 'arm', 'both', folder, f'arm/{pic}'); n += 1
    if n >= per: break
counts['arm'] = n

catalog['counts'] = counts
(out / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + '\n')
print(json.dumps(counts, indent=1))
