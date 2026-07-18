// backend/src/modules/inventory/interfaces/http/routes/inventoryRoutes.ts
import { FastifyInstance } from "fastify";
import { PrismaInventoryRepository } from "../../../infrastructure/repositories/PrismaInventoryRepository";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeAddInventoryController } from "../controllers/AddInventoryController";
import { makeRemoveInventoryController } from "../controllers/RemoveInventoryController";
import { makeGetInventoryController } from "../controllers/GetInventoryController";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export async function inventoryRoutes(app: FastifyInstance) {
  const repo = new PrismaInventoryRepository();
  const tx = new PrismaTransactionManager();

  app.post(
    "/add",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeAddInventoryController(),
  );

  app.post(
    "/remove",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeRemoveInventoryController(repo, tx),
  );

  // Endpoint GET com validação
  app.get(
    "/:variantId",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetInventoryController(repo),
  );
}
