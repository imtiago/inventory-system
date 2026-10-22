import { parseInput } from "@shared/http/parseInput";
// src/modules/payables/infrastructure/http/controllers/CreatePayableController.ts
import { CreatePayable } from "@finance/application/useCases/commands/CreatePayableUseCase";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";
import { createPayableSchema } from "modules/finance/interfaces/http/schemas/createPayableSchema";
import { FastifyRequest, FastifyReply } from "fastify";

export function makeCreatePayableController(repo: PayableRepository) {
  const useCase = new CreatePayable(repo);
  return async function CreatePayableController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(createPayableSchema, req.body);
    const payable = await useCase.execute(
      data.purchaseId,
      data.totalAmount,
      data.parcels.map((p) => ({
        amount: p.amount,
        dueDate: new Date(p.dueDate),
      })),
    );
    return reply.status(201).send(payable);
  };
}
