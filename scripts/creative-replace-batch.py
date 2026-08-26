#!/usr/bin/env python3
"""Upload replacement creative PNGs via cursor-generate-creative replace_variation."""
from __future__ import annotations

import base64
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

TENANT_ID = "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019"
ITEM_ID = "5afb5756-c46f-471f-9790-c00bfeafbdf6"
API = "https://zvoijyneresvkadpprel.supabase.co/functions/v1/cursor-generate-creative"


def replace_nonce(variation_id: str, item_id: str) -> str:
    msg = f"{variation_id}|{item_id}|creative-replace-v1".encode()
    return hashlib.sha256(msg).hexdigest()[:32]


def upload(variation_id: str, png_path: Path) -> dict:
    with open(png_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    payload = {
        "action": "replace_variation",
        "tenant_id": TENANT_ID,
        "item_id": ITEM_ID,
        "variation_id": variation_id,
        "replace_nonce": replace_nonce(variation_id, ITEM_ID),
        "image_base64": b64,
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: creative-replace-batch.py <variation_id> <png_path>", file=sys.stderr)
        sys.exit(1)
    variation_id = sys.argv[1]
    png_path = Path(sys.argv[2])
    result = upload(variation_id, png_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
