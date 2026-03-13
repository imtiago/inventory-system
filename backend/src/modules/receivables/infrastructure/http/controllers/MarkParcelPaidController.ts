// src/modules/receivables/infrastructure/http/controllers/MarkParcelPaidController.ts
import { MarkParcelPaid } from "@receivables/application/useCases/MarkParcelPaid";
import { ReceivableRepository } from "@receivables/domain/repositories/ReceivableRepository";
import { FastifyRequest, FastifyReply } from "fastify";

export function makeMarkParcelPaidController(repo: ReceivableRepository) {
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
