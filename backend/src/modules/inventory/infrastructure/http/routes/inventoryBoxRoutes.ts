import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
// import { makeAddInventoryController } from "../controllers/ReceiveInventoryController";
// import { makeRemoveInventoryController } from "../controllers/RemoveInventoryController";
// import { makeGetInventoryController } from "../controllers/GetInventoryController";
// import { makeGetInventoryByVariantIdController } from "../controllers/GetInventoryByVariantIdController";
// import { makeListInventoryController } from "../controllers/ListInventoryController";
import { makeCreateInventoryBoxController } from "../controllers/CreateInventoryBoxController";
import { makeListInventoryBoxesController } from "../controllers/ListInventoryBoxesController";
import { makeAddProductToBoxController } from "../controllers/AddProductToBoxController";
import { makeGetInventoryBoxByCodeController } from "../controllers/GetInventoryBoxByCodeController";
import { makeGenerateInventoryBoxLabelController } from "../controllers/GenerateInventoryBoxLabelController";
import { makeGenerateInventoryProductLabelsController } from "../controllers/GenerateInventoryProductLabelsController";
import { makeGetInventoryBoxByLotAndProductVariantController } from "../controllers/GetInventoryBoxByLotAndProductVariantController";
// import { makeCreateStockMovementController } from "../controllers/CreateStockMovementController";
// import { makeListStockMovementsController } from "../controllers/ListStockMovementsController";

export async function inventoryBoxRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authorize("inventory.read")] },
    makeListInventoryBoxesController(),
  );
  app.post(
    "/",
    { preHandler: [authorize("inventory.write")] },
    makeCreateInventoryBoxController(),
  );
  app.post(
    "/:boxId/items",
    { preHandler: [authorize("inventory.write")] },
    makeAddProductToBoxController(),
  );
  app.post(
    "/code/:code/product-labels",
    { preHandler: [authorize("inventory.write")] },
    makeGenerateInventoryProductLabelsController(),
  );
  app.get(
    "/by-lot",
    { preHandler: [authorize("inventory.read")] },
    makeGetInventoryBoxByLotAndProductVariantController(),
  );
  app.get(
    "/code/:code",
    { preHandler: [authorize("inventory.read")] },
    makeGetInventoryBoxByCodeController(),
  );
  app.get(
    "/code/:code/label",
    { preHandler: [authorize("inventory.write")] },
    makeGenerateInventoryBoxLabelController(),
  );
  //   app.get(
  //     "/",
  //     { preHandler: [authorize("inventory.read")] },
  //     makeListInventoryController(),
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
