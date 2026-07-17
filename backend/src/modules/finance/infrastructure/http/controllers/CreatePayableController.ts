// src/modules/payables/infrastructure/http/controllers/CreatePayableController.ts
import { CreatePayable } from "modules/finance/application/useCases/CreatePayable";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";
import { createPayableSchema } from "modules/finance/interfaces/http/schemas/createPayableSchema";
import { FastifyRequest, FastifyReply } from "fastify";

export function makeCreatePayableController(repo: PayableRepository) {
  return async function CreatePayableController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createPayableSchema.parse(req.body);
      const useCase = new CreatePayable(repo);
      const payable = await useCase.execute(
        data.purchaseId,
        data.totalAmount,
        data.parcels.map((p) => ({
          amount: p.amount,
          dueDate: new Date(p.dueDate),
        })),
      );
      return reply.status(201).send(payable);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
