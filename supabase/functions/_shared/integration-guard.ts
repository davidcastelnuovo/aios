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
  const destination = input.destination || "";
  const isGroup = destination.startsWith("group:") || destination.includes("@g.us");

  if (integration === "whatsapp" || integration === "email") {
    if (isGroup) {
      return {
        decision: "BLOCK",
        reason: "staging_safe_mode_blocks_groups",
        environment,
      };
    }
    const allowlist = parseAllowlist(input.allowlistRaw);
    const destDigits = digits(destination);
    const allowed = allowlist.some(
      (item) => destDigits === item || destDigits.endsWith(item.slice(-9)) || item.endsWith(destDigits.slice(-9)),
    );
    if (allowed) {
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
