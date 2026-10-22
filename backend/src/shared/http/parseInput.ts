import type { ZodType } from "zod";
import { ValidationError } from "../domain/errors";

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError(
    "Dados inválidos.",
    result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  );
}
