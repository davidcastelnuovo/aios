import {
  BadgeCheck,
  ClipboardList,
  FileSearch,
  MessageCircle,
  Phone,
  Search,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { CreativeLayer, CreativeLayerRole } from "./types";
import { OFFER_ICON_NAMES, type OfferIconName } from "./offerBoard";

const ICONS: Record<OfferIconName, LucideIcon> = {
  search: Search,
  "file-search": FileSearch,
  "clipboard-list": ClipboardList,
  shield: Shield,
  sparkles: Sparkles,
  "message-circle": MessageCircle,
  phone: Phone,
  "badge-check": BadgeCheck,
};

export const LAYER_ROLE_LABEL: Record<CreativeLayerRole, string> = {
  logo: "לוגו",
  hero: "גיבור",
  type_field: "שדה טקסט",
  headline: "כותרת",
  sub: "משנה",
  bullet: "בולט",
  icon: "אייקון",
  icon_label: "תווית אייקון",
  footer: "פוטר",
  cta: "כפתור",
  cta_fill: "רקע כפתור",
  divider: "מפריד",
};

export const layerLabel = (layer: CreativeLayer, index: number): string => {
  if (layer.role && LAYER_ROLE_LABEL[layer.role]) return LAYER_ROLE_LABEL[layer.role];
  if (layer.type === "image") return "לוגו";
  if (layer.type === "shape") return `פלטה ${index + 1}`;
  return `טקסט ${index + 1}`;
};

export const OfferIconMark = ({
  name,
  color,
  className,
}: {
  name?: string;
  color?: string;
  className?: string;
}) => {
  const key = (OFFER_ICON_NAMES as readonly string[]).includes(name ?? "")
    ? (name as OfferIconName)
    : "badge-check";
  const Icon = ICONS[key];
  return <Icon className={className} style={{ color: color ?? "#dc2626" }} strokeWidth={2.2} />;
};

export const isIconLayer = (layer: CreativeLayer): boolean =>
  layer.role === "icon" || !!layer.icon;
