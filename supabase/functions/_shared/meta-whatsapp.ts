export const DEFAULT_META_GRAPH_VERSION = "v25.0";

export type MetaWhatsAppSessionInfo = {
  waba_id?: string;
  waba_ids?: string[];
  phone_number_id?: string;
  business_id?: string;
};

export type MetaWhatsAppMessage = Record<string, any> & {
  id?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  type?: string;
};

export function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizedPhoneCandidates(value: unknown): string[] {
  const digits = digitsOnly(value).replace(/^00/, "");
  if (!digits) return [];
  const candidates = new Set([digits]);
  if (digits.startsWith("972")) candidates.add(`0${digits.slice(3)}`);
  if (digits.startsWith("0")) candidates.add(`972${digits.slice(1)}`);
  if (digits.length >= 9) candidates.add(digits.slice(-9));
  return [...candidates].filter(Boolean);
}

export function messageText(message: MetaWhatsAppMessage): string {
  const type = String(message.type ?? "unknown");
  if (type === "text") return String(message.text?.body ?? "");
  if (type === "button") return String(message.button?.text ?? "");
  if (type === "interactive") {
    return String(
      message.interactive?.button_reply?.title ??
        message.interactive?.list_reply?.title ??
        "[הודעה אינטראקטיבית]",
    );
  }
  const caption = message[type]?.caption;
  if (caption) return String(caption);
  const labels: Record<string, string> = {
    audio: "[הודעת קול]",
    image: "[תמונה]",
    video: "[וידאו]",
    document: "[מסמך]",
    sticker: "[מדבקה]",
    location: "[מיקום]",
    contacts: "[איש קשר]",
    reaction: "[תגובה]",
    media_placeholder: "[מדיה מהיסטוריית WhatsApp]",
  };
  return labels[type] ?? `[הודעת WhatsApp מסוג ${type}]`;
}

export function collectWebhookMessages(value: Record<string, any>, field: string) {
  const businessPhone = digitsOnly(value.metadata?.display_phone_number);
  const messages: Array<{
    message: MetaWhatsAppMessage;
    direction: "inbound" | "outbound";
    peerPhone: string;
    source: "live" | "echo" | "history";
  }> = [];

  for (const message of value.messages ?? []) {
    const from = digitsOnly(message.from);
    const historyOutbound = field === "history" && Boolean(businessPhone && from === businessPhone);
    messages.push({
      message,
      direction: historyOutbound ? "outbound" : "inbound",
      peerPhone: historyOutbound ? digitsOnly(message.to) : from,
      source: field === "history" ? "history" : "live",
    });
  }

  for (const message of value.message_echoes ?? []) {
    messages.push({
      message,
      direction: "outbound",
      peerPhone: digitsOnly(message.to),
      source: "echo",
    });
  }

  for (const chunk of value.history ?? []) {
    for (const thread of chunk.threads ?? []) {
      for (const message of thread.messages ?? []) {
        const from = digitsOnly(message.from);
        const outbound = Boolean(businessPhone && from === businessPhone);
        messages.push({
          message,
          direction: outbound ? "outbound" : "inbound",
          peerPhone: outbound ? digitsOnly(message.to ?? thread.id) : from || digitsOnly(thread.id),
          source: "history",
        });
      }
    }
  }

  return messages.filter((item) => item.message.id && item.peerPhone);
}

export function isCoexistenceFinishEvent(event: unknown): boolean {
  return event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";
}
