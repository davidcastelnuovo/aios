/**
 * nodeIcons.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Central registry of icons / brand images for every automation step type.
 * Returns { icon, color, bgColor, brandImage? } per action_type.
 *
 * brandImage: a URL or inline SVG component for brand logos (WhatsApp, Facebook, etc.)
 * icon: a Lucide icon component (fallback / overlay)
 */

import React from "react";
import {
  UserPlus,
  UserCog,
  ArrowRightLeft,
  StickyNote,
  UserX,
  Building2,
  CheckSquare,
  RefreshCw,
  CheckCircle2,
  UserCheck,
  AlertTriangle,
  CalendarPlus,
  CalendarCog,
  CalendarX,
  Clock,
  CalendarClock,
  Calendar,
  Globe,
  CreditCard,
  Unplug,
  ShieldAlert,
  Terminal,
  Mail,
  Bell,
  MessageSquarePlus,
  Webhook,
  Play,
  GitBranch,
  Timer,
  Bot,
  MessageSquare,
  GitMerge,
  RotateCcw,
  Code2,
  SplitSquareHorizontal,
  Zap,
  LucideIcon,
} from "lucide-react";

// ─── Brand SVG components ────────────────────────────────────────────────────

export const WhatsAppIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
      fill="#25D366"
    />
    <path
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
      fill="white"
    />
  </svg>
);

export const TelegramIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#2CA5E0" />
    <path
      d="M17.707 7.293l-2.828 9.9c-.2.7-.8.9-1.3.5l-3-2.3-1.4 1.4c-.2.2-.4.3-.7.3l.3-3.4 6.5-5.9c.3-.3-.1-.4-.4-.2l-8 5-3-1c-.7-.2-.7-.7.1-1l11.7-4.5c.6-.2 1.1.1.9.9z"
      fill="white"
    />
  </svg>
);

export const FacebookIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#1877F2" />
    <path
      d="M15.5 8H13.5C13.2 8 13 8.2 13 8.5V10H15.5L15.2 12.5H13V19H10.5V12.5H9V10H10.5V8.5C10.5 6.6 11.6 5.5 13.5 5.5H15.5V8Z"
      fill="white"
    />
  </svg>
);

export const InstagramIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)" />
    <rect x="7" y="7" width="10" height="10" rx="3" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="12" cy="12" r="2.5" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="16.5" cy="7.5" r="1" fill="white" />
  </svg>
);

export const GmailIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="white" stroke="#E0E0E0" strokeWidth="0.5"/>
    <path d="M2 6L12 13L22 6" stroke="#EA4335" strokeWidth="2" fill="none"/>
    <path d="M2 6V18L8 12L2 6Z" fill="#34A853"/>
    <path d="M22 6V18L16 12L22 6Z" fill="#FBBC04"/>
    <path d="M8 12L2 18H22L16 12L12 15L8 12Z" fill="#4285F4"/>
  </svg>
);

export const GoogleSheetsIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="2" width="14" height="18" rx="2" fill="#0F9D58" />
    <rect x="10" y="2" width="7" height="5" rx="0" fill="#0B8043" />
    <path d="M10 2L17 7H10V2Z" fill="#87CEAC" />
    <rect x="5" y="9" width="10" height="1.5" rx="0.5" fill="white" fillOpacity="0.8" />
    <rect x="5" y="12" width="10" height="1.5" rx="0.5" fill="white" fillOpacity="0.8" />
    <rect x="5" y="15" width="7" height="1.5" rx="0.5" fill="white" fillOpacity="0.8" />
    <rect x="8" y="9" width="0.5" height="9" fill="white" fillOpacity="0.4" />
  </svg>
);

export const GoogleCalendarIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="20" height="18" rx="2" fill="white" stroke="#E0E0E0" strokeWidth="0.5"/>
    <rect x="2" y="4" width="20" height="5" rx="2" fill="#4285F4" />
    <rect x="2" y="7" width="20" height="2" fill="#4285F4" />
    <rect x="7" y="2" width="2" height="4" rx="1" fill="#4285F4" />
    <rect x="15" y="2" width="2" height="4" rx="1" fill="#4285F4" />
    <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#EA4335">
      {new Date().getDate()}
    </text>
  </svg>
);

export const GoogleFormsIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="2" width="12" height="18" rx="2" fill="#673AB7" />
    <rect x="11" y="2" width="5" height="4" rx="0" fill="#512DA8" />
    <path d="M11 2L16 6H11V2Z" fill="#9C6FD6" />
    <rect x="6" y="9" width="8" height="1" rx="0.5" fill="white" fillOpacity="0.8" />
    <rect x="6" y="12" width="8" height="1" rx="0.5" fill="white" fillOpacity="0.8" />
    <rect x="6" y="15" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.8" />
    <circle cx="6.5" cy="9.5" r="0.5" fill="white" />
    <circle cx="6.5" cy="12.5" r="0.5" fill="white" />
    <circle cx="6.5" cy="15.5" r="0.5" fill="white" />
  </svg>
);

export const StripeIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="4" fill="#635BFF" />
    <path
      d="M11.5 9.5C11.5 8.7 12.1 8.3 13 8.3C14.2 8.3 15.5 8.8 16.5 9.5V6.8C15.4 6.3 14.2 6 13 6C10.5 6 8.8 7.3 8.8 9.7C8.8 13.5 14 12.9 14 14.6C14 15.5 13.3 15.9 12.3 15.9C11 15.9 9.5 15.3 8.5 14.5V17.2C9.6 17.7 10.9 18 12.3 18C14.9 18 16.7 16.8 16.7 14.3C16.7 10.3 11.5 11 11.5 9.5Z"
      fill="white"
    />
  </svg>
);

export const CarmenIcon = ({ size = 20, src }: { size?: number; src?: string }) => {
  const defaultSrc = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-icon-CyF3DNNJ8Z9Uhfz7EpYJcQ.webp";
  return (
    <img
      src={src || defaultSrc}
      alt="כרמן"
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
};

// ─── Icon config type ─────────────────────────────────────────────────────────

export interface NodeIconConfig {
  /** Lucide icon component (used as fallback or overlay) */
  icon: LucideIcon;
  /** Primary color (text/stroke) */
  color: string;
  /** Background color (light tint) */
  bgColor: string;
  /** Border color */
  borderColor: string;
  /** Optional brand image component */
  BrandIcon?: React.FC<{ size?: number }>;
  /** Category for grouping */
  category: "trigger_lead" | "trigger_client" | "trigger_task" | "trigger_meeting" | "trigger_message" | "trigger_google" | "trigger_schedule" | "trigger_integration" | "trigger_chat" | "action_message" | "action_crm" | "action_system" | "flow_logic";
}

// ─── Master icon registry ─────────────────────────────────────────────────────

export const NODE_ICON_MAP: Record<string, NodeIconConfig> = {
  // ── Triggers: Leads ──────────────────────────────────────────────────────
  lead_created: {
    icon: UserPlus,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    category: "trigger_lead",
  },
  lead_updated: {
    icon: UserCog,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "trigger_lead",
  },
  lead_status_changed: {
    icon: ArrowRightLeft,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "trigger_lead",
  },
  lead_note_added: {
    icon: StickyNote,
    color: "#ca8a04",
    bgColor: "rgba(202,138,4,0.12)",
    borderColor: "rgba(202,138,4,0.35)",
    category: "trigger_lead",
  },
  lead_inactive_days: {
    icon: UserX,
    color: "#64748b",
    bgColor: "rgba(100,116,139,0.12)",
    borderColor: "rgba(100,116,139,0.35)",
    category: "trigger_lead",
  },

  // ── Triggers: Clients ────────────────────────────────────────────────────
  client_created: {
    icon: Building2,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    category: "trigger_client",
  },
  client_status_changed: {
    icon: ArrowRightLeft,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "trigger_client",
  },
  client_note_added: {
    icon: StickyNote,
    color: "#ca8a04",
    bgColor: "rgba(202,138,4,0.12)",
    borderColor: "rgba(202,138,4,0.35)",
    category: "trigger_client",
  },
  onboarding_status_changed: {
    icon: UserCheck,
    color: "#7c3aed",
    bgColor: "rgba(124,58,237,0.12)",
    borderColor: "rgba(124,58,237,0.35)",
    category: "trigger_client",
  },

  // ── Triggers: Tasks ──────────────────────────────────────────────────────
  task_created: {
    icon: CheckSquare,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "trigger_task",
  },
  task_status_changed: {
    icon: RefreshCw,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "trigger_task",
  },
  task_completed: {
    icon: CheckCircle2,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    category: "trigger_task",
  },
  task_assigned: {
    icon: UserCheck,
    color: "#7c3aed",
    bgColor: "rgba(124,58,237,0.12)",
    borderColor: "rgba(124,58,237,0.35)",
    category: "trigger_task",
  },
  task_overdue: {
    icon: AlertTriangle,
    color: "#dc2626",
    bgColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.35)",
    category: "trigger_task",
  },
  task_calendar_created: {
    icon: CalendarPlus,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "trigger_task",
  },

  // ── Triggers: Meetings ───────────────────────────────────────────────────
  meeting_created: {
    icon: CalendarPlus,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "trigger_meeting",
  },
  meeting_updated: {
    icon: CalendarCog,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "trigger_meeting",
  },
  meeting_cancelled: {
    icon: CalendarX,
    color: "#dc2626",
    bgColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.35)",
    category: "trigger_meeting",
  },
  meeting_day_after: {
    icon: Calendar,
    color: "#ca8a04",
    bgColor: "rgba(202,138,4,0.12)",
    borderColor: "rgba(202,138,4,0.35)",
    category: "trigger_meeting",
  },
  meeting_same_day: {
    icon: Calendar,
    color: "#ca8a04",
    bgColor: "rgba(202,138,4,0.12)",
    borderColor: "rgba(202,138,4,0.35)",
    category: "trigger_meeting",
  },

  // ── Triggers: Messages ───────────────────────────────────────────────────
  whatsapp_message_received: {
    icon: MessageSquare,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    BrandIcon: WhatsAppIcon,
    category: "trigger_message",
  },
  carmen_whatsapp_session: {
    icon: Bot,
    color: "#7c3aed",
    bgColor: "rgba(124,58,237,0.12)",
    borderColor: "rgba(124,58,237,0.35)",
    BrandIcon: CarmenIcon,
    category: "trigger_message",
  },
  telegram_message_received: {
    icon: MessageSquare,
    color: "#2CA5E0",
    bgColor: "rgba(44,165,224,0.12)",
    borderColor: "rgba(44,165,224,0.35)",
    BrandIcon: TelegramIcon,
    category: "trigger_message",
  },
  email_received: {
    icon: Mail,
    color: "#dc2626",
    bgColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.35)",
    BrandIcon: GmailIcon,
    category: "trigger_message",
  },

  // ── Triggers: Google Workspace ───────────────────────────────────────────
  google_sheet_new_row: {
    icon: CheckSquare,
    color: "#0F9D58",
    bgColor: "rgba(15,157,88,0.12)",
    borderColor: "rgba(15,157,88,0.35)",
    BrandIcon: GoogleSheetsIcon,
    category: "trigger_google",
  },
  google_sheet_row_updated: {
    icon: RefreshCw,
    color: "#0F9D58",
    bgColor: "rgba(15,157,88,0.12)",
    borderColor: "rgba(15,157,88,0.35)",
    BrandIcon: GoogleSheetsIcon,
    category: "trigger_google",
  },
  google_calendar_event_created: {
    icon: CalendarPlus,
    color: "#4285F4",
    bgColor: "rgba(66,133,244,0.12)",
    borderColor: "rgba(66,133,244,0.35)",
    BrandIcon: GoogleCalendarIcon,
    category: "trigger_google",
  },
  google_form_submitted: {
    icon: CheckSquare,
    color: "#673AB7",
    bgColor: "rgba(103,58,183,0.12)",
    borderColor: "rgba(103,58,183,0.35)",
    BrandIcon: GoogleFormsIcon,
    category: "trigger_google",
  },

  // ── Triggers: Schedule ───────────────────────────────────────────────────
  scheduled_daily: {
    icon: Clock,
    color: "#ea580c",
    bgColor: "rgba(234,88,12,0.12)",
    borderColor: "rgba(234,88,12,0.35)",
    category: "trigger_schedule",
  },
  scheduled_weekly: {
    icon: CalendarClock,
    color: "#ea580c",
    bgColor: "rgba(234,88,12,0.12)",
    borderColor: "rgba(234,88,12,0.35)",
    category: "trigger_schedule",
  },
  scheduled_monthly: {
    icon: Calendar,
    color: "#ea580c",
    bgColor: "rgba(234,88,12,0.12)",
    borderColor: "rgba(234,88,12,0.35)",
    category: "trigger_schedule",
  },

  // ── Triggers: Integrations ───────────────────────────────────────────────
  facebook_lead_form: {
    icon: UserPlus,
    color: "#1877F2",
    bgColor: "rgba(24,119,242,0.12)",
    borderColor: "rgba(24,119,242,0.35)",
    BrandIcon: FacebookIcon,
    category: "trigger_integration",
  },
  instagram_message: {
    icon: MessageSquare,
    color: "#d6249f",
    bgColor: "rgba(214,36,159,0.12)",
    borderColor: "rgba(214,36,159,0.35)",
    BrandIcon: InstagramIcon,
    category: "trigger_integration",
  },
  inbound_webhook_task: {
    icon: Webhook,
    color: "#64748b",
    bgColor: "rgba(100,116,139,0.12)",
    borderColor: "rgba(100,116,139,0.35)",
    category: "trigger_integration",
  },
  inbound_webhook_lead: {
    icon: Webhook,
    color: "#64748b",
    bgColor: "rgba(100,116,139,0.12)",
    borderColor: "rgba(100,116,139,0.35)",
    category: "trigger_integration",
  },
  stripe_payment: {
    icon: CreditCard,
    color: "#635BFF",
    bgColor: "rgba(99,91,255,0.12)",
    borderColor: "rgba(99,91,255,0.35)",
    BrandIcon: StripeIcon,
    category: "trigger_integration",
  },
  integration_disconnected: {
    icon: Unplug,
    color: "#dc2626",
    bgColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.35)",
    category: "trigger_integration",
  },
  ad_account_blocked: {
    icon: ShieldAlert,
    color: "#dc2626",
    bgColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.35)",
    BrandIcon: FacebookIcon,
    category: "trigger_integration",
  },
  account_stopped_spending: {
    icon: ShieldAlert,
    color: "#dc2626",
    bgColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.35)",
    BrandIcon: FacebookIcon,
    category: "trigger_integration",
  },
  ad_account_billing_issue: {
    icon: CreditCard,
    color: "#dc2626",
    bgColor: "rgba(220,38,38,0.12)",
    borderColor: "rgba(220,38,38,0.35)",
    BrandIcon: FacebookIcon,
    category: "trigger_integration",
  },

  // ── Triggers: Chat ───────────────────────────────────────────────────────
  manual_command: {
    icon: Terminal,
    color: "#64748b",
    bgColor: "rgba(100,116,139,0.12)",
    borderColor: "rgba(100,116,139,0.35)",
    category: "trigger_chat",
  },

  // ── Actions: Messages ────────────────────────────────────────────────────
  send_whatsapp: {
    icon: MessageSquare,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    BrandIcon: WhatsAppIcon,
    category: "action_message",
  },
  send_greenapi_message: {
    icon: MessageSquare,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    BrandIcon: WhatsAppIcon,
    category: "action_message",
  },
  send_manus_message: {
    icon: MessageSquare,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    BrandIcon: WhatsAppIcon,
    category: "action_message",
  },
  send_greenapi_to_campaigner: {
    icon: MessageSquare,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    BrandIcon: WhatsAppIcon,
    category: "action_message",
  },
  send_telegram: {
    icon: MessageSquare,
    color: "#2CA5E0",
    bgColor: "rgba(44,165,224,0.12)",
    borderColor: "rgba(44,165,224,0.35)",
    BrandIcon: TelegramIcon,
    category: "action_message",
  },
  email: {
    icon: Mail,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "action_message",
  },
  notification: {
    icon: Bell,
    color: "#ca8a04",
    bgColor: "rgba(202,138,4,0.12)",
    borderColor: "rgba(202,138,4,0.35)",
    category: "action_message",
  },

  // ── Actions: CRM ─────────────────────────────────────────────────────────
  create_task: {
    icon: CheckSquare,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "action_crm",
  },
  add_lead_update: {
    icon: MessageSquarePlus,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    category: "action_crm",
  },
  add_client_update: {
    icon: MessageSquarePlus,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "action_crm",
  },
  create_manychat_subscriber: {
    icon: UserPlus,
    color: "#ca8a04",
    bgColor: "rgba(202,138,4,0.12)",
    borderColor: "rgba(202,138,4,0.35)",
    category: "action_crm",
  },
  update_status: {
    icon: RefreshCw,
    color: "#2563eb",
    bgColor: "rgba(37,99,235,0.12)",
    borderColor: "rgba(37,99,235,0.35)",
    category: "action_crm",
  },
  create_lead: {
    icon: UserPlus,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    category: "action_crm",
  },

  // ── Actions: System ──────────────────────────────────────────────────────
  webhook: {
    icon: Globe,
    color: "#64748b",
    bgColor: "rgba(100,116,139,0.12)",
    borderColor: "rgba(100,116,139,0.35)",
    category: "action_system",
  },
  agent: {
    icon: Bot,
    color: "#ea580c",
    bgColor: "rgba(234,88,12,0.12)",
    borderColor: "rgba(234,88,12,0.35)",
    BrandIcon: CarmenIcon,
    category: "action_system",
  },

  // ── Flow Logic (step_type based) ─────────────────────────────────────────
  trigger: {
    icon: Zap,
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.35)",
    category: "flow_logic",
  },
  action: {
    icon: Play,
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.12)",
    borderColor: "rgba(59,130,246,0.35)",
    category: "flow_logic",
  },
  condition: {
    icon: GitBranch,
    color: "#a855f7",
    bgColor: "rgba(168,85,247,0.12)",
    borderColor: "rgba(168,85,247,0.35)",
    category: "flow_logic",
  },
  switch: {
    icon: SplitSquareHorizontal,
    color: "#6366f1",
    bgColor: "rgba(99,102,241,0.12)",
    borderColor: "rgba(99,102,241,0.35)",
    category: "flow_logic",
  },
  delay: {
    icon: Timer,
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.12)",
    borderColor: "rgba(16,185,129,0.35)",
    category: "flow_logic",
  },
  merge: {
    icon: GitMerge,
    color: "#14b8a6",
    bgColor: "rgba(20,184,166,0.12)",
    borderColor: "rgba(20,184,166,0.35)",
    category: "flow_logic",
  },
  loop: {
    icon: RotateCcw,
    color: "#06b6d4",
    bgColor: "rgba(6,182,212,0.12)",
    borderColor: "rgba(6,182,212,0.35)",
    category: "flow_logic",
  },
  code: {
    icon: Code2,
    color: "#64748b",
    bgColor: "rgba(100,116,139,0.12)",
    borderColor: "rgba(100,116,139,0.35)",
    category: "flow_logic",
  },
  error_branch: {
    icon: AlertTriangle,
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.35)",
    category: "flow_logic",
  },
  whatsapp_session: {
    icon: MessageSquare,
    color: "#16a34a",
    bgColor: "rgba(22,163,74,0.12)",
    borderColor: "rgba(22,163,74,0.35)",
    BrandIcon: WhatsAppIcon,
    category: "flow_logic",
  },
};

/**
 * Get icon config for a node.
 * Priority: action_type → step_type → default
 */
export function getNodeIconConfig(
  stepType: string,
  actionType?: string | null
): NodeIconConfig {
  if (actionType && NODE_ICON_MAP[actionType]) {
    return NODE_ICON_MAP[actionType];
  }
  if (stepType && NODE_ICON_MAP[stepType]) {
    return NODE_ICON_MAP[stepType];
  }
  // Default fallback
  return {
    icon: Zap,
    color: "#64748b",
    bgColor: "rgba(100,116,139,0.12)",
    borderColor: "rgba(100,116,139,0.35)",
    category: "flow_logic",
  };
}

/**
 * Renders the icon for a node — brand image if available, otherwise Lucide icon.
 * For agent nodes with a Carmen image URL, renders the image.
 */
export function NodeIconDisplay({
  stepType,
  actionType,
  size = 20,
  carmenImageUrl,
  className = "",
}: {
  stepType: string;
  actionType?: string | null;
  size?: number;
  carmenImageUrl?: string;
  className?: string;
}) {
  const config = getNodeIconConfig(stepType, actionType);
  const Icon = config.icon;

  // Agent with Carmen image
  if ((actionType === "agent" || stepType === "agent") && carmenImageUrl) {
    return (
      <img
        src={carmenImageUrl}
        alt="כרמן"
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Brand icon
  if (config.BrandIcon) {
    const BrandIcon = config.BrandIcon;
    return <BrandIcon size={size} />;
  }

  // Lucide icon
  return <Icon size={size} style={{ color: config.color }} className={className} />;
}
