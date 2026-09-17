import { type AppEnv, resolveAppEnv } from "./app-env.ts";

export type GuardDecision = "ALLOW" | "BLOCK" | "DRY_RUN";

export type GuardResult = {
  decision: GuardDecision;
  reason: string;
  environment: AppEnv;
};

function digits(value: string | undefined | null): string {
  return (value || "").replace(/\D/g, "");
}

export function parseAllowlist(raw: string | undefined | null): string[] {
  return (raw || "")
    .split(/[\s,]+/)
    .map((item) => digits(item))
    .filter((item) => item.length >= 8);
}

export function parseEmailAllowlist(raw: string | undefined | null): string[] {
  return (raw || "")
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes("@") && !item.startsWith("@") && !item.endsWith("@"));
}

function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  const at = email.indexOf("@");
  return at > 0 && at < email.length - 1 && !email.includes(" ");
}

function phoneAllowed(destDigits: string, allowlist: string[]): boolean {
  if (destDigits.length < 8) return false;
  return allowlist.some((item) => {
    if (destDigits === item) return true;
    if (destDigits.length < 9 || item.length < 9) return false;
    const a = destDigits.slice(-9);
    const b = item.slice(-9);
    return a === b;
  });
}

export function isSafeModeEnabled(
  appEnv: AppEnv,
  stagingSafeMode: string | undefined | null,
): boolean {
  if (appEnv === "production") return false;
  const raw = (stagingSafeMode || "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

export function checkOutbound(input: {
  appEnv?: string | null;
  stagingSafeMode?: string | null;
  integration: string;
  action?: string;
  destination?: string | null;
  allowlistRaw?: string | null;
  emailAllowlistRaw?: string | null;
}): GuardResult {
  const environment = resolveAppEnv(input.appEnv);
  if (environment === "production") {
    return { decision: "ALLOW", reason: "production", environment };
  }

  const safeMode = isSafeModeEnabled(environment, input.stagingSafeMode);
  if (!safeMode) {
    return { decision: "ALLOW", reason: "safe_mode_off", environment };
  }

  const integration = (input.integration || "").toLowerCase();
  const destination = (input.destination || "").trim();
  const isGroup = destination.startsWith("group:") || destination.includes("@g.us");

  if (integration === "email") {
    if (!destination) {
      return { decision: "BLOCK", reason: "empty_destination", environment };
    }
    if (!isValidEmail(destination)) {
      return { decision: "BLOCK", reason: "invalid_email", environment };
    }
    const emails = parseEmailAllowlist(input.emailAllowlistRaw);
    if (emails.includes(destination.toLowerCase())) {
      return { decision: "ALLOW", reason: "allowlist_match", environment };
    }
    return {
      decision: "BLOCK",
      reason: emails.length ? "destination_not_allowlisted" : "empty_email_allowlist",
      environment,
    };
  }

  if (integration === "whatsapp") {
    if (isGroup) {
      return {
        decision: "BLOCK",
        reason: "staging_safe_mode_blocks_groups",
        environment,
      };
    }
    if (!destination) {
      return { decision: "BLOCK", reason: "empty_destination", environment };
    }
    const allowlist = parseAllowlist(input.allowlistRaw);
    const destDigits = digits(destination);
    if (destDigits.length < 8) {
      return { decision: "BLOCK", reason: "invalid_destination", environment };
    }
    if (phoneAllowed(destDigits, allowlist)) {
      return { decision: "ALLOW", reason: "allowlist_match", environment };
    }
    return {
      decision: "BLOCK",
      reason: allowlist.length ? "destination_not_allowlisted" : "empty_allowlist",
      environment,
    };
  }

  if (integration === "automation" || integration === "cron") {
    return { decision: "DRY_RUN", reason: "staging_default_dry_run", environment };
  }

  return { decision: "BLOCK", reason: "staging_safe_mode_default_block", environment };
}

export function checkWhatsAppSend(destination: string | null | undefined): GuardResult {
  return checkOutbound({
    appEnv: Deno.env.get("APP_ENV"),
    stagingSafeMode: Deno.env.get("STAGING_SAFE_MODE"),
    integration: "whatsapp",
    action: "send_message",
    destination,
    allowlistRaw: Deno.env.get("STAGING_ALLOWED_PHONE_NUMBERS"),
  });
}

export function checkEmailSend(destination: string | null | undefined): GuardResult {
  return checkOutbound({
    appEnv: Deno.env.get("APP_ENV"),
    stagingSafeMode: Deno.env.get("STAGING_SAFE_MODE"),
    integration: "email",
    action: "send_email",
    destination,
    emailAllowlistRaw: Deno.env.get("STAGING_ALLOWED_EMAILS"),
  });
}
