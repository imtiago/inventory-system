// src/modules/payables/infrastructure/http/controllers/MarkParcelPaidController.ts
import { MarkParcelPaid } from "modules/finance/application/useCases/MarkParcelPaid";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";
import { FastifyRequest, FastifyReply } from "fastify";

export function makeMarkParcelPaidController(repo: PayableRepository) {
  const useCase = new MarkParcelPaid(repo);
  return async function MarkParcelPaidController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { parcelId } = req.params as { parcelId: string };
    const parcel = await useCase.execute(parcelId, new Date());
    return reply.status(200).send(parcel);
  };
}
