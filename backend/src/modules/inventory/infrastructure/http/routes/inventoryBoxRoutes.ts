import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
// import { makeAddInventoryController } from "../controllers/ReceiveInventoryController";
// import { makeRemoveInventoryController } from "../controllers/RemoveInventoryController";
// import { makeGetInventoryController } from "../controllers/GetInventoryController";
// import { makeGetInventoryByVariantIdController } from "../controllers/GetInventoryByVariantIdController";
// import { makeListInventoryController } from "../controllers/ListInventoryController";
import { makeCreateInventoryBoxController } from "../controllers/CreateInventoryBoxController ";
import { makeAddProductToBoxController } from "../controllers/AddProductToBoxController";
import { makeGetInventoryBoxByCodeController } from "../controllers/GetInventoryBoxByCodeController";
import { makeGenerateInventoryBoxLabelController } from "../controllers/GenerateInventoryBoxLabelController";
import { makeGenerateInventoryProductLabelsController } from "../controllers/GenerateInventoryProductLabelsController";
// import { makeCreateStockMovementController } from "../controllers/CreateStockMovementController";
// import { makeListStockMovementsController } from "../controllers/ListStockMovementsController";

export async function inventoryBoxRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateInventoryBoxController(),
  );
  app.post(
    "/:boxId/items",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeAddProductToBoxController(),
  );
  app.post(
    "/code/:code/product-labels",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGenerateInventoryProductLabelsController(),
  );
  app.get(
    "/code/:code",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetInventoryBoxByCodeController(),
  );
  app.get(
    "/code/:code/label",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGenerateInventoryBoxLabelController(),
  );
  //   app.get(
  //     "/",
  //     { preHandler: [authorize(["admin", "vendedor"])] },
  //     makeListInventoryController(),
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
