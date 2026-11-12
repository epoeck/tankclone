#!/usr/bin/env python3
"""Acrescenta ao catálogo CN (packages/core/src/reference/cn-wardrobe.json) o nome, TemplateID e os atributos de cada peça,
lidos do TemplateAlllist.xml do CN 14.7 (zlib). Só dados (nada de imagem). Chamado no fim de import-cn-wardrobe.py.
Uso: python3 scripts/cn-wardrobe-stats.py /caminho/NaiKuaiDDT"""
import json, re, sys, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAT = ROOT / 'packages/core/src/reference/cn-wardrobe.json'
raw = (Path(sys.argv[1]) / 'Request/TemplateAlllist.xml').read_bytes()
xml = zlib.decompress(raw).decode('utf-8', 'replace') if raw[:1] == b'x' else raw.decode('utf-8', 'replace')
CATEGORY = {'head': '1', 'glass': '2', 'hair': '3', 'cloth': '5', 'face': '6'}
SEX = {'m': '1', 'f': '2'}
by = {}
for m in re.findall(r'<Item ([^>]*)/?>', xml):
    d = dict(re.findall(r'(\w+)="([^"]*)"', m))
    key = (d.get('CategoryID'), d.get('NeedSex'), d.get('Pic'))
    stats = [int(d.get(k, 0) or 0) for k in ('Attack', 'Defence', 'Agility', 'Luck')]
    if max(stats) >= 1000: continue  # itens de GM (6666) não valem como referência
    # a mesma arte pode ter várias versões (prazo, loja); guarda a de menor TemplateID, que é a base
    if key not in by or int(d['TemplateID']) < int(by[key]['TemplateID']): by[key] = d

cat = json.loads(CAT.read_text())
found = total = 0
for sex, slots in cat['sexes'].items():
    for slot, pieces in slots.items():
        for p in pieces:
            total += 1
            d = by.get((CATEGORY[slot], SEX[sex], p['pic'])) or by.get((CATEGORY[slot], '0', p['pic']))
            if not d: continue
            found += 1
            p['templateId'] = int(d['TemplateID']); p['name'] = d.get('Name', '')
            p['stats'] = {'atk': int(d['Attack']), 'def': int(d['Defence']), 'agi': int(d['Agility']), 'luck': int(d['Luck'])}
            # chapéu: Property1 = 1 deixa o cabelo inteiro (variante B); 0 usa o cabelo cortado (A) — PlayerInfo.getHairType/BaseLayer
            if slot == 'head': p['keepsHair'] = d.get('Property1') == '1'
CAT.write_text(json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'atributos em {found}/{total} peças')
