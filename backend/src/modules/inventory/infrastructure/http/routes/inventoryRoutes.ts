// backend/src/modules/inventory/interfaces/http/routes/inventoryRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeAddInventoryController } from "../controllers/AddInventoryController";
import { makeRemoveInventoryController } from "../controllers/RemoveInventoryController";
import { makeGetInventoryController } from "../controllers/GetInventoryController";

export async function inventoryRoutes(app: FastifyInstance) {
  app.post(
    "/add",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeAddInventoryController(),
  );

  app.post(
    "/remove",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeRemoveInventoryController(),
  );

  // Endpoint GET com validação
  app.get(
    "/:variantId",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetInventoryController(),
  );
}
