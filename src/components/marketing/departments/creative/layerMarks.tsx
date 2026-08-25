import {
  Award,
  BadgeCheck,
  Building2,
  Calendar,
  Camera,
  CircleCheck,
  ClipboardList,
  Clock,
  CreditCard,
  FileSearch,
  Gift,
  Globe,
  Headphones,
  Heart,
  Home,
  Lightbulb,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Play,
  Quote,
  Rocket,
  Search,
  Send,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Trophy,
  Users,
  WandSparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CreativeLayer, CreativeLayerRole } from "./types";
import { CREATIVE_ICON_IDS, type CreativeIconId } from "./iconLibrary";

const ICONS: Record<CreativeIconId, LucideIcon> = {
  search: Search,
  "file-search": FileSearch,
  "clipboard-list": ClipboardList,
  shield: Shield,
  sparkles: Sparkles,
  "message-circle": MessageCircle,
  phone: Phone,
  "badge-check": BadgeCheck,
  mail: Mail,
  send: Send,
  calendar: Calendar,
  clock: Clock,
  "map-pin": MapPin,
  globe: Globe,
  users: Users,
  heart: Heart,
  star: Star,
  zap: Zap,
  target: Target,
  megaphone: Megaphone,
  gift: Gift,
  "shopping-bag": ShoppingBag,
  "credit-card": CreditCard,
  home: Home,
  "building-2": Building2,
  camera: Camera,
  play: Play,
  award: Award,
  trophy: Trophy,
  rocket: Rocket,
  lightbulb: Lightbulb,
  quote: Quote,
  headphones: Headphones,
  "thumbs-up": ThumbsUp,
  "circle-check": CircleCheck,
  "wand-sparkles": WandSparkles,
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
  if (layer.icon) return "אייקון";
  if (layer.type === "shape") return `צורה ${index + 1}`;
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
  const key = (CREATIVE_ICON_IDS as readonly string[]).includes(name ?? "")
    ? (name as CreativeIconId)
    : "badge-check";
  const Icon = ICONS[key];
  return <Icon className={className} style={{ color: color ?? "#dc2626" }} strokeWidth={2.2} />;
};

export const isIconLayer = (layer: CreativeLayer): boolean =>
  layer.role === "icon" || !!layer.icon;
