import type { FastifyInstance } from "fastify";
import { hasPermission } from "@shared/auth/permissions";
import { bpsToPercent } from "@shared/domain/percent";

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === "object" && !Array.isArray(v);

function present(item: unknown, canSee: boolean): unknown {
  if (!isObject(item) || !("targetMarginBps" in item)) return item;
  const { targetMarginBps, ...rest } = item;
  if (!canSee) return rest;
  return { ...rest, targetMarginPercent: typeof targetMarginBps === "number" ? bpsToPercent(targetMarginBps) : null };
}

/**
 * Os DTOs de catálogo carregam `targetMarginBps` (interno). Na saída, quem tem
 * `pricing.manage` recebe `targetMarginPercent` (número ou null); os demais papéis
 * não recebem a chave. Vale para todas as rotas do plugin onde é registrado.
 */
export function hideTargetMarginFromNonAdmins(app: FastifyInstance): void {
  app.addHook("preSerialization", async (request, _reply, payload) => {
    if (!isObject(payload) || !("data" in payload)) return payload;
    const canSee = !!request.user && hasPermission(request.user.role, "pricing.manage");
    const { data } = payload;
    return { ...payload, data: Array.isArray(data) ? data.map((d) => present(d, canSee)) : present(data, canSee) };
  });
}
