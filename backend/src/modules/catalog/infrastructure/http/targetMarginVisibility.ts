import type { FastifyInstance } from "fastify";
import { hasPermission } from "@shared/auth/permissions";
import { bpsToPercent } from "@shared/domain/percent";

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === "object" && !Array.isArray(v);

function present(item: unknown, canSee: boolean): unknown {
  if (Array.isArray(item)) return item.map((i) => present(i, canSee));
  if (!isObject(item) || item instanceof Date) return item;
  const out: Json = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === "targetMarginBps") {
      if (canSee) out.targetMarginPercent = typeof value === "number" ? bpsToPercent(value) : null;
    } else {
      out[key] = present(value, canSee);
    }
  }
  return out;
}

/**
 * Os DTOs de catálogo carregam `targetMarginBps` (interno). Registrado uma vez na instância raiz:
 * vale para TODAS as rotas, então nenhuma rota esquece. Quem tem `pricing.manage` recebe
 * `targetMarginPercent` (número ou null); os demais papéis não recebem a chave, em qualquer profundidade.
 */
export function hideTargetMarginFromNonAdmins(app: FastifyInstance): void {
  app.addHook("preSerialization", async (request, _reply, payload) => {
    if (!isObject(payload) || !("data" in payload)) return payload;
    const canSee = !!request.user && hasPermission(request.user.role, "pricing.manage");
    return { ...payload, data: present(payload.data, canSee) };
  });
}
