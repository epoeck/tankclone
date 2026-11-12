"""Importa os PNGs clássicos do pacote de recursos usado como fonte pelo DDTank Reborn.
Não altera as imagens. Os hashes e caminhos originais ficam no manifesto.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import struct
import urllib.request

COMMIT = "16e24b119f96b93b34ddb148f9a035f71a234e67"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "packages/client/public/assets/avatar"
BASE = f"https://raw.githubusercontent.com/dk-khoado/Gunny-3.0/{COMMIT}/inetpub/wwwroot/Resource/image/"
jobs = {}
catalog = {"source": "dk-khoado/Gunny-3.0", "commit": COMMIT, "sexes": {}, "weapons": {}, "wings": {}}


def image(path):
    jobs[path] = None
    return path


for sex in ("m", "f"):
    categories = {}
    for slot, pics, count in [("face", ["default", "face1", "face2"], 3),
                              ("cloth", ["cloth1", "cloth2", "cloth3"], 3),
                              ("hair", ["default", "hair3", "hair5"], 2),
                              ("head", ["head1", "head2"], 1),
                              ("glass", ["glass1"], 1)]:
        options = []
        for pic in pics:
            variants = {}
            for variant in (["A", "B"] if slot == "hair" else [""]):
                modes = {}
                for mode in ("game", "show"):
                    modes[mode] = [image(f"equip/{sex}/{slot}/{pic}/{layer}/" +
                                         (variant + "/" if variant else "") + mode + ".png")
                                   for layer in range(1, count + 1)]
                variants[variant or "default"] = modes
            options.append({"pic": pic, "variants": variants})
        categories[slot] = options
    catalog["sexes"][sex] = categories
for weapon, pic in [("prism", "bomb"), ("sledge", "brick"), ("furnace", "bombpack")]:
    catalog["weapons"][weapon] = {mode: image(f"arm/{pic}/1/0/{mode}.png") for mode in ("game", "show")}
catalog["wings"]["1"] = image("equip/wing/wing002/icon.png")


def fetch(path):
    target = OUT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        with urllib.request.urlopen(BASE + path, timeout=40) as response:
            data = response.read()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"arquivo não é PNG: {path}")
        target.write_bytes(data)
    data = target.read_bytes()
    width, height = struct.unpack_from(">II", data, 16)
    return path, dict(width=width, height=height, sha256=hashlib.sha256(data).hexdigest())


with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
    files = dict(pool.map(fetch, jobs))
catalog["files"] = files
target = ROOT / "packages/core/src/reference/avatar.json"
target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
print(f"Importados {len(files)} PNGs; {sum((OUT/p).stat().st_size for p in files)} bytes.")
