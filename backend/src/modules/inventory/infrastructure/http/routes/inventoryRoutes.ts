// backend/src/modules/inventory/interfaces/http/routes/inventoryRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
// import { makeAddInventoryController } from "../controllers/ReceiveInventoryController";
// import { makeGetInventoryController } from "../controllers/GetInventoryController";
// import { makeGetInventoryByVariantIdController } from "../controllers/GetInventoryByVariantIdController";
import { makeListInventoryController } from "../controllers/ListInventoryController";
import { makeReceiveInventoryController } from "../controllers/ReceiveInventoryController";
import { makeDispatchInventoryController } from "../controllers/DispatchInventoryController";
import { makeReserveInventoryController } from "../controllers/ReserveInventoryController";
import { makeReleaseInventoryController } from "../controllers/ReleaseInventoryController";
import { makeAdjustInventoryController } from "../controllers/AdjustInventoryController";
import { makeGetInventoryByIdController } from "../controllers/GetInventoryByIdController";
import { stockMovementRoutes } from "./stockMovementRoutes";
import { makeGetInventoryDashboardController } from "../controllers/GetInventoryDashboardController";
import { inventoryBoxRoutes } from "./inventoryBoxRoutes";
import { makeRegisterScannedProductController } from "../controllers/RegisterScannedProductController";
import { makeGetInventoryByProductVariantBarcodeController } from "../controllers/GetInventoryByProductVariantBarcodeController";
import { inventoryLotRoutes } from "./inventoryLotRoutes";
import { makeListInventoryLotsByVariantIdController } from "../controllers/GetListInventoryLotsByVariantIdController";
// import { makeCreateStockMovementController } from "../controllers/CreateStockMovementController";
// import { makeListStockMovementsController } from "../controllers/ListStockMovementsController";

export async function inventoryRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListInventoryController(),
  );
  app.get(
    "/product-variant/barcode/:barcode",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetInventoryByProductVariantBarcodeController(),
  );
  app.post(
    "/receive",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeReceiveInventoryController(),
  );
  app.post(
    "/dispatch",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeDispatchInventoryController(),
  );
  app.post(
    "/reserve",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeReserveInventoryController(),
  );
  app.post(
    "/release",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeReleaseInventoryController(),
  );
  app.post(
    "/adjust",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeAdjustInventoryController(),
  );
  app.post(
    "/initial-count",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeRegisterScannedProductController(),
  );
  app.get(
    "/dashboard",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetInventoryDashboardController(),
  );
  app.get(
    "/variants/:productVariantId/lots",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListInventoryLotsByVariantIdController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetInventoryByIdController(),
  );
  app.register(stockMovementRoutes, { prefix: "/movements" });
  app.register(inventoryBoxRoutes, { prefix: "/boxes" });
  app.register(inventoryLotRoutes, { prefix: "/lots" });

  // app.post(
  //   "/movements",
  //   { preHandler: [authorize(["admin", "vendedor"])] },
  //   makeCreateStockMovementController(),
  // );
  // app.get(
  //   "/movements",
  //   { preHandler: [authorize(["admin", "vendedor"])] },
  //   makeListStockMovementsController(),
  // );

  // app.post(
  //   "/remove",
  //   { preHandler: [authorize(["admin", "vendedor"])] },
  //   makeRemoveInventoryController(),
  // );
  // app.get(
  //   "/:variantId",
  //   { preHandler: [authorize(["admin", "vendedor"])] },
  //   makeGetInventoryController(),
  // );
  // app.get(
  //   "/variants/:variantId",
  //   { preHandler: [authorize(["admin", "vendedor"])] },
  //   makeGetInventoryByVariantIdController(),
  // );
}
