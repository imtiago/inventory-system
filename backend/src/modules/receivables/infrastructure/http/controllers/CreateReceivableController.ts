// src/modules/receivables/infrastructure/http/controllers/CreateReceivableController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ReceivableRepository } from "@receivables/domain/repositories/ReceivableRepository";
import { CreateReceivable } from "@receivables/application/useCases/CreateReceivable";
import { createReceivableSchema } from "@receivables/interfaces/http/schemas/createReceivableSchema";

export function makeCreateReceivableController(repo: ReceivableRepository) {
  return async function CreateReceivableController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createReceivableSchema.parse(req.body);
      const useCase = new CreateReceivable(repo);
      const receivable = await useCase.execute(
        data.saleId,
        data.totalAmount,
        data.parcels.map((p) => ({
          amount: p.amount,
          dueDate: new Date(p.dueDate),
        })),
      );
      return reply.status(201).send(receivable);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
