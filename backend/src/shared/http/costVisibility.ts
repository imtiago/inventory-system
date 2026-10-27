import type { FastifyInstance } from "fastify";
import { canSeeStockCost } from "@shared/auth/costVisibility";

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === "object" && !Array.isArray(v);

/** Campos de custo do estoque que os DTOs de leitura carregam. */
export const COST_FIELDS: ReadonlySet<string> = new Set([
  "averageCost",
  "unitCost",
  "acquisitionExtraCost",
  "totalStockValue",
  "stockValue",
]);

function strip(item: unknown): unknown {
  if (Array.isArray(item)) return item.map(strip);
  if (!isObject(item) || item instanceof Date) return item;
  const out: Json = {};
  for (const [key, value] of Object.entries(item)) if (!COST_FIELDS.has(key)) out[key] = strip(value);
  return out;
}

/**
 * Registrado uma vez na instância raiz (vale para todas as rotas): quem não pode ver custo
 * (`canSeeStockCost`) recebe as respostas sem nenhum campo de custo, em qualquer profundidade.
 */
export function hideCostFromNonStockRoles(app: FastifyInstance): void {
  app.addHook("preSerialization", async (request, _reply, payload) => {
    if (!isObject(payload) || !("data" in payload)) return payload;
    if (canSeeStockCost(request.user?.role)) return payload;
    return { ...payload, data: strip(payload.data) };
  });
}
