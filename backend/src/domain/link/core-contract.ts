import { createHash } from "node:crypto";

/** Canonical JSON shared with the native Agent; clocks are excluded by callers. */
export function canonicalJson(value: unknown): string {
  const encode = (input: unknown): unknown => {
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (Array.isArray(input)) return input.map(encode);
    if (typeof input === "object") {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(input!).sort()) result[key] = encode((input as Record<string, unknown>)[key]);
      return result;
    }
    throw new Error("canonical_json_unsupported_value");
  };
  return JSON.stringify(encode(value));
}
export function canonicalConfigDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
