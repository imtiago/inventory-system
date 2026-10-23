/** Remove espaços das pontas e colapsa espaços internos (inclui tabs/quebras) em um só. */
export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
