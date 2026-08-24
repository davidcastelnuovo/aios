import type { SupabaseClient } from "@supabase/supabase-js";

export interface BrandBook {
  name?: string;
  colors: string[];
  fonts?: string[];
  voice?: string;
  notes: string;
  source: "upload" | "auto" | "manual";
  fileUrl?: string;
  fileName?: string;
}

export interface StyleReference {
  url: string;
  name?: string;
}

export interface CreativeBrandKit {
  logoUrl?: string;
  brandBook?: BrandBook;
  styleReferences: StyleReference[];
}

const asString = (value: unknown) => typeof value === "string" ? value : undefined;

const asColors = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && /^#([0-9a-fA-F]{3,8})$/.test(item)) : [];

export const getBrandKit = (payload: Record<string, unknown> | null | undefined): CreativeBrandKit => {
  const book = payload?.brand_book && typeof payload.brand_book === "object"
    ? payload.brand_book as Record<string, unknown>
    : null;
  const refs = payload?.style_references;
  return {
    logoUrl: asString(payload?.logo_url),
    brandBook: book ? {
      name: asString(book.name),
      colors: asColors(book.colors),
      fonts: Array.isArray(book.fonts) ? book.fonts.filter((item): item is string => typeof item === "string") : undefined,
      voice: asString(book.voice),
      notes: asString(book.notes) ?? "",
      source: book.source === "upload" || book.source === "manual" || book.source === "auto" ? book.source : "manual",
      fileUrl: asString(book.fileUrl),
      fileName: asString(book.fileName),
    } : undefined,
    styleReferences: Array.isArray(refs)
      ? refs.filter((item): item is StyleReference => !!item && typeof item === "object" && typeof (item as StyleReference).url === "string")
      : [],
  };
};

export const brandKitPrompt = (kit: CreativeBrandKit) => {
  const lines = [
    kit.brandBook?.name && `Brand: ${kit.brandBook.name}`,
    kit.brandBook?.colors.length ? `Brand colors (use these, plus one controlled accent): ${kit.brandBook.colors.join(", ")}` : undefined,
    kit.brandBook?.voice && `Brand voice: ${kit.brandBook.voice}`,
    kit.logoUrl && "A logo asset exists and will be composited later — reserve a clean top-right pad (~18% width) with no face or clutter. Do not redraw or invent a logo.",
    kit.styleReferences.length > 0 && `${kit.styleReferences.length} style-reference image(s) attached: match their art-direction level (light, material, grade) without copying layout, lettering, or logo.`,
  ].filter(Boolean);
  return lines.join("\n");
};

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;

export const sampleColorsFromImageData = (data: Uint8ClampedArray) => {
  const buckets = new Map<string, number>();
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    if (a < 180) continue;
    const brightness = (r + g + b) / 3;
    if (brightness > 245 || brightness < 12) continue;
    const key = toHex(Math.round(r / 32) * 32, Math.round(g / 32) * 32, Math.round(b / 32) * 32);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([color]) => color);
};

export const deriveBrandBook = ({
  clientName,
  website,
  industry,
  brief,
  copy,
  colors,
  existing,
}: {
  clientName?: string;
  website?: string;
  industry?: string;
  brief?: string;
  copy?: string;
  colors?: string[];
  existing?: BrandBook;
}): BrandBook => {
  const palette = colors?.length ? colors : existing?.colors ?? [];
  const voice = existing?.voice
    || brief?.split("\n").map((line) => line.trim()).find((line) => line.length > 8)?.slice(0, 140)
    || copy?.split("\n").map((line) => line.trim()).find((line) => line.length > 8)?.slice(0, 140);
  const notes = [
    `# ברנדבוק — ${clientName || existing?.name || "המותג"}`,
    industry && `תחום: ${industry}`,
    website && `אתר: ${website}`,
    palette.length ? `צבעים: ${palette.join(" · ")}` : "צבעים: ייגזרו מהלוגו ומהבריף — בלי פלטת סטוק גנרית.",
    voice && `טון: ${voice}`,
    brief && `בריף:\n${brief.slice(0, 500)}`,
    "כללים: לא ממציאים לוגו, לא משבשים עברית, שומרים היררכיה כותרת → הצעה → CTA, שוליים בטוחים 6%.",
  ].filter(Boolean).join("\n\n");
  return {
    name: clientName || existing?.name,
    colors: palette,
    fonts: existing?.fonts ?? ["Rubik"],
    voice,
    notes,
    source: "auto",
  };
};

const sanitizeFileName = (name: string) => name.replace(/[^\w.\u0590-\u05FF-]+/g, "_").slice(0, 80);

export const uploadCreativeAsset = async ({
  supabase,
  tenantId,
  itemId,
  file,
  kind,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  itemId: string;
  file: File;
  kind: "logo" | "reference" | "brandbook";
}) => {
  const path = `${tenantId}/creative/${itemId}/${kind}/${Date.now()}_${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from("entity-attachments").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("entity-attachments").getPublicUrl(path);
  return { path, url: data.publicUrl, name: file.name };
};

export const sampleColorsFromFile = async (file: File): Promise<string[]> => {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return [];
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const max = 64;
  const scale = Math.min(max / bitmap.width, max / bitmap.height, 1);
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return [];
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close();
  return sampleColorsFromImageData(data);
};

export const GENERATION_ABORTED = "ABORTED";

export const isGenerationAborted = (error: unknown) =>
  error instanceof Error && error.message === GENERATION_ABORTED;

export const throwIfGenerationAborted = (aborted: boolean) => {
  if (aborted) throw new Error(GENERATION_ABORTED);
};
