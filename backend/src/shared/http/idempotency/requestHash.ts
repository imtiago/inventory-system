import { createHash } from "node:crypto";

/** JSON com as chaves dos objetos ordenadas (arrays mantêm a ordem). */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
  }
  const entries = Object.keys(value)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

export interface RequestFingerprint {
  method: string;
  route: string;
  params: unknown;
  body: unknown;
}

/** SHA-256 (hex) de método + padrão da rota + params + corpo em JSON canônico. */
export function requestHash({ method, route, params, body }: RequestFingerprint): string {
  return createHash("sha256")
    .update(canonicalJson([method.toUpperCase(), route, params ?? {}, body ?? null]))
    .digest("hex");
}
