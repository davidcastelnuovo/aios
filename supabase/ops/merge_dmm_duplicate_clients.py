#!/usr/bin/env python3
"""Merge three known duplicate DMM client pairs via Supabase REST (service role)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://zvoijyneresvkadpprel.supabase.co"
)
DMM_TENANT = "6ad8f321-25db-4a04-8e44-e57a7c8961b2"

MERGES = [
    {
        "reason": "עודד אביב duplicate: fold empty active shell into CSV-enriched record",
        "source": "7f4e478a-5c2c-4652-be96-72928c4b60fe",
        "target": "313f11ef-a408-4e6c-82c0-31f73a216e1b",
    },
    {
        "reason": "גלקסיה נכסים duplicate: fold paused MC shell into active LTD record with history",
        "source": "267d2f83-09c9-4f0d-973f-eb677254d929",
        "target": "a93f8f40-dd24-49ff-8bb6-cc9788946647",
    },
    {
        "reason": "גיל פינקלשטיין duplicate: fold older record into fuller team/history survivor",
        "source": "76d2f6aa-9d35-437c-8611-b48b1c3c00fd",
        "target": "d578f1db-f9be-44bf-9e4a-18b8921a0efb",
    },
]

TABLES_CLIENT_ID = [
    "client_updates",
    "client_contacts",
    "client_credentials",
    "client_suppliers",
    "client_onboarding",
    "client_tenant_financial_data",
    "communication_logs",
    "seo_monthly_updates",
    "tasks",
    "finance",
    "income_payments",
    "crm_dashboards",
    "chat_messages",
    "hidden_chats",
    "chat_contact_tags",
    "blocked_contacts",
    "manually_read_contacts",
    "payment_links",
    "one_time_incomes",
    "invoice_uploads",
    "telegram_messages",
    "call_logs",
    "maskyoo_numbers",
    "rank_tracking_projects",
    "social_media_wordpress_sites",
    "publishing_sites",
    "publishing_articles",
    "site_tracking_configs",
    "marketing_pipelines",
    "report_schedules",
    "report_deliveries",
    "campaign_pulse_snapshots",
    "carmen_whatsapp_identities",
    "zoom_recordings",
    "marketing_media_library",
    "marketing_triggers",
    "marketing_work_items",
    "social_pages",
    "social_publications",
    "social_comments",
    "campaign_alerts",
    "campaign_schedules",
    "seo_call_snapshots",
    "ahrefs_reports",
]


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
            if err.code == 404:
                return None
            detail = err.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {path}?{query} -> {err.code}: {detail}") from err

    def get_client(self, cid: str) -> dict | None:
        rows = self._req("GET", "/clients", query=f"id=eq.{cid}&select=*")
        return rows[0] if rows else None

    def count(self, table: str, cid: str) -> int:
        q = f"client_id=eq.{cid}&select=id"
        req = urllib.request.Request(
            f"{self.base}/{table}?{q}",
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Prefer": "count=exact",
                "Range": "0-0",
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                cr = resp.headers.get("Content-Range", "*/0")
                return int(cr.split("/")[-1])
        except urllib.error.HTTPError:
            return 0

    def repoint(self, table: str, source: str, target: str) -> int:
        before = self.count(table, source)
        if before == 0:
            return 0
        if table == "campaign_pulse_snapshots":
            self._req(
                "DELETE",
                "/campaign_pulse_snapshots",
                query=f"client_id=eq.{source}",
                prefer="return=minimal",
            )
            return before
        self._req(
            "PATCH",
            f"/{table}",
            query=f"client_id=eq.{source}",
            body={"client_id": target},
            prefer="return=minimal",
        )
        return before

    def merge_team(self, source: str, target: str) -> int:
        src_rows = self._req(
            "GET",
            "/client_team",
            query=f"client_id=eq.{source}&select=id,campaigner_id",
        ) or []
        tgt_campaigners = {
            r["campaigner_id"]
            for r in (
                self._req(
                    "GET",
                    "/client_team",
                    query=f"client_id=eq.{target}&select=campaigner_id",
                )
                or []
            )
        }
        moved = 0
        for row in src_rows:
            if row["campaigner_id"] in tgt_campaigners:
                self._req(
                    "DELETE",
                    "/client_team",
                    query=f"id=eq.{row['id']}",
                    prefer="return=minimal",
                )
            else:
                self._req(
                    "PATCH",
                    "/client_team",
                    query=f"id=eq.{row['id']}",
                    body={"client_id": target},
                    prefer="return=minimal",
                )
                moved += 1
        return moved

    def merge_crm_tables(self, source: str, target: str) -> int:
        rows = (
            self._req(
                "GET",
                "/crm_tables",
                query=f"client_id=eq.{source}&select=id,integration_settings",
            )
            or []
        )
        for row in rows:
            settings = row.get("integration_settings") or {}
            if isinstance(settings, dict):
                settings = dict(settings)
                settings["clientId"] = target
                if "client_id" in settings:
                    settings["client_id"] = target
            self._req(
                "PATCH",
                "/crm_tables",
                query=f"id=eq.{row['id']}",
                body={
                    "client_id": target,
                    "campaign_active": True,
                    "integration_settings": settings,
                },
                prefer="return=minimal",
            )
        # orphan refs in integration_settings
        orphan = (
            self._req(
                "GET",
                "/crm_tables",
                query=(
                    "select=id,integration_settings"
                    f"&or=(integration_settings->>clientId.eq.{source},integration_settings->>client_id.eq.{source})"
                ),
            )
            or []
        )
        for row in orphan:
            settings = dict(row.get("integration_settings") or {})
            settings["clientId"] = target
            settings["client_id"] = target
            self._req(
                "PATCH",
                "/crm_tables",
                query=f"id=eq.{row['id']}",
                body={
                    "client_id": target,
                    "integration_settings": settings,
                    "campaign_active": True,
                },
                prefer="return=minimal",
            )
        return len(rows) + len(orphan)

    def merge_scalars(self, source: dict, target: dict) -> dict[str, Any]:
        patch: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}

        def pick(field: str):
            s = source.get(field)
            t = target.get(field)
            if t in (None, "", [], {}):
                if s not in (None, "", [], {}):
                    patch[field] = s
            elif field == "notes" and s and s not in (t or ""):
                patch[field] = f"{t}\n---\n{s}" if t else s

        for field in [
            "website",
            "phone",
            "email",
            "contact_name",
            "retainer",
            "monthly_budget",
            "tier",
            "mood_status",
            "meta_ads_account_id",
            "google_ads_account_id",
            "notes",
        ]:
            pick(field)

        src_services = source.get("services") or []
        tgt_services = target.get("services") or []
        if isinstance(src_services, list) and isinstance(tgt_services, list):
            merged = sorted(set(tgt_services) | set(src_services))
            if merged != tgt_services:
                patch["services"] = merged
                patch["is_seo_client"] = "seo" in merged

        if source.get("status") == "active" or target.get("status") != "active":
            patch["status"] = "active"

        return patch

    def delete_client(self, cid: str) -> None:
        self._req("DELETE", "/clients", query=f"id=eq.{cid}", prefer="return=minimal")

    def audit(self, source: dict, target: dict, reason: str, counts: dict) -> None:
        self._req(
            "POST",
            "/claude_carmen_audit",
            body={
                "tenant_id": DMM_TENANT,
                "actor": "claude",
                "action": "merge_clients",
                "target": target["id"],
                "details": {
                    "source_id": source["id"],
                    "source_name": source.get("name"),
                    "target_id": target["id"],
                    "target_name": target.get("name"),
                    "reason": reason,
                    "row_counts": counts,
                },
            },
            prefer="return=minimal",
        )


def merge_pair(sb: SB, source_id: str, target_id: str, reason: str) -> dict:
    source = sb.get_client(source_id)
    target = sb.get_client(target_id)
    if not source:
        return {"skipped": True, "reason": "source missing"}
    if not target:
        raise RuntimeError(f"target {target_id} missing")

    counts: dict[str, int] = {}
    counts["client_team"] = sb.merge_team(source_id, target_id)
    counts["crm_tables"] = sb.merge_crm_tables(source_id, target_id)

    for table in TABLES_CLIENT_ID:
        counts[table] = sb.repoint(table, source_id, target_id)

    patch = sb.merge_scalars(source, target)
    if patch:
        sb._req(
            "PATCH",
            "/clients",
            query=f"id=eq.{target_id}",
            body=patch,
            prefer="return=minimal",
        )

    sb.delete_client(source_id)
    sb.audit(source, target, reason, counts)
    return {"merged": True, "target": target_id, "counts": counts}


def main() -> None:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY required")

    sb = SB(key)
    results = []
    for item in MERGES:
        print("Merging", item["source"], "->", item["target"])
        results.append({**item, "result": merge_pair(sb, item["source"], item["target"], item["reason"])})

    print(json.dumps(results, ensure_ascii=False, indent=2))

    msg = (
        "✅ מיזוג 3 כפילויות DMM הושלם: עודד אביב, גלקסיה נכסים, גיל פינקלשטיין. "
        "כל הרשומות שויכו ל-survivor והכפילים נמחקו."
    )
    try:
        sb._req(
            "POST",
            "/rpc/claude_notify_david",
            body={"p_message": msg, "p_tenant": DMM_TENANT},
        )
    except RuntimeError:
        pass


if __name__ == "__main__":
    main()
