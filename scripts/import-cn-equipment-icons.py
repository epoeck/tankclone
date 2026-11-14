#!/usr/bin/env python3
"""Copia apenas ícones CN dos itens usados nos slots da mochila. Saída local e gitignored.
Uso: python3 scripts/import-cn-equipment-icons.py /caminho/NaiKuaiDDT
"""
import sys
from pathlib import Path

source = Path(sys.argv[1]) / "Resource/image"
out = Path(__file__).resolve().parent.parent / "packages/client/public/ui-local"
items = {
    **{f"forge/weapon-{name}.png": source / "arm" / name / "1/icon.png" for name in ["brick", "bomb", "bombpack"]},
    **{f"accessories/{name}.png": source / "equip/armlet" / name / "icon.png" for name in ["fiveyearsz0", "fiveyearsz1", "fiveyearsz2", "fiveyearsz3", "fiveyearsz4", "fiveyearsz5", "fiveyearsz6", "fiveyearsz7", "fiveyearsz8"]},
    **{f"accessories/{name}.png": source / "equip/ring" / name / "icon.png" for name in ["ring60", "ring61", "ring62", "ring63", "ring64", "ring65", "ring66", "ring67", "ring68"]},
    "slots/offhand.png": source / "equip/offhand/offhand6/icon.png",
    # The actual Pic="chicken" icon folder is missing in this dump; use the local chick
    # icon from unfrightprop/chicken0 as an explicit visual stand-in for the base Pintinho.
    "slots/pet.png": source / "unfrightprop/chicken0/icon.png",
    "slots/effect.png": source / "equip/m/eff/eff1/icon_1.png",
    "slots/necklace.png": source / "equip/necklace/xingxiu1/icon.png",
}
copied = 0
for rel, src in items.items():
    if not src.is_file():
        print(f"missing: {src}")
        continue
    data = src.read_bytes()
    if data.startswith(b"\x00\x03^_^\x89PNG"):
        data = data[5:]
        d = bytearray(data); d[16] ^= 255; data = bytes(d)
    dest = out / rel; dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(data); copied += 1
print(f"{copied} ícones CN locais em {out}")
