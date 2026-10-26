import { FastifyRequest, FastifyReply } from "fastify";
import { contentDisposition } from "@shared/http/contentDisposition";
import { parseInput } from "@shared/http/parseInput";
import { generateInventoryBoxLabelParamsSchema } from "@inventory/interfaces/http/schemas/generateInventoryBoxLabelSchema";
import { makeGenerateInventoryBoxLabel } from "../factories/GenerateInventoryBoxLabelFactory";
export function makeGenerateInventoryBoxLabelController() {
  const useCase = makeGenerateInventoryBoxLabel();

  return async function GenerateInventoryBoxLabelController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { code } = parseInput(generateInventoryBoxLabelParamsSchema, request.params);
    const pdf = await useCase.execute({ code });
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", contentDisposition("inline", `${code}.pdf`))
      .send(pdf);
  };
}
