import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeChangeOwnPasswordUseCase } from "../factories/ChangeOwnPasswordFactory";
import { changeOwnPasswordSchema } from "../../../interfaces/http/schemas/userManagementSchemas";
import { currentUserId } from "./currentUserId";

export function makeChangeOwnPasswordController() {
  const useCase = makeChangeOwnPasswordUseCase();
  return async function ChangeOwnPasswordController(request: FastifyRequest, reply: FastifyReply) {
    const { currentPassword, newPassword } = parseInput(changeOwnPasswordSchema, request.body);

    const { token } = await useCase.execute({ userId: currentUserId(request), currentPassword, newPassword });

    // 200 com o token novo: a aba atual continua logada; as outras sessões caem.
    return reply.status(200).send(HttpResponse.ok({ token }));
  };
}
