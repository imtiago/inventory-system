// backend/src/modules/inventory/interfaces/http/routes/inventoryRoutes.ts
import { FastifyInstance } from "fastify";
import { PrismaInventoryRepository } from "../../../infrastructure/repositories/PrismaInventoryRepository";
import { AddInventory } from "../../../application/useCases/AddInventory";
import { RemoveInventory } from "../../../application/useCases/RemoveInventory";
import { addInventorySchema } from "../../../interfaces/http/schemas/addInventorySchema";
import { removeInventorySchema } from "../../../interfaces/http/schemas/removeInventorySchema";
import { getInventorySchema } from "../../../interfaces/http/schemas/getInventorySchema";
import { authorize } from "../../../../../shared/middleware/authorize";

export async function inventoryRoutes(app: FastifyInstance) {
  const repo = new PrismaInventoryRepository();

  app.post(
    "/add",
    { preHandler: [authorize(["admin", "vendedor"])] },
    async (req, reply) => {
      const parsed = addInventorySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ errors: parsed.error.format() });
      }

      const { productVariantId, quantity } = parsed.data;
      const useCase = new AddInventory(repo);
      const inventory = await useCase.execute(productVariantId, quantity);
      return reply.status(201).send(inventory);
    },
  );

  app.post(
    "/remove",
    { preHandler: [authorize(["admin", "vendedor"])] },

    async (req, reply) => {
      const parsed = removeInventorySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ errors: parsed.error.format() });
      }

      const { productVariantId, quantity } = parsed.data;
      const useCase = new RemoveInventory(repo);
      const inventory = await useCase.execute(productVariantId, quantity);
      return reply.send(inventory);
    },
  );

  // Endpoint GET com validação
  app.get(
    "/:variantId",
    { preHandler: [authorize(["admin", "vendedor"])] },

    async (req, reply) => {
      const parsed = getInventorySchema.safeParse(req.params);
      if (!parsed.success) {
        return reply.status(400).send({ errors: parsed.error.format() });
      }

      const { variantId } = parsed.data;
      const inventory = await repo.findByVariant(variantId);

      if (!inventory) {
        return reply.status(404).send({ message: "Inventory not found" });
      }

      return reply.send(inventory);
    },
  );
}
