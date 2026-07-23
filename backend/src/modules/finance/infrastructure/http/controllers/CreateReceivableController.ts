// src/modules/receivables/infrastructure/http/controllers/CreateReceivableController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { createReceivableSchema } from "modules/finance/interfaces/http/schemas/createReceivableSchema";
import { makeCreateReceivableUseCase } from "../factories/CreateReceivableFactory";

export function makeCreateReceivableController() {
  const useCase = makeCreateReceivableUseCase();
  return async function CreateReceivableController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createReceivableSchema.parse(req.body);
      // const useCase = new CreateReceivable(repo);
      const data = {
        data.saleId,
        data.totalAmount,

        data.parcels.map((p) => ({
          amount: p.amount,
          dueDate: new Date(p.dueDate),
        })),
    }
      const receivable = await useCase.execute(data);
      return reply.status(201).send(receivable);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
