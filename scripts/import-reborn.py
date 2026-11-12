"""Importa somente máscaras, dados e vetores necessários ao PvP, de um commit fixo.

Uso: python scripts/import-reborn.py [diretório de um clone/cache local]
Sem argumento, baixa os arquivos do GitHub. Não executa código do repositório.
"""
import hashlib
import base64
import json
from pathlib import Path
import struct
import sys
import urllib.request
import zlib

COMMIT = "dab2b445f153a6852b48182d4afe5c43ebbe3e16"
ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else None
IDS = (101, 111, 161, 171, 381, 391)


def read(path):
    if CACHE:
        return (CACHE / path).read_bytes()
    url = f"https://raw.githubusercontent.com/thurdev/ddtank-reborn/{COMMIT}/{path}"
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def write_json(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


packed = read("packages/fight/data/bombs.ddtb")
raw = zlib.decompress(packed, -15)
assert raw[:5] == b"DDTB\x01"
count, = struct.unpack_from("<I", raw, 5)
offset = 9
shapes = {}
mask_files = {}
for _ in range(count):
    ball_id, length = struct.unpack_from("<iI", raw, offset)
    offset += 8
    data = raw[offset:offset + length]
    offset += length
    if ball_id not in IDS:
        continue
    mask_files[str(ball_id)] = base64.b64encode(data).decode("ascii")
    width, height = struct.unpack_from("<ii", data)
    stride = width // 8 + 1
    assert len(data) == 8 + stride * height
    rows = []
    for y in range(height):
        row = []
        start = None
        for x in range(width + 1):
            solid = x < width and data[8 + y * stride + x // 8] & (1 << (7 - x % 8))
            if solid and start is None:
                start = x
            elif not solid and start is not None:
                row.extend((start, x))
                start = None
        rows.append(row)
    shapes[str(ball_id)] = dict(width=width, height=height, rows=rows,
                                sha256=hashlib.sha256(data).hexdigest())
assert len(shapes) == len(IDS)
balls = json.loads(read("packages/fight/data/balls.json"))
write_json("packages/core/src/reference/reborn-craters.json", dict(
    commit=COMMIT, packSha256=hashlib.sha256(packed).hexdigest(), shapes=shapes,
    balls=[b for b in balls if b["id"] in IDS]))
golden = json.loads(read("packages/fight/test/golden/vectors.json"))
ball_by_id = {b["id"]: b for b in balls}
# O core atual não tem buffs/perfuração/arma secundária: esses casos ficam fora da comparação de dano.
damage = [dict(c, radius=ball_by_id[c["ballId"]]["radii"]) for c in golden["damage"]
          if not c["owner"][6] and not c["owner"][7] and not c["target"][2]]
write_json("packages/core/test/fixtures/reborn-golden.json", dict(
    commit=COMMIT, euler=golden["euler"], turnDelay=golden["turnDelay"], damage=damage, maskFiles=mask_files))
notice = ROOT / "third_party/ddtank-reborn"
notice.mkdir(parents=True, exist_ok=True)
for name in ("LICENSE", "THIRD_PARTY_NOTICES.md"):
    (notice / name).write_bytes(read(name).rstrip() + b"\n")
print(f"Importadas {len(shapes)} máscaras, {len(golden['euler'])} trajetórias Euler e {len(damage)} casos de dano.")
