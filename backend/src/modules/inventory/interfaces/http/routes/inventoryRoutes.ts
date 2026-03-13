import { FastifyInstance } from "fastify";
import { PrismaInventoryRepository } from "../../../infrastructure/repositories/PrismaInventoryRepository";
import { AddInventory } from "../../../application/useCases/AddInventory";
import { RemoveInventory } from "../../../application/useCases/RemoveInventory";
import { GetInventory } from "../../../application/useCases/GetInventory";

export async function inventoryRoutes(app: FastifyInstance) {
  const repo = new PrismaInventoryRepository();

  app.post("/inventory/add", async (req, reply) => {
    const { productVariantId, quantity } = req.body as {
      productVariantId: string;
      quantity: number;
    };
    const useCase = new AddInventory(repo);
    const inventory = await useCase.execute(productVariantId, quantity);
    return reply.status(201).send(inventory);
  });

  app.post("/inventory/remove", async (req, reply) => {
    const { productVariantId, quantity } = req.body as {
      productVariantId: string;
      quantity: number;
    };
    const useCase = new RemoveInventory(repo);
    const inventory = await useCase.execute(productVariantId, quantity);
    return reply.send(inventory);
  });

  app.get("/inventory/:variantId", async (req, reply) => {
    const { variantId } = req.params as { variantId: string };
    const useCase = new GetInventory(repo);
    const inventory = await useCase.execute(variantId);
    if (!inventory)
      return reply.status(404).send({ message: "Inventory not found" });
    return reply.send(inventory);
  });
}
