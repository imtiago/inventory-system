import { FastifyRequest, FastifyReply } from "fastify";
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
    try {
      const { code } = generateInventoryBoxLabelParamsSchema.parse(
        request.params,
      );
      const { productCode, quantity } =
        generateInventoryProductLabelsBodySchema.parse(request.body);
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
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
