#!/usr/bin/env python3
"""Composite Promo logo onto bright-dominant creative PNGs (top-right light wall)."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def prepare_logo(logo_path: Path, *, upscale_min_width: int = 480) -> Image.Image:
    """Return RGBA logo at least upscale_min_width wide (2x upsample + sharpen if needed)."""
    logo = Image.open(logo_path).convert("RGBA")
    if logo.width < upscale_min_width:
        scale = upscale_min_width / logo.width
        logo = logo.resize(
            (int(logo.width * scale), int(logo.height * scale)),
            Image.Resampling.LANCZOS,
        )
        logo = logo.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
    return _clean_logo_alpha(logo)


def _clean_logo_alpha(logo: Image.Image) -> Image.Image:
    """Drop light fringes without binarizing antialiased edges (avoids pixelated/stair-step look)."""
    arr = np.array(logo, dtype=np.uint8)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    light_fringe = (a > 0) & (a < 255) & (r > 225) & (g > 225) & (b > 225)
    arr[..., 3][light_fringe] = 0
    fully_light = (a == 255) & (r > 240) & (g > 240) & (b > 240)
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
