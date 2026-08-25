import type { CSSProperties } from "react";

export type CreativeTextAlign = "right" | "center" | "left";

/** Overlay geometry stays LTR so `left`/`flex-end` stay physical. Hebrew lives only on the type. */
export const overlayBoxDir = "ltr" as const;

/** Forced RTL for every Hebrew copy layer — never `auto` (Latin tokens like AI/GEO flip the line). */
export const hebrewTextDir = "rtl" as const;

export const hebrewTextAlign = (align?: CreativeTextAlign | null): CreativeTextAlign =>
  align === "center" || align === "left" ? align : "right";

export const overlayFlexJustify = (align?: CreativeTextAlign | null): CSSProperties["justifyContent"] => {
  const resolved = hebrewTextAlign(align);
  if (resolved === "center") return "center";
  if (resolved === "left") return "flex-start";
  return "flex-end";
};

export const hebrewTextStyle = (align?: CreativeTextAlign | null): CSSProperties => ({
  direction: "rtl",
  unicodeBidi: "isolate",
  textAlign: hebrewTextAlign(align),
});

export const overlayBoxStyle = (align?: CreativeTextAlign | null): CSSProperties => ({
  direction: "ltr",
  justifyContent: overlayFlexJustify(align),
  textAlign: hebrewTextAlign(align),
});
