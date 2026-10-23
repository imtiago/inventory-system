import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeChangeOwnPasswordUseCase } from "../factories/ChangeOwnPasswordFactory";
import { changeOwnPasswordSchema } from "../../../interfaces/http/schemas/userManagementSchemas";
import { currentUserId } from "./currentUserId";

export function makeChangeOwnPasswordController() {
  const useCase = makeChangeOwnPasswordUseCase();
  return async function ChangeOwnPasswordController(request: FastifyRequest, reply: FastifyReply) {
    const { currentPassword, newPassword } = parseInput(changeOwnPasswordSchema, request.body);

    await useCase.execute({ userId: currentUserId(request), currentPassword, newPassword });

    return reply.status(204).send();
  };
}
