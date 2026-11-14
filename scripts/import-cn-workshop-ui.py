#!/usr/bin/env python3
"""Importa só sprites usados pelas telas CN do Ferreiro e Pet (saída ignorada pelo Git).

Uso:
  python3 scripts/import-cn-workshop-ui.py /path/NaiKuaiDDT --ffdec-java java --ffdec-jar ffdec-cli.jar

As origens são `Flash/ui/cn_trad/swf/{ddtstore,petsbag}.swf` e `Resource/image/pet`.
FFDec é necessário apenas para extrair os símbolos de bitmap dos SWFs.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("client", type=Path, help="raiz NaiKuaiDDT local")
    parser.add_argument("--ffdec-java", default="java")
    parser.add_argument("--ffdec-jar", required=True)
    args = parser.parse_args()
    base = args.client
    flash = base / "Flash/ui/cn_trad/swf"
    out = Path(__file__).resolve().parents[1] / "packages/client/public/ui-local/cn-ui"

    # SWF Character IDs confirmados no SymbolClassTag dos arquivos CN 14.7.
    exports = {
        "forge": (flash / "ddtstore.swf", [155, 153, 129, 113, 110, 102, 52, 24, 23, 89, 108, 154, 436, 438, 444, 70, 107, 157, 20, 33, 159, 160, 27, 118, 119, 125, 151, 152, 68, 72, 82, 105, 111, 60, 62, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 32, 45, 51, 53, 54, 59, 63, 74, 85, 109, 116, 145, 171, 179, 180, 148, 106, 81, 79, 177, 144, 103, 104, 48, 167, 395, 425, 315]),
        "pet": (flash / "petsbag.swf", [2, 4, 6, 9, 10, 32, 46, 57, 91, 106, 112, 113, 114, 115, 116, 117, 118, 141, 140, 59, 60, 83, 96, 25, 39, 121, 123, 124, 119, 129, 143, 177, 582]),
        "petbag": (flash / "ddtbagandinfo.swf", [7, 10, 12, 15, 142, 147, 168, 208, 209, 355, 144, 146]),
        "common-bag": (flash / "ddtcoreii.swf", [425, 426]),
        "common": (flash / "ddtcorei.swf", [65, 78, 79, 82, 151, 171, 175, 211, 212, 233, 248, 278, 283, 290, 291, 297, 301, 53, 54, 56, 80, 81, 675]),
        "common-scale": (flash / "ddtcorescalebitmap.swf", [16, *range(95, 104), 75, 106, 111, 116, 121, 126, 132, 139, 154, 176, 109, 114, 119, 124, 129, 135, 149, 163, 185, *range(212, 239), *range(65, 74), *range(203, 212), *range(47, 56)]),
        "common-road": (flash / "roadcomponent.swf", [30, 36, 40, 42, 43, 49, 50, 68, 71, 72, 77, 80, 81, 82]),
    }
    scale_swf = flash / "corescalebitmap.swf"
    exports["pet-frame"] = (scale_swf, list(range(38, 47)))
    exports["common-pet-scale"] = (flash / "firstcore.swf", [2, 68, 71, 101, 114, 124, 132, 139, 146, 152, 159, 165, 98, 113, 123, 131, 138, 145, 151, 158, 164])
    temp = Path(tempfile.mkdtemp(prefix="cn-workshop-ui-"))
    manifest: dict[str, object] = {"source": "CN 14.7 local files; names are SWF symbol IDs", "files": {}}
    try:
        for group, (swf, ids) in exports.items():
            dest = temp / group
            dest.mkdir(parents=True)
            input_swf = swf
            raw = swf.read_bytes()
            # Several local CN SWFs retain the Reborn client's 37-byte road7 envelope.
            if raw.startswith(b"road7"):
                unwrapped = dest / swf.name
                unwrapped.write_bytes(raw[37:])
                input_swf = unwrapped
            subprocess.run([
                args.ffdec_java, "-jar", args.ffdec_jar, "-selectid", ",".join(map(str, ids)),
                "-format", "image:png", "-export", "image", str(dest), str(input_swf),
            ], check=True, stdout=subprocess.DEVNULL)
            for image in dest.glob("*.png"):
                if group == "common-scale" and "NewScale9CornerImage3" in image.name:
                    symbol = re.search(r"NewScale9CornerImage3\.§([1-9])§", image.name)
                    target_name = f"table2-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "common-scale" and "ddtScale9CornerImage12" in image.name:
                    symbol = re.search(r"ddtScale9CornerImage12\.§([1-9])§", image.name)
                    target_name = f"panel5-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "common-scale" and "NewScale9CornerImage20" in image.name:
                    symbol = re.search(r"NewScale9CornerImage20\.§([1-9])§", image.name)
                    target_name = f"money-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "common-scale" and "NewScale9CornerImage4" in image.name:
                    symbol = re.search(r"NewScale9CornerImage4\.§([1-9])§", image.name)
                    target_name = f"table1-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "common-scale" and "NewScale9CornerImage14" in image.name:
                    symbol = re.search(r"NewScale9CornerImage14\.§([1-9])§", image.name)
                    target_name = f"mainframe14-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "common-scale" and "ddtScale9CornerImage16" in image.name:
                    symbol = re.search(r"ddtScale9CornerImage16\.§([1-9])§", image.name)
                    target_name = f"pet-selectLight-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "common-scale" and "NewScale9CornerImage13" in image.name:
                    symbol = re.search(r"NewScale9CornerImage13\.§([1-9])§", image.name)
                    target_name = f"success-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "common-pet-scale" and "NewScale9CornerImage9" in image.name:
                    symbol = re.search(r"NewScale9CornerImage9\.§([1-9])§", image.name)
                    target_name = f"pet8-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "common-pet-scale" and "NewScale9CornerImage10" in image.name:
                    symbol = re.search(r"NewScale9CornerImage10\.§([1-9])§", image.name)
                    target_name = f"pet9-slice-{symbol.group(1)}.png" if symbol else image.name
                elif group == "forge" and int(re.match(r"^(\d+)", image.name).group(1)) in {148,106,81,79,177,144,103,104,48,167}:
                    icon_id = int(re.match(r"^(\d+)", image.name).group(1))
                    tab_names = {148:"tabStore-selected",106:"tabStore-idle",81:"tabForge-selected",79:"tabForge-idle",177:"tabFine-selected",144:"tabFine-idle",103:"tabEmblem-selected",104:"tabEmblem-idle",48:"tabSoulMark-selected",167:"tabSoulMark-idle"}
                    target_name = f"newStore-{tab_names[icon_id]}.png"
                elif group == "forge" and int(re.match(r"^(\d+)", image.name).group(1)) in {32,59,109}:
                    icon_id = int(re.match(r"^(\d+)", image.name).group(1))
                    target_name = {32: "compose-tab2-idle.png", 59: "compose-tab1-selected.png", 109: "compose-stone-icon.png"}[icon_id]
                else:
                    target_name = image.name
                aliases = {
                    ("common-road", 36): "scroll-track.png",
                    ("common-road", 42): "shop-number-up.png",
                    ("common-road", 43): "shop-number-down.png",
                    ("common-road", 49): "frame-small.png",
                    ("common-road", 71): "check2-idle.png",
                    ("common-road", 72): "check2-selected.png",
                    ("common-road", 77): "frame-fill.png",
                    ("common", 211): "shop-purchase-btn.png",
                    ("common", 212): "shop-purchase-amount.png",
                    ("common-pet-scale", 2): "goldlinebg.png",
                    ("common-pet-scale", 71): "shop-cell-bg.png",
                    ("common-scale", 47): "input-slice-9.png",
                    ("common-scale", 48): "input-slice-8.png",
                    ("common-scale", 49): "input-slice-7.png",
                    ("common-scale", 50): "input-slice-6.png",
                    ("common-scale", 51): "input-slice-5.png",
                    ("common-scale", 52): "input-slice-4.png",
                    ("common-scale", 53): "input-slice-3.png",
                    ("common-scale", 54): "input-slice-2.png",
                    ("common-scale", 55): "input-slice-1.png",
                }
                source_id = int(re.match(r"^(\d+)", image.name).group(1))
                if (group, source_id) in aliases:
                    alias_name = aliases[(group, source_id)]
                    alias_group = "common-scale" if alias_name.startswith("input-") else "common-road" if group == "common-road" else "common"
                    alias_target = out / alias_group / alias_name
                    alias_target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(image, alias_target)
                    manifest["files"][str(alias_target.relative_to(out))] = {
                        "swf": str(swf.relative_to(base)), "id": source_id, "alias": image.name,
                    }
                # FFDec includes the Chinese symbol name in the output basename; keep that
                # stable name so imported files can be audited against the source SWF.
                target_dir = out / group
                target_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(image, target_dir / target_name)
                manifest["files"][str(target_dir.relative_to(out) / target_name)] = {
                    "swf": str(swf.relative_to(base)), "id": int(re.match(r"^(\d+)", image.name).group(1)),
                }

        # ContentBg and StrengthenBg are sprites, not bitmap exports. Keep frame 1 only.
        for symbol_id, symbol_name in [(436, "ContentBg"), (444, "StrengthenBg")]:
            sprite_out = temp / f"forge-sprite-{symbol_id}"
            sprite_out.mkdir(parents=True)
            subprocess.run([
                args.ffdec_java, "-jar", args.ffdec_jar, "-selectid", str(symbol_id),
                "-format", "sprite:png", "-export", "sprite", str(sprite_out), str(flash / "ddtstore.swf"),
            ], check=True, stdout=subprocess.DEVNULL)
            folder = next((p for p in sprite_out.iterdir() if p.is_dir()), None)
            frame = folder / "1.png" if folder else None
            if frame and frame.is_file():
                target = out / "forge" / f"{symbol_id}_asset.ddtstore.{symbol_name}.png"
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(frame, target)
                manifest["files"][str(target.relative_to(out))] = {"swf": str((flash / "ddtstore.swf").relative_to(base)), "id": symbol_id, "role": "sprite frame 1"}

        # ComposeBg is the active compose background sprite, rather than the legacy pane tint.
        sprite_out = temp / "forge-sprite-438"
        sprite_out.mkdir(parents=True)
        compose_input = flash / "ddtstore.swf"
        compose_raw = compose_input.read_bytes()
        if compose_raw.startswith(b"road7"):
            unwrapped = sprite_out / compose_input.name
            unwrapped.write_bytes(compose_raw[37:])
            compose_input = unwrapped
        subprocess.run([
            args.ffdec_java, "-jar", args.ffdec_jar, "-selectid", "438",
            "-format", "sprite:png", "-export", "sprite", str(sprite_out), str(compose_input),
        ], check=True, stdout=subprocess.DEVNULL)
        compose_frames = sorted(sprite_out.rglob("*.png"), key=lambda p: p.as_posix())
        compose_frame = next((p for p in compose_frames if p.parent.name.startswith("DefineSprite_438") and p.name == "1.png"), None)
        if compose_frame is not None:
            target = out / "forge" / "compose-bg.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(compose_frame, target)
            manifest["files"][str(target.relative_to(out))] = {"swf": str((flash / "ddtstore.swf").relative_to(base)), "id": 438, "role": "compose pane sprite frame 1"}

        for symbol_id, target_name in [(425, "help-strength.png"), (395, "help-compose.png"), (315, "help-fusion.png")]:
            sprite_out = temp / f"forge-help-{symbol_id}"
            sprite_out.mkdir(parents=True)
            store_input = flash / "ddtstore.swf"
            store_raw = store_input.read_bytes()
            if store_raw.startswith(b"road7"):
                unwrapped = sprite_out / store_input.name
                unwrapped.write_bytes(store_raw[37:])
                store_input = unwrapped
            subprocess.run([
                args.ffdec_java, "-jar", args.ffdec_jar, "-selectid", str(symbol_id),
                "-format", "sprite:png", "-export", "sprite", str(sprite_out), str(store_input),
            ], check=True, stdout=subprocess.DEVNULL)
            frames = sorted(sprite_out.rglob("*.png"), key=lambda p: p.as_posix())
            frame = next((p for p in frames if p.parent.name.startswith(f"DefineSprite_{symbol_id}") and p.name == "1.png"), None)
            if frame is not None:
                target = out / "forge" / target_name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(frame, target)
                manifest["files"][str(target.relative_to(out))] = {"swf": str((flash / "ddtstore.swf").relative_to(base)), "id": symbol_id, "role": "help title sprite frame 1"}

        vip_icon = out / "common-pet-scale" / "68_asset.game.smallplayer.seniorVIP.png"
        if vip_icon.is_file():
            target = out / "forge" / "vip-discount-icon.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(vip_icon, target)
            manifest["files"][str(target.relative_to(out))] = {"swf": str((flash / "firstcore.swf").relative_to(base)), "id": 68, "alias": str(vip_icon.relative_to(out))}

        # BagView's footer artwork is a timeline sprite in ddtbagandinfo.swf.
        bag_swf = flash / "ddtbagandinfo.swf"
        bag_sprite_out = temp / "petbag-sprite-355"
        bag_sprite_out.mkdir(parents=True)
        bag_input = bag_swf
        bag_raw = bag_swf.read_bytes()
        if bag_raw.startswith(b"road7"):
            bag_input = bag_sprite_out / bag_swf.name
            bag_input.write_bytes(bag_raw[37:])
        subprocess.run([
            args.ffdec_java, "-jar", args.ffdec_jar, "-selectid", "355",
            "-format", "sprite:png", "-export", "sprite", str(bag_sprite_out), str(bag_input),
        ], check=True, stdout=subprocess.DEVNULL)
        bag_frames = sorted(bag_sprite_out.rglob("*.png"), key=lambda p: p.as_posix())
        bag_frame = next((p for p in bag_frames if p.parent.name.startswith("DefineSprite_355") and p.name == "1.png"), None)
        if bag_frame is not None:
            target = out / "petbag" / "355_asset.bagAndInfo.info.personalInfoBgAsset4.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(bag_frame, target)
            manifest["files"][str(target.relative_to(out))] = {"swf": str(bag_swf.relative_to(base)), "id": 355, "role": "bag footer source sprite, frame 1"}

        fusion_buttons = [
            (365, "weapon-unselected"), (368, "weapon-selected"),
            (351, "jewellry-unselected"), (354, "jewellry-selected"),
            (358, "avatar-unselected"), (361, "avatar-selected"),
            (386, "drill-unselected"), (389, "drill-selected"),
            (329, "combine-unselected"), (333, "combine-selected"),
            (344, "other-unselected"), (347, "other-selected"),
        ]
        for symbol_id, output_name in fusion_buttons:
            sprite_out = temp / f"forge-fusion-{symbol_id}"
            sprite_out.mkdir(parents=True)
            subprocess.run([
                args.ffdec_java, "-jar", args.ffdec_jar, "-selectid", str(symbol_id),
                "-format", "sprite:png", "-export", "sprite", str(sprite_out), str(flash / "ddtstore.swf"),
            ], check=True, stdout=subprocess.DEVNULL)
            folder = next((p for p in sprite_out.iterdir() if p.is_dir()), None)
            frame = folder / "1.png" if folder else None
            if frame and frame.is_file():
                target = out / "forge" / f"fusion-{output_name}.png"
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(frame, target)
                manifest["files"][str(target.relative_to(out))] = {"swf": str((flash / "ddtstore.swf").relative_to(base)), "id": symbol_id, "role": "SelectedButton sprite frame 1"}

        # Pic="chicken" is present in pettemplateinfo.xml, but the matching `pet/chicken`
        # folder is absent in this dump. chicken0 is the local CN chick item icon fallback;
        # it is intentionally documented as an icon stand-in, not the pet's animated model.
        pet_icon = base / "Resource/image/unfrightprop/chicken0/icon.png"
        if pet_icon.is_file():
            data = pet_icon.read_bytes()
            if data.startswith(b"\x00\x03^_^\x89PNG"):
                data = data[5:]
                data = data[:16] + bytes([data[16] ^ 255]) + data[17:]
            target = out / "pet/pintinho-icon-fallback.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            manifest["files"][str(target.relative_to(out))] = {"resource": str(pet_icon.relative_to(base)), "role": "stand-in icon; Pic=chicken source folder missing"}

        for folder in ("brick", "bomb", "bombpack"):
            icon = base / f"Resource/image/arm/{folder}/1/icon.png"
            if not icon.is_file():
                raise FileNotFoundError(f"Ícone de arma CN ausente: {icon}")
            data = icon.read_bytes()
            if data.startswith(bytes([0, 3, 94, 95, 94, 137, 80, 78, 71])):
                data = data[5:]
                data = data[:16] + bytes([data[16] ^ 255]) + data[17:]
            target = out / "forge" / f"weapon-{folder}.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            manifest["files"][str(target.relative_to(out))] = {"resource": str(icon.relative_to(base)), "role": "weapon inventory icon"}

        # ItemCellUnSelected is a one-frame sprite in ddtcorei (not an image tag).
        item_cell_out = temp / "common-item-cell-675"
        item_cell_out.mkdir(parents=True)
        corei_swf = flash / "ddtcorei.swf"
        corei_input = corei_swf
        corei_raw = corei_swf.read_bytes()
        if corei_raw.startswith(b"road7"):
            corei_input = item_cell_out / corei_swf.name
            corei_input.write_bytes(corei_raw[37:])
        subprocess.run([
            args.ffdec_java, "-jar", args.ffdec_jar, "-selectid", "675",
            "-format", "sprite:png", "-export", "sprite", str(item_cell_out), str(corei_input),
        ], check=True, stdout=subprocess.DEVNULL)
        item_cell_frames = sorted(item_cell_out.rglob("*.png"), key=lambda p: p.as_posix())
        item_cell_frame = next((p for p in item_cell_frames if p.parent.name.startswith("DefineSprite_675") and p.name == "1.png"), None)
        if item_cell_frame is not None:
            target = out / "common" / "675_asset.core.ItemCellUnSelected.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item_cell_frame, target)
            manifest["files"][str(target.relative_to(out))] = {"swf": str(corei_swf.relative_to(base)), "id": 675, "role": "source sprite frame 1"}
        # The pet body's BG class is a DefineSprite, not a bitmap. Export only its first frame.
        pet_swf = flash / "petsbag.swf"
        sprite_out = temp / "pet-sprite"
        sprite_out.mkdir(parents=True)
        subprocess.run([
            args.ffdec_java, "-jar", args.ffdec_jar, "-selectid", "582",
            "-format", "sprite:png", "-export", "sprite", str(sprite_out), str(pet_swf),
        ], check=True, stdout=subprocess.DEVNULL)
        # Export only the first timeline frame; rglob over every frame is nondeterministic
        # and the original pet UI displays this sprite's initial state.
        sprite_frames = sorted(sprite_out.rglob("*.png"), key=lambda p: p.as_posix())
        first_frame = next((p for p in sprite_frames if p.parent.name.startswith("DefineSprite_582") and p.name == "1.png"), None)
        if first_frame is not None:
            target = out / "pet" / "petsbag-bg-sprite-582.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(first_frame, target)
            manifest["files"][str(target.relative_to(out))] = {"swf": str(pet_swf.relative_to(base)), "id": 582, "role": "pet panel source sprite, frame 1"}

        manifest["source_sha256"] = {
            str(path.relative_to(base)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted({entry[0] for entry in exports.values()} | {scale_swf})
        }
        (out / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        print(f"Importados assets CN selecionados em {out}")
    finally:
        shutil.rmtree(temp, ignore_errors=True)


if __name__ == "__main__":
    main()
