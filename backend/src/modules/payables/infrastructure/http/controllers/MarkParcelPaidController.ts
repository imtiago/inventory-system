// src/modules/payables/infrastructure/http/controllers/MarkParcelPaidController.ts
import { MarkParcelPaid } from "@payables/application/useCases/MarkParcelPaid";
import { PayableRepository } from "@payables/domain/repositories/PayableRepository";
import { FastifyRequest, FastifyReply } from "fastify";

export function makeMarkParcelPaidController(repo: PayableRepository) {
  return async function MarkParcelPaidController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { parcelId } = req.params as { parcelId: string };
    const useCase = new MarkParcelPaid(repo);
    const parcel = await useCase.execute(parcelId, new Date());
    return reply.status(200).send(parcel);
  };
}
