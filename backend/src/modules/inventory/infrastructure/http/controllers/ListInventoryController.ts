import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { makeListInventoryUseCase } from "../factories/ListInventoryFactory";
import { makeListInventoryBalancesUseCase } from "../factories/ListInventoryBalancesFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { listInventoryBalancesSchema } from "@inventory/interfaces/http/schemas/listInventoryBalancesSchema";
import { HttpResponse } from "@shared/http/response";

export function makeListInventoryController() {
  const useCase = makeListInventoryUseCase();
  const balancesUseCase = makeListInventoryBalancesUseCase();
  return async function ListInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    // ?productVariantIds=a,b,c → saldos em lote (sem paginação).
    if ((request.query as Record<string, unknown> | undefined)?.productVariantIds !== undefined) {
      const { productVariantIds } = parseInput(listInventoryBalancesSchema, request.query);
      const balances = await balancesUseCase.execute(productVariantIds);
      return reply.send(HttpResponse.ok(balances));
    }

    const { page, limit } = parseInput(paginationSchema, request.query);

    const listInventory = await useCase.execute({ page, limit });

    return reply.send(HttpResponse.paginated(listInventory));
  };
}
