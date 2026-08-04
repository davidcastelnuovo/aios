/**
 * Staff WhatsApp mapping helpers for Carmen.
 * Resolve campaigners / sales_people / team profiles to phones safely from DB rows
 * (never invent numbers). Pure helpers — DB I/O stays in the tool handler.
 */

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

/** Normalize Israeli mobiles to E.164-ish digits (9725…). */
export function normalizeStaffPhone(raw) {
  let d = digitsOnly(raw);
  if (!d) return null;
  if (d.startsWith("0") && d.length === 10) d = `972${d.slice(1)}`;
  if (d.length === 9 && /^[5-9]/.test(d)) d = `972${d}`;
  if (d.length < 9 || d.length > 15) return null;
  return d;
}

export function isValidStaffPhone(raw) {
  return !!normalizeStaffPhone(raw);
}

export function scoreNameMatch(fullName, query) {
  const name = String(fullName || "").trim().toLowerCase();
  const q = String(query || "").trim().toLowerCase();
  if (!name || !q) return 0;
  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (name.includes(q)) return 75;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => name.includes(p))) return 70;
  return 0;
}

/**
 * Pick a single staff match from candidate rows.
 * @returns {{ match: object|null, ambiguous: object[]|null, reason: string }}
 */
export function selectStaffMatch(candidates, { id = null, name = null, entityType = "auto" } = {}) {
  const rows = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  const wantedType = entityType && entityType !== "auto" ? String(entityType) : null;

  if (id) {
    const byId = rows.filter((r) => String(r.id) === String(id));
    const typed = wantedType ? byId.filter((r) => r.entity_type === wantedType) : byId;
    const pool = typed.length ? typed : byId;
    if (pool.length === 1) return { match: pool[0], ambiguous: null, reason: "id" };
    if (pool.length > 1) return { match: null, ambiguous: pool, reason: "ambiguous_id" };
    return { match: null, ambiguous: null, reason: "not_found_id" };
  }

  if (!name) return { match: null, ambiguous: null, reason: "missing_selector" };

  let scored = rows
    .map((r) => ({ row: r, score: scoreNameMatch(r.full_name, name) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (wantedType) {
    const typed = scored.filter((x) => x.row.entity_type === wantedType);
    if (typed.length) scored = typed;
  }

  if (!scored.length) return { match: null, ambiguous: null, reason: "not_found_name" };
  if (scored.length === 1 || scored[0].score > scored[1].score) {
    return { match: scored[0].row, ambiguous: null, reason: "name" };
  }
  const top = scored[0].score;
  const ties = scored.filter((x) => x.score === top).map((x) => x.row);
  return { match: null, ambiguous: ties, reason: "ambiguous_name" };
}

export function formatStaffContact(row) {
  if (!row) return null;
  const phone = normalizeStaffPhone(row.phone);
  return {
    entity_type: row.entity_type,
    id: row.id,
    full_name: row.full_name,
    phone,
    phone_raw: row.phone || null,
    has_phone: !!phone,
    role: row.role || null,
    email: row.email || null,
  };
}

export function buildStaffWhatsappAcceptanceCases() {
  return {
    ana: {
      id: "d6cd8d62-701e-4040-897b-cd07e119a9bd",
      full_name: "אנה",
      phone: "972545612156",
      entity_type: "campaigner",
    },
    david: {
      id: "3d58377d-1518-4067-82d7-34bb615d3039",
      full_name: "דוד קסטלנואובו",
      phone: "0507677613",
      entity_type: "campaigner",
    },
  };
}
