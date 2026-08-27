#!/usr/bin/env python3
"""Composite Promo logo onto bright-dominant creative PNGs (top-right light wall)."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def prepare_logo(logo_path: Path, *, upscale_min_width: int = 960) -> Image.Image:
    """Upscale the exact brand PNG — preserves ribbon gradient red→black; never AI-redraw."""
    logo = Image.open(logo_path).convert("RGBA")
    if logo.width >= upscale_min_width:
        return _clean_logo_alpha(logo)
    # Integer upscale keeps gradient pixels intact (Lanczos); avoid unsharp on folds.
    factor = max(2, -(-upscale_min_width // logo.width))  # ceil division, min 2x
    logo = logo.resize(
        (logo.width * factor, logo.height * factor),
        Image.Resampling.LANCZOS,
    )
    return _clean_logo_alpha(logo)


def _clean_logo_alpha(logo: Image.Image) -> Image.Image:
    """Remove only near-white plate fringes; keep gradient/shadow pixels at red→black fold."""
    arr = np.array(logo, dtype=np.uint8)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    light_fringe = (a > 0) & (a < 255) & (r > 235) & (g > 235) & (b > 235)
    arr[..., 3][light_fringe] = 0
    fully_light = (a == 255) & (r > 248) & (g > 248) & (b > 248)
    arr[..., 3][fully_light] = 0
    return Image.fromarray(arr)


def composite_logo(
    base_path: Path,
    logo_path: Path,
    out_path: Path,
    *,
    margin_ratio: float = 0.045,
    logo_width_ratio: float = 0.17,
) -> None:
    base = Image.open(base_path).convert("RGBA")
    logo = prepare_logo(logo_path)
    w, h = base.size
    target_w = int(w * logo_width_ratio)
    # Never upscale past prepared logo — keeps edges crisp on 1024+ canvases.
    target_w = min(target_w, logo.width)
    scale = target_w / logo.width
    target_h = int(logo.height * scale)
    logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    margin = int(w * margin_ratio)
    x = w - margin - target_w
    y = margin
    base.paste(logo, (x, y), logo)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out_path, "PNG", compress_level=3)


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
