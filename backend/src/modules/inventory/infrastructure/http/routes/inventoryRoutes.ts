// backend/src/modules/inventory/interfaces/http/routes/inventoryRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeAddInventoryController } from "../controllers/AddInventoryController";
import { makeRemoveInventoryController } from "../controllers/RemoveInventoryController";
import { makeGetInventoryController } from "../controllers/GetInventoryController";
import { makeGetInventoryByVariantIdController } from "../controllers/GetInventoryByVariantIdController";
import { makeListInventoryController } from "../controllers/ListInventoryController";

export async function inventoryRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListInventoryController(),
  );
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
  app.get(
    "/:variantId",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetInventoryController(),
  );
  app.get(
    "/variants/:variantId",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetInventoryByVariantIdController(),
  );
}
