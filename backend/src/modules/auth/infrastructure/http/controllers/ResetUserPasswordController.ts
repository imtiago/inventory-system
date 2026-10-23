import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeResetUserPasswordUseCase } from "../factories/ResetUserPasswordFactory";
import {
  resetUserPasswordSchema,
  userIdParamsSchema,
} from "../../../interfaces/http/schemas/userManagementSchemas";

export function makeResetUserPasswordController() {
  const useCase = makeResetUserPasswordUseCase();
  return async function ResetUserPasswordController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(userIdParamsSchema, request.params);
    const { password } = parseInput(resetUserPasswordSchema, request.body);

    await useCase.execute({ id, password });

    return reply.status(204).send();
  };
}
