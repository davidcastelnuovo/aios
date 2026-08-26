#!/usr/bin/env python3
"""Composite Promo logo onto bright-dominant creative PNGs (top-right light wall)."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def composite_logo(
    base_path: Path,
    logo_path: Path,
    out_path: Path,
    *,
    margin_ratio: float = 0.045,
    logo_width_ratio: float = 0.20,
) -> None:
    base = Image.open(base_path).convert("RGBA")
    logo = Image.open(logo_path).convert("RGBA")
    w, h = base.size
    target_w = int(w * logo_width_ratio)
    scale = target_w / logo.width
    target_h = int(logo.height * scale)
    logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    # Drop semi-transparent fringe that reads as a plaster pad on bright walls.
    alpha = logo.split()[3]
    logo.putalpha(alpha.point(lambda p: 255 if p > 200 else 0))
    margin = int(w * margin_ratio)
    x = w - margin - target_w
    y = margin
    base.paste(logo, (x, y), logo)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out_path, "PNG", optimize=True)


def extract_logo_from_reference(ref_path: Path, out_path: Path) -> None:
    """Crop logo zone from an approved bright reference (top-right ~22% x 12%)."""
    img = Image.open(ref_path).convert("RGBA")
    w, h = img.size
    left = int(w * 0.72)
    top = int(h * 0.02)
    right = int(w * 0.98)
    bottom = int(h * 0.14)
    crop = img.crop((left, top, right, bottom))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out_path, "PNG")


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage:\n"
            "  creative-bright-composite.py extract <reference.png> <logo_out.png>\n"
            "  creative-bright-composite.py apply <base.png> <logo.png> <out.png>",
            file=sys.stderr,
        )
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "extract":
        extract_logo_from_reference(Path(sys.argv[2]), Path(sys.argv[3]))
    elif cmd == "apply":
        composite_logo(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
