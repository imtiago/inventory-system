import { addInventorySchema } from "@inventory/interfaces/http/schemas/addInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeAddInventory } from "../factories/AddInventoryFactory";

export function makeAddInventoryController() {
  return async function AddInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = addInventorySchema.parse(request.body);

      const useCase = makeAddInventory();

      const inventory = await useCase.execute(data);

      return reply.status(201).send(inventory);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
