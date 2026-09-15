/** Normalize Manus gateway list-groups payloads into { id, name, participantsCount }. */
export function normalizeManusGroupsPayload(data) {
  const raw = data?.groups
    ?? data?.data?.groups
    ?? data?.data
    ?? (Array.isArray(data) ? data : []);
  if (!Array.isArray(raw)) return [];

  return raw
    .map((g) => {
      const id = g?.id || g?.groupId || g?.jid || g?.chatId || g?.group_chat_id;
      const name = g?.name || g?.subject || g?.groupName || g?.group_name || id;
      const isMember = g?.isMember ?? g?.member ?? g?.joined ?? g?.is_member;
      return {
        id: id ? String(id) : '',
        name: name ? String(name).slice(0, 200) : '',
        participantsCount: g?.participantsCount ?? g?.participantCount ?? null,
        isMember: isMember === undefined ? true : !!isMember,
      };
    })
    .filter((g) => g.id && g.id.includes('@g.us') && g.isMember);
}
