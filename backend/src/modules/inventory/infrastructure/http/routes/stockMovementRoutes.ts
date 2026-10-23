import { authorize } from "@shared/middleware/authorize";
import { FastifyInstance } from "fastify";
import { makeListStockMovementsController } from "../controllers/ListStockMovementsController";
// import { authorize } from "../../../../../shared/middleware/authorize";
// import { makeAddInventoryController } from "../controllers/ReceiveInventoryController";
// import { makeRemoveInventoryController } from "../controllers/RemoveInventoryController";
// import { makeGetInventoryController } from "../controllers/GetInventoryController";
// import { makeGetInventoryByVariantIdController } from "../controllers/GetInventoryByVariantIdController";
// import { makeListInventoryController } from "../controllers/ListInventoryController";
// import { makeCreateStockMovementController } from "../controllers/CreateStockMovementController";
// import { makeListStockMovementsController } from "../controllers/ListStockMovementsController";

export async function stockMovementRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authorize("inventory.read")] },
    makeListStockMovementsController(),
  );
  //   app.post(
  //     "/movements",
  //     { preHandler: [authorize("inventory.write")] },
  //     makeCreateStockMovementController(),
  //   );
  //   app.get(
  //     "/movements",
  //     { preHandler: [authorize("inventory.read")] },
  //     makeListStockMovementsController(),
  //   );
  //   app.post(
  //     "/remove",
  //     { preHandler: [authorize("inventory.write")] },
  //     makeRemoveInventoryController(),
  //   );
  //   app.get(
  //     "/:variantId",
  //     { preHandler: [authorize("inventory.read")] },
  //     makeGetInventoryController(),
  //   );
  //   app.get(
  //     "/variants/:variantId",
  //     { preHandler: [authorize("inventory.read")] },
  //     makeGetInventoryByVariantIdController(),
  //   );
}
