// Normalize a mailparser header value (string | string[] | structured) to text.
export function headerVal(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  return String((v as { value?: unknown }).value ?? v);
}
