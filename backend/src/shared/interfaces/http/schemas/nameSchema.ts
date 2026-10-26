import { z } from "zod";
import { normalizeWhitespace } from "@shared/domain/text/normalizeWhitespace";

/**
 * Nome comum (produto, variante, marca, categoria, cliente, fornecedor, usuário): apara, colapsa
 * espaços internos e valida tamanho. O tamanho é medido depois da normalização.
 */
export function createNameSchema({ min = 1, max = 120 }: { min?: number; max?: number } = {}) {
  const required = "O nome é obrigatório.";
  return z
    .string({ error: required })
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? required : `O nome deve ter no mínimo ${min} caracteres.`)
        .max(max, `O nome deve ter no máximo ${max} caracteres.`),
    );
}
