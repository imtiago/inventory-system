import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { listInventoryBoxesSchema } from "@inventory/interfaces/http/schemas/listInventoryBoxesSchema";
import { makeListInventoryBoxesUseCase } from "../factories/ListInventoryBoxesFactory";

export function makeListInventoryBoxesController() {
  const useCase = makeListInventoryBoxesUseCase();

  return async function ListInventoryBoxesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const query = parseInput(listInventoryBoxesSchema, request.query);
    const data = await useCase.execute(query);

    return reply.send(HttpResponse.paginated(data));
  };
}
