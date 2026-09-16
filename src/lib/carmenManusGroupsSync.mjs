const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(value);
}

function isNotBlocked(row) {
  return row?.is_blocked !== true;
}

/** Build authoritative group catalog from tenant_integrations sync metadata. */
export function collectSyncedCatalog(integrations) {
  const byChatId = new Map();
  let hasSync = false;

  for (const integ of integrations || []) {
    const sync = integ?.settings?.manus_groups_sync || {};
    if (sync.synced_at) hasSync = true;

    if (Array.isArray(sync.groups)) {
      for (const g of sync.groups) {
        const groupChatId = String(g?.groupChatId || '').trim();
        const groupId = String(g?.groupId || '').trim();
        if (!groupChatId || !groupId) continue;
        byChatId.set(groupChatId, {
          groupChatId,
          groupId,
          name: String(g?.name || groupChatId),
        });
      }
    }

    if (Array.isArray(sync.group_chat_ids)) {
      for (const chatId of sync.group_chat_ids) {
        const groupChatId = String(chatId || '').trim();
        if (!groupChatId || byChatId.has(groupChatId)) continue;
        byChatId.set(groupChatId, {
          groupChatId,
          groupId: '',
          name: groupChatId,
        });
      }
    }
  }

  const entries = [...byChatId.values()];
  return {
    entries,
    chatIds: entries.map((e) => e.groupChatId),
    hasSync,
  };
}

/** Merge gateway sync catalog with whatsapp_groups rows (DB wins on names). */
export function mergeSyncCatalogWithDb(entries, dbByChatId) {
  const byId = new Map();

  for (const entry of entries) {
    const dbRow = dbByChatId.get(entry.groupChatId);
    if (dbRow && isNotBlocked(dbRow)) {
      byId.set(dbRow.id, dbRow);
      continue;
    }
    if (entry.groupId && isUuid(entry.groupId)) {
      byId.set(entry.groupId, {
        id: entry.groupId,
        group_chat_id: entry.groupChatId,
        group_name: dbRow?.group_name || entry.name,
        is_blocked: dbRow?.is_blocked ?? null,
      });
    }
  }

  for (const row of dbByChatId.values()) {
    if (isNotBlocked(row)) byId.set(row.id, row);
  }

  return [...byId.values()].sort((a, b) =>
    String(a.group_name || '').localeCompare(String(b.group_name || ''), 'he'),
  );
}
