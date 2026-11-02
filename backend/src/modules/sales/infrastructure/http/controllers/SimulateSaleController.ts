import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { hasUserPermission } from "@shared/auth/permissions";
import { simulateSaleSchema } from "../../../interfaces/http/schemas/createSaleSchema";
import { makeSimulateSaleUseCase } from "../factories/SimulateSaleFactory";

export function makeSimulateSaleController() {
  const simulate = makeSimulateSaleUseCase();
  return async function SimulateSaleController(request: FastifyRequest, reply: FastifyReply) {
    const body = parseInput(simulateSaleSchema, request.body);
    const user = request.user!;
    // Margem é lucro: só quem tem reports.profit (ADMIN). VENDEDOR não recebe a chave.
    const includeMargin = hasUserPermission(
      { role: user.role, canApproveCredit: user.canApproveCredit === true },
      "reports.profit",
    );
    return reply.send({ data: await simulate.execute({ ...body, includeMargin }) });
  };
}
