import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
// import { makeGetInventoryBoxByIdUseCase } from "../factories/GetInventoryBoxByIdFactory";
import { makeAddProductToBoxUseCase } from "../factories/AddProductToBoxFactory";
import {
  addProductToBoxBodySchema,
  addProductToBoxParamsSchema,
} from "@inventory/interfaces/http/schemas/addProductToBoxSchema";

export function makeAddProductToBoxController() {
  const useCase = makeAddProductToBoxUseCase();

  return async function AddProductToBoxController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      console.log("object");
      const { boxId } = addProductToBoxParamsSchema.parse(request.params);
      const { inventoryLotId, quantity } = addProductToBoxBodySchema.parse(
        request.body,
      );

      const dt = await useCase.execute({ boxId, inventoryLotId, quantity });

      return reply.send(HttpResponse.created(dt));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
