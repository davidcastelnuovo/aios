export type WorkshopRoleId = "copy" | "design" | "video" | "sites" | "seo";

export type WorkshopRole = {
  id: WorkshopRoleId;
  label: string;
  slugs: string[];
};

/** The five seats across the top of Carmen's workshop, in work order. */
export const WORKSHOP_ROLES: WorkshopRole[] = [
  { id: "copy", label: "קופירייטר", slugs: ["copywriter"] },
  {
    id: "design",
    label: "מעצב",
    slugs: ["creative_direct", "creative_studio"],
  },
  { id: "video", label: "עורך וידאו", slugs: ["video_director"] },
  { id: "sites", label: "בונה אתרים", slugs: ["site_builder"] },
  { id: "seo", label: "מקדם אתרים", slugs: ["seo_geo", "seo"] },
];

export type WorkshopSkin = {
  slug: string;
  name: string;
  avatarUrl?: string;
};

/** The tenant skin this seat uses, when one of its slugs exists. */
export function roleSkin(
  role: WorkshopRole,
  skins: WorkshopSkin[],
): WorkshopSkin | null {
  const slug = role.slugs.find((candidate) =>
    skins.some((skin) => skin.slug === candidate),
  );
  return skins.find((skin) => skin.slug === slug) ?? null;
}

export function roleForSlug(
  slug: string | null | undefined,
): WorkshopRole | null {
  if (!slug) return null;
  return WORKSHOP_ROLES.find((role) => role.slugs.includes(slug)) ?? null;
}
