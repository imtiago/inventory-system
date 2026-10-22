import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import {
  generateInventoryBoxLabelParamsSchema,
  generateInventoryProductLabelsBodySchema,
} from "@inventory/interfaces/http/schemas/generateInventoryBoxLabelSchema";
import { makeGenerateInventoryProductLabels } from "../factories/GenerateInventoryProductLabelsFactory";
export function makeGenerateInventoryProductLabelsController() {
  const useCase = makeGenerateInventoryProductLabels();

  return async function GenerateInventoryProductLabelsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { code } = parseInput(generateInventoryBoxLabelParamsSchema, request.params);
    const { productCode, quantity } =
      parseInput(generateInventoryProductLabelsBodySchema, request.body);
    const pdf = await useCase.execute({
      boxCode: code,
      productCode: productCode,
      quantity: quantity,
    });
    return reply
      .header("Content-Type", "application/pdf")
      .header(
        "Content-Disposition",
        `inline; filename="${code}-${productCode}.pdf"`,
      )
      .send(pdf);
  };
}
