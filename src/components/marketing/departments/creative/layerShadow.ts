import type { CreativeLayer, LayerShadowStyle } from "./types";

export interface LayerShadow {
  shadowStyle: LayerShadowStyle;
  shadowDepth: number;
  shadowColor: string;
  shadowBlur: number;
}

const DEFAULT_COLOR = "#0f172a";

export const buildLayerTextShadow = ({
  shadowStyle = "none",
  shadowDepth = 6,
  shadowColor = DEFAULT_COLOR,
  shadowBlur = 12,
}: Partial<LayerShadow>): string | undefined => {
  if (shadowStyle === "none") return undefined;
  const depth = Math.max(0, Math.round(shadowDepth));
  const blur = Math.max(0, Math.round(shadowBlur));
  const color = shadowColor || DEFAULT_COLOR;
  if (shadowStyle === "soft") {
    return `0 ${Math.max(1, Math.round(depth / 2))}px ${blur}px ${color}`;
  }
  if (shadowStyle === "halo") {
    const ring = Math.max(1, Math.round(depth / 4));
    return [
      `${-ring}px 0 0 ${color}`,
      `${ring}px 0 0 ${color}`,
      `0 ${-ring}px 0 ${color}`,
      `0 ${ring}px 0 ${color}`,
      `0 0 ${blur}px ${color}`,
      `0 0 ${Math.round(blur * 1.6)}px ${color}99`,
    ].join(", ");
  }
  const steps = Array.from({ length: Math.max(1, depth) }, (_, index) => {
    const offset = index + 1;
    return `${offset}px ${offset}px 0 ${color}`;
  });
  steps.unshift("0 1px 0 rgba(255,255,255,0.35)");
  steps.push(`${depth + 4}px ${depth + 10}px ${Math.max(blur, 12)}px rgba(15,23,42,0.38)`);
  return steps.join(", ");
};

export const withLayerShadow = (shadow: Partial<LayerShadow>): Pick<CreativeLayer, "shadowStyle" | "shadowDepth" | "shadowColor" | "shadowBlur" | "textShadow"> => {
  const next: LayerShadow = {
    shadowStyle: shadow.shadowStyle ?? "none",
    shadowDepth: shadow.shadowDepth ?? 0,
    shadowColor: shadow.shadowColor ?? DEFAULT_COLOR,
    shadowBlur: shadow.shadowBlur ?? 12,
  };
  return { ...next, textShadow: buildLayerTextShadow(next) };
};

const hexFromCssColor = (value: string) => {
  const hex = value.match(/#([0-9a-fA-F]{3,8})/);
  if (hex) {
    const raw = hex[1];
    if (raw.length === 3) return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
    if (raw.length === 8) return `#${raw.slice(0, 6)}`;
    if (raw.length === 6) return `#${raw}`;
  }
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!rgb) return DEFAULT_COLOR;
  const toHex = (part: string) => Number(part).toString(16).padStart(2, "0");
  return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
};

export const inferLayerShadow = (layer: CreativeLayer): LayerShadow => {
  if (layer.shadowStyle) {
    return {
      shadowStyle: layer.shadowStyle,
      shadowDepth: layer.shadowDepth ?? 6,
      shadowColor: layer.shadowColor ?? DEFAULT_COLOR,
      shadowBlur: layer.shadowBlur ?? 12,
    };
  }
  const css = layer.textShadow ?? "";
  if (!css) return { shadowStyle: "none", shadowDepth: 0, shadowColor: DEFAULT_COLOR, shadowBlur: 8 };
  if (/-1px 0 0|-?\d+px 0 0/.test(css) && /0 0 \d+px/.test(css) && (css.match(/0 0 \d+px/g)?.length ?? 0) >= 1 && css.includes("-")) {
    return {
      shadowStyle: "halo",
      shadowDepth: layer.shadowDepth ?? 4,
      shadowColor: hexFromCssColor(css),
      shadowBlur: layer.shadowBlur ?? 16,
    };
  }
  const extrudeHits = css.match(/\d+px\s+\d+px\s+0\s+/g);
  if (extrudeHits && extrudeHits.length >= 3) {
    return {
      shadowStyle: "extrude",
      shadowDepth: extrudeHits.length,
      shadowColor: hexFromCssColor(css),
      shadowBlur: 16,
    };
  }
  const soft = css.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+(.+)$/);
  return {
    shadowStyle: "soft",
    shadowDepth: soft ? Math.max(1, Number(soft[2]) * 2) : 4,
    shadowColor: hexFromCssColor(css),
    shadowBlur: soft ? Number(soft[3]) : 14,
  };
};
