#!/usr/bin/env python3
"""Sync DMM CSV extras: WhatsApp groups, folder links, extra contacts, status fixes."""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://zvoijyneresvkadpprel.supabase.co"
)
DMM_TENANT = "6ad8f321-25db-4a04-8e44-e57a7c8961b2"
DEFAULT_CSV = "/home/ubuntu/.cursor/projects/workspace/uploads/dmm_clients_3c44.csv"

FORCED_CLIENT_IDS = {
    "7f4e478a-5c2c-4652-be96-72928c4b60fe": "313f11ef-a408-4e6c-82c0-31f73a216e1b",
    "267d2f83-09c9-4f0d-973f-eb677254d929": "a93f8f40-dd24-49ff-8bb6-cc9788946647",
    "76d2f6aa-9d35-437c-8611-b48b1c3c00fd": "d578f1db-f9be-44bf-9e4a-18b8921a0efb",
}

# DIABLO WhatsApp group was renamed to Bisi in whatsapp_groups.
MANUAL_GROUP_IDS = {
    "שיווק ל diablo": "7da76840-8470-4fdd-9727-1e30ca02f142",
}

STATUS_FIXES = {
    "313f11ef-a408-4e6c-82c0-31f73a216e1b": "paused",  # עודד אביב — CSV paused vs DB ended
}


def norm(text: str) -> str:
    s = (text or "").strip().lower()
    s = re.sub(r"[\s\-_]+", " ", s)
    s = re.sub(r"[^\w\sא-ת]", "", s)
    return s.strip()


class SB:
    def __init__(self, key: str) -> None:
        self.base = f"{SUPABASE_URL}/rest/v1"
        self.key = key

    def _req(
        self,
        method: str,
        path: str,
        *,
        query: str = "",
        body: Any | None = None,
        prefer: str | None = None,
    ) -> Any:
        url = self.base + path + (f"?{query}" if query else "")
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read()
                if not raw:
                    return None
                return json.loads(raw)
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {path}?{query} -> {err.code}: {detail}") from err

    def fetch_all(self, table: str, query: str) -> list[dict]:
        rows: list[dict] = []
        offset = 0
        while True:
            batch = self._req("GET", f"/{table}", query=f"{query}&limit=500&offset={offset}") or []
            rows.extend(batch)
            if len(batch) < 500:
                break
            offset += 500
        return rows


def build_notes_lookup(clients: list[dict]) -> dict[str, str]:
    pat = re.compile(
        r"^(.+?)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$",
        re.M,
    )
    lookup: dict[str, str] = {}
    for client in clients:
        for match in pat.finditer(client.get("notes") or ""):
            lookup[norm(match.group(1))] = match.group(2)
    return lookup


def resolve_client(row: dict, by_id: dict[str, dict], by_name: dict[str, dict]) -> dict | None:
    cid = (row.get("client_id") or "").strip()
    if cid in FORCED_CLIENT_IDS:
        cid = FORCED_CLIENT_IDS[cid]
    if cid in by_id:
        return by_id[cid]
    name = (row.get("שם העסק") or "").strip()
    return by_name.get(name)


def match_whatsapp_group(
    group_name: str,
    groups: list[dict],
    notes_lookup: dict[str, str],
) -> tuple[str | None, str | None]:
    ng = norm(group_name)
    gid_by_name = {norm(g["group_name"]): g["id"] for g in groups}

    if ng in MANUAL_GROUP_IDS:
        return MANUAL_GROUP_IDS[ng], "manual"
    if ng in gid_by_name:
        return gid_by_name[ng], "exact"
    if ng in notes_lookup:
        return notes_lookup[ng], "notes"

    best_notes: tuple[str, str, float] | None = None
    for name, gid in notes_lookup.items():
        score = SequenceMatcher(None, ng, name).ratio()
        if not best_notes or score > best_notes[2]:
            best_notes = (gid, name, score)
    if best_notes and best_notes[2] >= 0.72:
        return best_notes[0], f"notes_fuzzy:{best_notes[1]}"

    best_group: tuple[str, str, float] | None = None
    for group in groups:
        score = SequenceMatcher(None, ng, norm(group["group_name"])).ratio()
        if not best_group or score > best_group[2]:
            best_group = (group["id"], group["group_name"], score)
    if best_group and best_group[2] >= 0.72:
        return best_group[0], f"group_fuzzy:{best_group[1]}"
    return None, None


def extract_urls(text: str) -> list[str]:
    return re.findall(r"https?://[^\s\"']+", text or "")


def parse_extra_contact(text: str) -> dict[str, str | None]:
    cleaned = re.sub(r"[\u2066-\u2069\u200e\u200f]", "", text or "").strip()
    if not cleaned:
        return {}

    email_match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", cleaned)
    email = email_match.group(0) if email_match else None

    phone_match = re.search(r"(\+?\d[\d\s\-()]{7,}\d)", cleaned)
    phone = re.sub(r"\s+", " ", phone_match.group(1)).strip() if phone_match else None

    name_part = cleaned.split("(")[0].strip()
    if email:
        name_part = name_part.replace(email, "").strip(" /-")
    if phone:
        name_part = name_part.replace(phone, "").strip(" /-")
    name_part = re.sub(r"\s*/\s*$", "", name_part).strip()

    role = None
    role_match = re.search(r"-\s*(.+)\)?$", cleaned)
    if role_match:
        role = role_match.group(1).strip(" )")

    if not name_part and not email and not phone:
        return {}

    return {
        "contact_name": name_part or "איש קשר",
        "email": email,
        "phone": phone,
        "role": role,
    }


def sync_extras(sb: SB, csv_path: str, *, dry_run: bool = False) -> dict[str, Any]:
    with open(csv_path, encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    clients = sb.fetch_all("clients", f"tenant_id=eq.{DMM_TENANT}&select=*")
    groups = sb.fetch_all("whatsapp_groups", f"tenant_id=eq.{DMM_TENANT}&select=id,group_name")
    tasks = sb.fetch_all("tasks", f"tenant_id=eq.{DMM_TENANT}&select=id,client_id,title,status")
    contacts = sb.fetch_all("client_contacts", f"tenant_id=eq.{DMM_TENANT}&select=*")

    by_id = {c["id"]: c for c in clients}
    by_name = {c["name"].strip(): c for c in clients}
    notes_lookup = build_notes_lookup(clients)
    task_counts: dict[str, int] = {}
    for task in tasks:
        cid = task.get("client_id")
        if cid:
            task_counts[cid] = task_counts.get(cid, 0) + 1

    results: dict[str, Any] = {
        "whatsapp_linked": [],
        "whatsapp_skipped": [],
        "folder_links": [],
        "contacts_added": [],
        "status_fixed": [],
        "tasks_gap": [],
    }

    # WhatsApp groups
    for row in rows:
        group_name = (row.get("קבוצת WhatsApp") or "").strip()
        if not group_name:
            continue
        client = resolve_client(row, by_id, by_name)
        if not client:
            results["whatsapp_skipped"].append({"reason": "client_not_found", "row": row["שם העסק"]})
            continue
        if client.get("whatsapp_group_id"):
            results["whatsapp_skipped"].append(
                {"client": client["name"], "reason": "already_linked", "group_id": client["whatsapp_group_id"]}
            )
            continue

        gid, method = match_whatsapp_group(group_name, groups, notes_lookup)
        if not gid:
            results["whatsapp_skipped"].append(
                {"client": client["name"], "reason": "no_match", "csv_group": group_name}
            )
            continue

        entry = {
            "client_id": client["id"],
            "client": client["name"],
            "group_id": gid,
            "csv_group": group_name,
            "method": method,
        }
        if not dry_run:
            sb._req(
                "PATCH",
                "/clients",
                query=f"id=eq.{client['id']}",
                body={
                    "whatsapp_group_id": gid,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                prefer="return=minimal",
            )
        results["whatsapp_linked"].append(entry)

    # Folder links
    for row in rows:
        links_text = row.get("קישורים/קבצים") or ""
        urls = extract_urls(links_text)
        if not urls:
            continue
        client = resolve_client(row, by_id, by_name)
        if not client:
            continue

        primary = urls[0]
        folder_links = [{"name": "קישור", "url": url} for url in urls]
        existing = client.get("folder_links") or []
        if isinstance(existing, str):
            try:
                existing = json.loads(existing)
            except json.JSONDecodeError:
                existing = []
        if not isinstance(existing, list):
            existing = []

        if client.get("folder_link") == primary and existing == folder_links:
            continue

        entry = {
            "client_id": client["id"],
            "client": client["name"],
            "folder_link": primary,
            "folder_links": folder_links,
        }
        if not dry_run:
            sb._req(
                "PATCH",
                "/clients",
                query=f"id=eq.{client['id']}",
                body={
                    "folder_link": primary,
                    "folder_links": folder_links,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                prefer="return=minimal",
            )
        results["folder_links"].append(entry)

    # Extra contacts
    existing_keys = {
        (c["client_id"], norm(c.get("contact_name") or ""), (c.get("email") or "").lower())
        for c in contacts
    }
    for row in rows:
        extra = (row.get("אנשי קשר נוספים") or "").strip()
        if not extra:
            continue
        client = resolve_client(row, by_id, by_name)
        if not client:
            continue
        parsed = parse_extra_contact(extra)
        if not parsed:
            continue
        key = (client["id"], norm(parsed["contact_name"]), (parsed.get("email") or "").lower())
        if key in existing_keys:
            continue

        body = {
            "client_id": client["id"],
            "tenant_id": DMM_TENANT,
            "contact_name": parsed["contact_name"],
            "phone": parsed.get("phone"),
            "email": parsed.get("email"),
            "role": parsed.get("role"),
            "is_primary": False,
        }
        if not dry_run:
            sb._req("POST", "/client_contacts", body=body, prefer="return=minimal")
        existing_keys.add(key)
        results["contacts_added"].append({"client": client["name"], **body})

    # Status fixes
    for client_id, status in STATUS_FIXES.items():
        client = by_id.get(client_id)
        if not client or client.get("status") == status:
            continue
        entry = {
            "client_id": client_id,
            "client": client["name"],
            "from": client.get("status"),
            "to": status,
        }
        if not dry_run:
            sb._req(
                "PATCH",
                "/clients",
                query=f"id=eq.{client_id}",
                body={"status": status, "updated_at": datetime.now(timezone.utc).isoformat()},
                prefer="return=minimal",
            )
        results["status_fixed"].append(entry)

    # Task gap audit (CSV has counts only — cannot recreate task content)
    for row in rows:
        want = int(row.get("מספר משימות") or 0)
        if want <= 0:
            continue
        client = resolve_client(row, by_id, by_name)
        if not client:
            continue
        have = task_counts.get(client["id"], 0)
        if have < want:
            results["tasks_gap"].append(
                {
                    "client": client["name"],
                    "csv_count": want,
                    "db_count": have,
                    "missing": want - have,
                }
            )

    if not dry_run:
        sb._req(
            "POST",
            "/claude_carmen_audit",
            body={
                "tenant_id": DMM_TENANT,
                "actor": "claude",
                "action": "sync_dmm_csv_extras",
                "target": DMM_TENANT,
                "details": {
                    "whatsapp_linked": len(results["whatsapp_linked"]),
                    "folder_links": len(results["folder_links"]),
                    "contacts_added": len(results["contacts_added"]),
                    "status_fixed": len(results["status_fixed"]),
                    "tasks_gap_clients": len(results["tasks_gap"]),
                    "tasks_gap_total": sum(item["missing"] for item in results["tasks_gap"]),
                },
            },
            prefer="return=minimal",
        )

    return results


def main() -> None:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY required")

    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry_run = "--dry-run" in sys.argv
    csv_path = args[0] if args else DEFAULT_CSV

    sb = SB(key)
    results = sync_extras(sb, csv_path, dry_run=dry_run)
    print(json.dumps(results, ensure_ascii=False, indent=2))

    if dry_run:
        return

    wa = len(results["whatsapp_linked"])
    folders = len(results["folder_links"])
    contacts = len(results["contacts_added"])
    status = len(results["status_fixed"])
    task_clients = len(results["tasks_gap"])
    task_missing = sum(item["missing"] for item in results["tasks_gap"])

    msg = (
        f"✅ השלמת סנכרון CSV DMM — extras: "
        f"{wa} קבוצות WhatsApp, {folders} קישורי תיקייה, {contacts} אנשי קשר, {status} תיקוני סטטוס. "
        f"משימות: CSV מציין {task_missing} משימות חסרות אצל {task_clients} לקוחות — "
        f"אין ב-CSV תוכן משימות, לא נוצרו placeholders."
    )
    try:
        sb._req("POST", "/rpc/claude_notify_david", body={"p_message": msg, "p_tenant": DMM_TENANT})
    except RuntimeError:
        pass


if __name__ == "__main__":
    main()
