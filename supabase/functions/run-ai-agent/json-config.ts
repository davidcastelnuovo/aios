import type { Json } from "../_shared/database.types.ts";

/** Narrow persisted JSON before reading configuration keys; retain unknown keys on writes. */
export function jsonObject(value: Json | undefined): {
  [key: string]: Json | undefined;
} {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
