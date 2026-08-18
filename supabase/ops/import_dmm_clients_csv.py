#!/usr/bin/env python3
"""One-off import: sync DMM clients from Carmen CSV export into production."""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

CSV_PATH = os.environ.get(
    "DMM_CSV_PATH",
    "/home/ubuntu/.cursor/projects/workspace/uploads/dmm_clients_3c44.csv",
)
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://zvoijyneresvkadpprel.supabase.co"
)
DMM_TENANT_ID = "6ad8f321-25db-4a04-8e44-e57a7c8961b2"
MC_TENANT_ID = "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019"
AGENCY_MC = "38cf0e62-1913-45cb-b917-88e421974fb1"
AGENCY_LTD = "25b9754c-27af-424a-93c5-4a58816f7a1f"
IMPORT_USER_ID = "ac7b2493-dcfa-47d8-80cc-b3900a406c46"  # David owner

# Known remaps after prior merges / renames
FORCED_TARGETS: dict[str, str] = {
    "a036130f-9c9f-49ca-b026-9fd23bc81870": "ebe4cebb-4844-4ef0-ac96-71a463050912",  # ABS → survivor
}

MC_CAMPAIGNER_NAMES = {"דוד", "אנה", "דניאל", "דקל", "הילה"}


def norm_phone(value: str | None) -> str:
    if not value:
        return ""
    digits = re.sub(r"\D", "", value)
    return digits[-9:] if len(digits) >= 9 else digits


def norm_name(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).lower()


def parse_services(raw: str) -> list[str]:
    if not raw:
        return []
    parts = re.split(r"[;,+]", raw)
    out: list[str] = []
    for part in parts:
        token = part.strip().lower().replace(" ", "_")
        if not token:
            continue
        mapping = {
            "seo": "seo",
            "ppc_google": "ppc_google",
            "ppc_meta": "ppc_meta",
            "meta": "ppc_meta",
            "full_social": "full_social",
            "social": "social",
            "automation": "automation",
        }
        out.append(mapping.get(token, token))
    return sorted(set(out))


def parse_campaigners(raw: str) -> list[str]:
    if not raw:
        return []
    names: list[str] = []
    for chunk in raw.split("/"):
        name = chunk.strip()
        if name:
            names.append(name)
    return names


def parse_start_date(raw: str) -> str | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    return None


def parse_wp_credentials(raw: str) -> list[dict[str, str | None]]:
    if not raw:
        return []
    entries: list[dict[str, str | None]] = []
    for chunk in raw.split(";;"):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.match(
            r"^(https?://[^\s]+)\s*\(([^/]+)\s*/\s*(.+)\)\s*$", chunk, re.I
        )
        if m:
            entries.append(
                {
                    "url": m.group(1).strip(),
                    "username": m.group(2).strip(),
                    "password": m.group(3).strip(),
                }
            )
        else:
            entries.append({"url": chunk, "username": None, "password": None})
    return entries


def load_csv(path: str) -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fields = [
            fn.strip().strip('"').replace("\ufeff", "") for fn in reader.fieldnames or []
        ]
        rows: list[dict[str, str]] = []
        for raw in reader:
            values = list(raw.values())
            row = {
                fields[i]: (values[i].strip() if i < len(values) and values[i] else "")
                for i in range(len(fields))
            }
            rows.append(row)
        return rows


class SupabaseRest:
    def __init__(self, service_role_key: str) -> None:
        self.base = f"{SUPABASE_URL}/rest/v1"
        self.key = service_role_key

    def _headers(self, prefer: str | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def request(
        self,
        method: str,
        path: str,
        *,
        query: dict[str, str] | None = None,
        body: Any | None = None,
        prefer: str | None = None,
    ) -> Any:
        url = self.base + path
        if query:
            url += "?" + urllib.parse.urlencode(query, safe="*,().")
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url, data=data, method=method, headers=self._headers(prefer)
        )
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read()
                if not raw:
                    return None
                return json.loads(raw)
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {path} -> {err.code}: {detail}") from err

    def get_all(self, table: str, select: str, extra_query: str = "") -> list[dict]:
        rows: list[dict] = []
        offset = 0
        page = 1000
        while True:
            query = f"select={urllib.parse.quote(select)}&limit={page}&offset={offset}"
            if extra_query:
                query += f"&{extra_query}"
            chunk = self.request("GET", f"/{table}?{query}")
            if not chunk:
                break
            rows.extend(chunk)
            if len(chunk) < page:
                break
            offset += page
        return rows


def infer_agency(campaigner_names: list[str], existing_agency: str | None) -> str:
    if existing_agency in (AGENCY_MC, AGENCY_LTD):
        return existing_agency
    if any(name in MC_CAMPAIGNER_NAMES for name in campaigner_names):
        return AGENCY_MC
    if any("דוד" in name or "אנה" in name for name in campaigner_names):
        return AGENCY_MC
    return AGENCY_LTD


def resolve_target(
    row: dict[str, str],
    by_id: dict[str, dict],
    by_name: dict[str, list[dict]],
    by_phone: dict[str, list[dict]],
    by_email: dict[str, list[dict]],
) -> tuple[str | None, str, list[str] | None]:
    csv_id = row["client_id"].strip()
    if csv_id in FORCED_TARGETS:
        return FORCED_TARGETS[csv_id], "forced_remap", None
    if csv_id in by_id:
        return csv_id, "by_id", None

    name = norm_name(row.get("שם העסק"))
    name_matches = by_name.get(name, [])
    if len(name_matches) == 1:
        return name_matches[0]["id"], "by_name", None
    if len(name_matches) > 1:
        filtered = _filter_by_details(name_matches, row)
        if len(filtered) == 1:
            return filtered[0]["id"], "by_name_details", None
        return None, "ambiguous_name", [m["id"] for m in name_matches]

    email = (row.get("אימייל") or "").strip().lower()
    if email:
        email_matches = by_email.get(email, [])
        if len(email_matches) == 1:
            return email_matches[0]["id"], "by_email", None
        if len(email_matches) > 1:
            # Shared family email across sibling brands — prefer insert with CSV id
            if csv_id not in by_id:
                return csv_id, "insert_new_shared_email", None
            filtered = _filter_by_details(email_matches, row)
            if len(filtered) == 1:
                return filtered[0]["id"], "by_email_details", None
            return None, "ambiguous_email", [m["id"] for m in email_matches]

    phone = norm_phone(row.get("טלפון"))
    if phone:
        phone_matches = by_phone.get(phone, [])
        if len(phone_matches) == 1:
            return phone_matches[0]["id"], "by_phone", None
        if len(phone_matches) > 1:
            if csv_id not in by_id:
                return csv_id, "insert_new_shared_phone", None
            filtered = _filter_by_details(phone_matches, row)
            if len(filtered) == 1:
                return filtered[0]["id"], "by_phone_details", None
            return None, "ambiguous_phone", [m["id"] for m in phone_matches]

    return csv_id, "insert_new", None


def _filter_by_details(matches: list[dict], row: dict[str, str]) -> list[dict]:
    phone = norm_phone(row.get("טלפון"))
    email = (row.get("אימייל") or "").strip().lower()
    filtered = []
    for match in matches:
        ok = True
        if phone and norm_phone(match.get("phone")) not in ("", phone):
            ok = False
        if email and (match.get("email") or "").strip().lower() not in ("", email):
            ok = False
        if ok:
            filtered.append(match)
    return filtered


def build_campaigner_map(db: SupabaseRest) -> dict[str, str]:
    rows = db.get_all(
        "campaigners",
        "id,full_name,tenant_id,active",
        f"or=(tenant_id.eq.{DMM_TENANT_ID},tenant_id.eq.{MC_TENANT_ID})",
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["full_name"]].append(row)

    mapping: dict[str, str] = {}
    for name, entries in grouped.items():
        active = [e for e in entries if e.get("active", True)]
        pool = active or entries
        dmm = [e for e in pool if e["tenant_id"] == DMM_TENANT_ID]
        mc = [e for e in pool if e["tenant_id"] == MC_TENANT_ID]
        if name in MC_CAMPAIGNER_NAMES and mc:
            mapping[name] = mc[0]["id"]
        elif dmm:
            mapping[name] = dmm[0]["id"]
        else:
            mapping[name] = pool[0]["id"]
    return mapping


def ensure_campaigners(db: SupabaseRest, names: set[str]) -> dict[str, str]:
    mapping = build_campaigner_map(db)
    missing = sorted(n for n in names if n not in mapping)
    for name in missing:
        body = {
            "tenant_id": DMM_TENANT_ID,
            "full_name": name,
            "role": ["campaigner"],
            "active": True,
        }
        created = db.request(
            "POST",
            "/campaigners",
            body=body,
            prefer="return=representation",
        )
        mapping[name] = created[0]["id"]
        db.request(
            "POST",
            "/campaigner_agencies",
            body={"campaigner_id": mapping[name], "agency_id": AGENCY_LTD},
            prefer="resolution=ignore-duplicates",
        )
    return mapping


def client_payload(
    row: dict[str, str],
    *,
    client_id: str,
    agency_id: str,
    is_insert: bool,
) -> dict[str, Any]:
    services = parse_services(row.get("שירותים", ""))
    status = (row.get("סטטוס") or "active").strip() or "active"
    mood = (row.get("מצב רוח") or "happy").strip() or "happy"
    tier = (row.get("Tier") or "").strip().upper() or None
    if tier not in ("A", "B", "C"):
        tier = None

    payload: dict[str, Any] = {
        "name": row["שם העסק"].strip(),
        "contact_name": row.get("שם איש קשר") or None,
        "phone": row.get("טלפון") or None,
        "email": row.get("אימייל") or None,
        "website": row.get("אתר") or None,
        "status": status,
        "mood_status": mood,
        "tier": tier,
        "industry": row.get("תעשייה") or None,
        "monthly_budget": float(row["תקציב חודשי"])
        if (row.get("תקציב חודשי") or "").strip()
        else None,
        "retainer": float(row["ריטיינר"]) if (row.get("ריטיינר") or "").strip() else None,
        "services": services,
        "is_seo_client": "seo" in services,
        "meta_ads_account_id": row.get("חשבון מודעות Meta") or None,
        "google_ads_account_id": row.get("חשבון Google Ads") or None,
        "start_date": parse_start_date(row.get("תאריך התחלה", "")),
        "tenant_id": DMM_TENANT_ID,
        "agency_id": agency_id,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    notes_parts = []
    if row.get("קבוצת WhatsApp"):
        notes_parts.append(f"קבוצת WhatsApp: {row['קבוצת WhatsApp']}")
    if row.get("קישורים/קבצים"):
        notes_parts.append(f"קישורים: {row['קישורים/קבצים']}")
    if row.get("אנשי קשר נוספים"):
        notes_parts.append(f"אנשי קשר נוספים: {row['אנשי קשר נוספים']}")
    if notes_parts:
        payload["notes"] = "\n".join(notes_parts)

    if is_insert:
        payload["id"] = client_id
    return payload


def run(dry_run: bool) -> dict[str, Any]:
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not service_key:
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY is required")

    db = SupabaseRest(service_key)
    rows = load_csv(CSV_PATH)
    clients = db.get_all(
        "clients",
        "id,name,phone,email,agency_id",
        f"tenant_id=eq.{DMM_TENANT_ID}",
    )

    by_id = {c["id"]: c for c in clients}
    by_name: dict[str, list[dict]] = defaultdict(list)
    by_phone: dict[str, list[dict]] = defaultdict(list)
    by_email: dict[str, list[dict]] = defaultdict(list)
    for client in clients:
        by_name[norm_name(client.get("name"))].append(client)
        phone = norm_phone(client.get("phone"))
        if phone:
            by_phone[phone].append(client)
        email = (client.get("email") or "").strip().lower()
        if email:
            by_email[email].append(client)

    all_campaigner_names = set()
    for row in rows:
        all_campaigner_names.update(parse_campaigners(row.get("קמפיינרים", "")))

    if dry_run:
        campaigner_map = build_campaigner_map(db)
    else:
        campaigner_map = ensure_campaigners(db, all_campaigner_names)

    stats: Counter[str] = Counter()
    skipped: list[dict[str, Any]] = []
    actions: list[dict[str, Any]] = []

    for row in rows:
        target_id, how, ambiguous = resolve_target(row, by_id, by_name, by_phone, by_email)
        stats[how] += 1
        if target_id is None:
            skipped.append(
                {
                    "name": row["שם העסק"],
                    "reason": how,
                    "candidates": ambiguous,
                }
            )
            continue

        is_insert = how.startswith("insert_new")
        existing = by_id.get(target_id)
        campaigner_names = parse_campaigners(row.get("קמפיינרים", ""))
        agency_id = infer_agency(
            campaigner_names, existing["agency_id"] if existing else None
        )
        payload = client_payload(
            row, client_id=target_id, agency_id=agency_id, is_insert=is_insert
        )
        campaigner_ids = [
            campaigner_map[name]
            for name in campaigner_names
            if name in campaigner_map
        ]

        action = {
            "name": row["שם העסק"],
            "match": how,
            "client_id": target_id,
            "insert": is_insert,
            "agency_id": agency_id,
            "campaigners": campaigner_names,
            "services": payload.get("services"),
            "status": payload.get("status"),
            "mood_status": payload.get("mood_status"),
        }
        actions.append(action)

        if dry_run:
            continue

        if is_insert:
            db.request("POST", "/clients", body=payload, prefer="return=minimal")
            by_id[target_id] = {"id": target_id, "agency_id": agency_id}
        else:
            db.request(
                "PATCH",
                "/clients",
                query={"id": f"eq.{target_id}"},
                body={k: v for k, v in payload.items() if k not in ("id", "tenant_id")},
                prefer="return=minimal",
            )

        # Sync campaigner assignments
        db.request(
            "DELETE", "/client_team", query={"client_id": f"eq.{target_id}"}
        )
        if campaigner_ids:
            db.request(
                "POST",
                "/client_team",
                body=[
                    {"client_id": target_id, "campaigner_id": cid}
                    for cid in sorted(set(campaigner_ids))
                ],
                prefer="return=minimal",
            )

        # Latest update note
        latest = (row.get("עדכון אחרון") or "").strip()
        if latest:
            existing_updates = db.request(
                "GET",
                f"/client_updates?client_id=eq.{target_id}&tenant_id=eq.{DMM_TENANT_ID}&select=content&order=created_at.desc&limit=1",
            )
            if not existing_updates or existing_updates[0].get("content") != latest:
                db.request(
                    "POST",
                    "/client_updates",
                    body={
                        "client_id": target_id,
                        "tenant_id": DMM_TENANT_ID,
                        "user_id": IMPORT_USER_ID,
                        "content": latest,
                        "update_type": "import",
                    },
                    prefer="return=minimal",
                )

        # WordPress credentials
        wp_entries = parse_wp_credentials(row.get("וורדפרס", ""))
        for entry in wp_entries:
            db.request(
                "POST",
                "/client_credentials",
                body={
                    "client_id": target_id,
                    "tenant_id": DMM_TENANT_ID,
                    "service_name": "wordpress",
                    "url": entry.get("url"),
                    "username": entry.get("username"),
                    "password": entry.get("password"),
                    "notes": "Imported from DMM CSV",
                },
                prefer="return=minimal",
            )

    summary = {
        "dry_run": dry_run,
        "rows": len(rows),
        "stats": dict(stats),
        "skipped": skipped,
        "actions_sample": actions[:5],
    }

    if not dry_run:
        db.request(
            "POST",
            "/claude_carmen_audit",
            body={
                "tenant_id": DMM_TENANT_ID,
                "actor": "claude",
                "action": "import_dmm_clients_csv",
                "target": DMM_TENANT_ID,
                "details": {
                    "rows": len(rows),
                    "stats": dict(stats),
                    "skipped": skipped,
                    "csv_path": CSV_PATH,
                },
            },
            prefer="return=minimal",
        )

    return summary


if __name__ == "__main__":
    dry = "--execute" not in sys.argv
    summary = run(dry_run=dry)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if summary.get("skipped"):
        sys.exit(2)
