import { FastifyRequest, FastifyReply } from "fastify";
import { sendBadRequest } from "@shared/http/formatZodError";
import { generateInventoryBoxLabelParamsSchema } from "@inventory/interfaces/http/schemas/generateInventoryBoxLabelSchema";
import { makeGenerateInventoryBoxLabel } from "../factories/GenerateInventoryBoxLabelFactory";
export function makeGenerateInventoryBoxLabelController() {
  const useCase = makeGenerateInventoryBoxLabel();

  return async function GenerateInventoryBoxLabelController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { code } = generateInventoryBoxLabelParamsSchema.parse(
        request.params,
      );
      const pdf = await useCase.execute({ code });
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `inline; filename="${code}.pdf"`)
        .send(pdf);
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
