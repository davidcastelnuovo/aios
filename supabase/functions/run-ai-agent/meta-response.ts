import { isObject } from "./json-config.ts";

export interface MetaAction {
  action_type?: string | null;
  value?: string | number | null;
}

interface MetaQuestion {
  key?: string | null;
  label?: string | null;
  type?: string | null;
}

type MetaNodeFields = {
  id?: string;
  name?: string;
  account_id?: string;
  account_status?: number;
  status?: string;
  effective_status?: string;
  objective?: string;
  campaign_id?: string;
  campaign_name?: string;
  ad_id?: string;
  ad_name?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  access_token?: string;
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  frequency?: string | number;
  reach?: string | number;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  questions?: MetaQuestion[];
};

export type MetaNode = {
  [Key in keyof MetaNodeFields]: MetaNodeFields[Key] | null;
};

interface MetaResponse extends MetaNode {
  data?: MetaNode[] | null;
  error?: {
    message?: string | null;
    code?: number | null;
    type?: string | null;
  } | null;
  paging?: { next?: string | null } | null;
}

function hasOptionalFields(
  value: object,
  keys: readonly string[],
  allowed: readonly string[],
): boolean {
  return keys.every(
    (key) =>
      !(key in value) ||
      Reflect.get(value, key) == null ||
      allowed.includes(typeof Reflect.get(value, key)),
  );
}

export function isMetaNode(value: unknown): value is MetaNode {
  if (!isObject(value)) return false;
  if (
    !hasOptionalFields(
      value,
      [
        "id",
        "name",
        "account_id",
        "status",
        "effective_status",
        "objective",
        "campaign_id",
        "campaign_name",
        "ad_id",
        "ad_name",
        "daily_budget",
        "lifetime_budget",
        "access_token",
      ],
      ["string"],
    )
  )
    return false;
  if (!hasOptionalFields(value, ["account_status"], ["number"])) return false;
  if (
    !hasOptionalFields(
      value,
      [
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "cpc",
        "cpm",
        "frequency",
        "reach",
      ],
      ["string", "number"],
    )
  )
    return false;
  for (const key of ["actions", "cost_per_action_type", "questions"] as const) {
    if (!(key in value) || Reflect.get(value, key) == null) continue;
    const entries: unknown = Reflect.get(value, key);
    if (
      !Array.isArray(entries) ||
      !entries.every(
        (entry: unknown) =>
          isObject(entry) &&
          (key === "questions"
            ? hasOptionalFields(entry, ["key", "label", "type"], ["string"])
            : hasOptionalFields(entry, ["action_type"], ["string"]) &&
              hasOptionalFields(entry, ["value"], ["string", "number"])),
      )
    )
      return false;
  }
  return true;
}

/** Validate the Graph envelope once; keep extra provider fields for metric spreads. */
export async function readMetaResponse(
  response: Response,
): Promise<MetaResponse> {
  const value: unknown = await response.json();
  if (!isMetaNode(value)) throw new Error("Invalid Meta response");
  if (
    "data" in value &&
    value.data != null &&
    (!Array.isArray(value.data) || !value.data.every(isMetaNode))
  )
    throw new Error("Invalid Meta response data");
  if (
    "error" in value &&
    value.error != null &&
    (!isObject(value.error) ||
      !hasOptionalFields(value.error, ["message", "type"], ["string"]) ||
      !hasOptionalFields(value.error, ["code"], ["number"]))
  )
    throw new Error("Invalid Meta response error");
  if (
    "paging" in value &&
    value.paging != null &&
    (!isObject(value.paging) ||
      !hasOptionalFields(value.paging, ["next"], ["string"]))
  )
    throw new Error("Invalid Meta response paging");
  return value;
}
