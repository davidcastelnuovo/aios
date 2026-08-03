import type { EmailOption } from "@/components/clients/EmailRecipientsSelector";

/**
 * Default recipients pre-selected when sending a client report / dashboard
 * by email (DMM ops distribution list). Always offered as selectable options
 * even when the client has no email and client_team is empty.
 */
export const DEFAULT_REPORT_EMAIL_RECIPIENTS: EmailOption[] = [
  { email: "adamchik2301@gmail.com", label: "Anna Relin", icon: "👤" },
  { email: "david.castelnuovo@gmail.com", label: "David", icon: "👤" },
  { email: "dmm4business@gmail.com", label: "DMM", icon: "🏢" },
];

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Deduped default emails (+ optional client email) for initial selection. */
export function buildDefaultReportRecipientEmails(clientEmail?: string | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const opt of DEFAULT_REPORT_EMAIL_RECIPIENTS) {
    const email = normalizeEmail(opt.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  if (clientEmail) {
    const email = normalizeEmail(clientEmail);
    if (email && !seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}

/** Options list: client + defaults + team members (deduped by email). */
export function buildReportEmailOptions(args: {
  clientEmail?: string | null;
  clientName?: string | null;
  teamMembers?: Array<{
    role_on_account?: string | null;
    campaigners?: { full_name?: string | null; email?: string | null } | null;
  }> | null;
}): EmailOption[] {
  const seen = new Set<string>();
  const out: EmailOption[] = [];

  const push = (opt: EmailOption) => {
    const email = normalizeEmail(opt.email || "");
    if (!email || seen.has(email)) return;
    seen.add(email);
    out.push({ ...opt, email });
  };

  if (args.clientEmail) {
    push({
      email: args.clientEmail,
      label: `${args.clientName || "לקוח"} (לקוח)`,
      icon: "📋",
    });
  }
  for (const opt of DEFAULT_REPORT_EMAIL_RECIPIENTS) push(opt);
  for (const t of args.teamMembers || []) {
    push({
      email: t.campaigners?.email || "",
      label: `${t.campaigners?.full_name || "איש צוות"}${
        t.role_on_account ? ` (${t.role_on_account})` : ""
      }`,
      icon: "👤",
    });
  }
  return out;
}
