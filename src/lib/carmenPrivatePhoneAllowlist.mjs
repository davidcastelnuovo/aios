export function normalizePrivatePhone(p) {
  return (p || "").replace(/\D/g, "");
}

function sourcePriority(source) {
  if (source === "policy") return 3;
  if (source === "identity") return 2;
  if (source === "automation") return 1;
  return 0;
}

/** Merge policy, identities, and automation into one private-allowlist view. */
export function mergePrivatePhoneAllowlist(params) {
  const byPhone = new Map();

  const upsert = (row, priority) => {
    const phone = normalizePrivatePhone(row.phone);
    if (phone.length < 9) return;
    const prev = byPhone.get(phone);
    if (!prev || priority >= sourcePriority(prev.source)) {
      byPhone.set(phone, {
        ...prev,
        ...row,
        phone,
        surfaces: row.surfaces?.length ? row.surfaces : prev?.surfaces || ["whatsapp_private"],
      });
    }
  };

  for (const p of params.automationPhones || []) {
    upsert({ phone: p, surfaces: ["whatsapp_private"], source: "automation" }, 1);
  }

  for (const id of params.identities || []) {
    const surfaces = Array.isArray(id.surfaces) ? id.surfaces : ["whatsapp_private", "whatsapp_group"];
    if (!surfaces.includes("whatsapp_private")) continue;
    upsert({
      phone: id.phone,
      label: id.display_name || undefined,
      status: id.status,
      surfaces,
      dev_escalation_tier: id.dev_escalation_tier || null,
      source: "identity",
    }, 2);
  }

  for (const p of params.policyPhones || []) {
    upsert({ ...p, source: "policy" }, 3);
  }

  return Array.from(byPhone.values()).sort((a, b) =>
    (a.label || a.phone).localeCompare(b.label || b.phone, "he"),
  );
}
