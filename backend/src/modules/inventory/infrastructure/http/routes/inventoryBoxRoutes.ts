import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { idempotent } from "@shared/http/idempotency/idempotent";
import { makeCreateInventoryBoxController } from "../controllers/CreateInventoryBoxController";
import { makeListInventoryBoxesController } from "../controllers/ListInventoryBoxesController";
import { makeAddProductToBoxController } from "../controllers/AddProductToBoxController";
import { makeRemoveProductFromBoxController } from "../controllers/RemoveProductFromBoxController";
import { makeGetInventoryBoxByCodeController } from "../controllers/GetInventoryBoxByCodeController";
import { makeGenerateInventoryBoxLabelController } from "../controllers/GenerateInventoryBoxLabelController";
import { makeGenerateInventoryProductLabelsController } from "../controllers/GenerateInventoryProductLabelsController";
import { makeGetInventoryBoxByLotAndProductVariantController } from "../controllers/GetInventoryBoxByLotAndProductVariantController";

export async function inventoryBoxRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authorize("inventory.read")] },
    makeListInventoryBoxesController(),
  );
  app.post(
    "/",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeCreateInventoryBoxController(), { keyOptional: true }),
  );
  app.post(
    "/:boxId/items",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeAddProductToBoxController()),
  );
  app.post(
    "/:boxId/items/remove",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeRemoveProductFromBoxController()),
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
}
