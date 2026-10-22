// Shape of keys only: objects → sorted keys (recursively), arrays → shape of the first item.
export function keyShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length > 0 ? [keyShape(value[0])] : [];
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = keyShape((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return null;
}
