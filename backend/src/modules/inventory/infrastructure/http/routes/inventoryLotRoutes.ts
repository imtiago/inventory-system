import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateInventoryLotController } from "../controllers/CreateInventoryLotController";
// import { makeAddInventoryController } from "../controllers/ReceiveInventoryController";
// import { makeRemoveInventoryController } from "../controllers/RemoveInventoryController";
// import { makeGetInventoryController } from "../controllers/GetInventoryController";
// import { makeGetInventoryByVariantIdController } from "../controllers/GetInventoryByVariantIdController";
// import { makeListInventoryController } from "../controllers/ListInventoryController";
// import { makeCreateStockMovementController } from "../controllers/CreateStockMovementController";
// import { makeListStockMovementsController } from "../controllers/ListStockMovementsController";

export async function inventoryLotRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateInventoryLotController(),
  );
  //   app.get(
  //     "/",
  //     { preHandler: [authorize(["admin", "vendedor"])] },
  //     makeListInventoryController(),
  //   );
  //   app.post(
  //     "/movements",
  //     { preHandler: [authorize(["admin", "vendedor"])] },
  //     makeCreateStockMovementController(),
  //   );
  //   app.get(
  //     "/movements",
  //     { preHandler: [authorize(["admin", "vendedor"])] },
  //     makeListStockMovementsController(),
  //   );
  //   app.post(
  //     "/remove",
  //     { preHandler: [authorize(["admin", "vendedor"])] },
  //     makeRemoveInventoryController(),
  //   );
  //   app.get(
  //     "/:variantId",
  //     { preHandler: [authorize(["admin", "vendedor"])] },
  //     makeGetInventoryController(),
  //   );
  //   app.get(
  //     "/variants/:variantId",
  //     { preHandler: [authorize(["admin", "vendedor"])] },
  //     makeGetInventoryByVariantIdController(),
  //   );
}
