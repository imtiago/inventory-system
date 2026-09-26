import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { createInventorySchema } from "@inventory/interfaces/http/schemas/createInventorySchema";
import { makeGenerateInventoryByProductVariandIdUseCase } from "../factories/GenerateInventoryByProductVariandIdFactory";
import { makeGetInventoryByIdReadUseCase } from "../factories/GetInventoryByIdReadFactory";

export function makeCreateInventoryController() {
  const useCase = makeGenerateInventoryByProductVariandIdUseCase();
  const getInventoryByIdReadUseCase = makeGetInventoryByIdReadUseCase();

  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const dataRequest = createInventorySchema.parse(request.body);

      const data = await useCase.handle({
        productVariantId: dataRequest.productVariantId,
      });

      // const data = await useCase.execute({
      //   productVariantId: dataRequest.productVariantId,
      // });
      const dataReturn = await getInventoryByIdReadUseCase.execute(data.id);

      return reply.send(HttpResponse.created(dataReturn));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
