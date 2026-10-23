import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { createSaleSchema } from "../../../interfaces/http/schemas/createSaleSchema";
import { makeCreateSaleUseCase } from "../factories/CreateSaleFactory";
import { makeGetSaleByIdUseCase } from "../factories/GetSaleByIdFactory";

export function makeCreateSaleController() {
  const createSale = makeCreateSaleUseCase();
  const getSale = makeGetSaleByIdUseCase();
  return async function CreateSaleController(request: FastifyRequest, reply: FastifyReply) {
    const body = parseInput(createSaleSchema, request.body);

    // Vendedor = usuário autenticado (rota protegida por authorize).
    const sale = await createSale.execute({ ...body, sellerId: request.user!.sub });

    return reply.status(201).send({ data: await getSale.execute(sale.id) });
  };
}
