// backend/src/modules/inventory/interfaces/http/routes/inventoryRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { idempotent } from "@shared/http/idempotency/idempotent";
import { makeGetInventoryByVariantIdController } from "../controllers/GetInventoryByVariantIdController";
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
import { makeCreateInventoryController } from "../controllers/CreateInventoryController";

export async function inventoryRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authorize("inventory.read")] },
    makeListInventoryController(),
  );
  app.post(
    "/",
    { preHandler: [authorize("inventory.write")] },
    makeCreateInventoryController(),
  );
  app.get(
    "/product-variant/barcode/:barcode",
    { preHandler: [authorize("inventory.read")] },
    makeGetInventoryByProductVariantBarcodeController(),
  );
  app.post(
    "/receive",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeReceiveInventoryController()),
  );
  app.post(
    "/dispatch",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeDispatchInventoryController()),
  );
  app.post(
    "/reserve",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeReserveInventoryController()),
  );
  app.post(
    "/release",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeReleaseInventoryController()),
  );
  app.post(
    "/adjust",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeAdjustInventoryController()),
  );
  app.post(
    "/initial-count",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeRegisterScannedProductController()),
  );
  app.get(
    "/dashboard",
    { preHandler: [authorize("inventory.read")] },
    makeGetInventoryDashboardController(),
  );
  app.get(
    "/variants/:productVariantId/lots",
    { preHandler: [authorize("inventory.read")] },
    makeListInventoryLotsByVariantIdController(),
  );
  app.get(
    "/variants/:variantId",
    { preHandler: [authorize("inventory.read")] },
    makeGetInventoryByVariantIdController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize("inventory.read")] },
    makeGetInventoryByIdController(),
  );
  app.register(stockMovementRoutes, { prefix: "/movements" });
  app.register(inventoryBoxRoutes, { prefix: "/boxes" });
  app.register(inventoryLotRoutes, { prefix: "/lots" });
}
