import assert from "node:assert/strict";
import test from "node:test";

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

test("callback token is stable for the same session triple", async () => {
  const canon = (s: string, c: string, t: string) => `v1:${s}:${c}:${t}`;
  const a = await hmacSha256Hex("secret", canon("s1", "c1", "t1"));
  const b = await hmacSha256Hex("secret", canon("s1", "c1", "t1"));
  assert.equal(a, b);
  assert.equal(timingSafeEqual(a, b), true);
});

test("callback token rejects a different conversation", async () => {
  const a = await hmacSha256Hex("secret", "v1:s1:c1:t1");
  const b = await hmacSha256Hex("secret", "v1:s1:c2:t1");
  assert.equal(timingSafeEqual(a, b), false);
});
