#!/usr/bin/env python3
"""Artes das armas fortalecidas do CN 14.7 (só locais): brick2/3, bomb2/3, bombpack2/3 → public/assets/avatar/arm/.
A arma muda de modelo no +10 (…2) e no +12 (…3) (itemstrengthengoodsinfo.xml). PNGs "protegidos" são decodificados.
Uso: python3 scripts/import-cn-weapons.py /caminho/NaiKuaiDDT [/caminho/ddtank-reborn]
O CN não tem todas (ex.: brick2); o pacote "merged" do Reborn completa o que faltar."""
import shutil, sys
from pathlib import Path
sources = [Path(sys.argv[1]) / 'Resource/image/arm'] + ([Path(sys.argv[2]) / 'vendor/_assets/merged/image/arm'] if len(sys.argv) > 2 else [])
out = Path(__file__).resolve().parent.parent / 'packages/client/public/assets/avatar/arm'
n = 0
for art in ('brick', 'bomb', 'bombpack'):
    for stage in (2, 3):
        folder = next((s / f'{art}{stage}' / '1' for s in sources if (s / f'{art}{stage}' / '1/1/game.png').exists()), None)
        if folder is None: print('sem arte:', f'{art}{stage}'); continue
        for f in folder.rglob('*.png'):
            data = f.read_bytes()
            if data.startswith(b'\x00\x03^_^'):
                d = bytearray(data[5:]); d[16] ^= 255; data = bytes(d)
            dest = out / f'{art}{stage}' / '1' / f.relative_to(folder); dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(data); n += 1
print(f'{n} PNGs de armas fortalecidas em {out}')

# ícones das pedras da loja/ferreiro (unfrightprop/<pic>/icon.png) → public/ui-local/forge/<pic>.png
icons = Path(sys.argv[1]) / 'Resource/image/unfrightprop'
dest = Path(__file__).resolve().parent.parent / 'packages/client/public/ui-local/forge'; dest.mkdir(parents=True, exist_ok=True); k = 0
for pic in ['strength1', 'strength2', 'strength3', 'strength4', 'strength9'] + [f'{a}{i}' for a in ('zhuque', 'xuanwu', 'qinglong', 'baihu') for i in range(1, 6)]:
    f = icons / pic / 'icon.png'
    if not f.exists(): continue
    data = f.read_bytes()
    if data.startswith(b'\x00\x03^_^'):
        d = bytearray(data[5:]); d[16] ^= 255; data = bytes(d)
    (dest / f'{pic}.png').write_bytes(data); k += 1
print(f'{k} ícones de pedras em {dest}')
