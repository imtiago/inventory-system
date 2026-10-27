import { FastifyInstance } from "fastify";
import { hideTargetMarginFromNonAdmins } from "../targetMarginVisibility";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeGetProductVariantController } from "../controllers/GetProductVariantController";
import { makeUpdateVariantController } from "../controllers/UpdateVariantController";
import { makeDeleteProductVariantController } from "../controllers/DeleteProductVariantController";
import { makeGetProductVariantByBarcodeController } from "../controllers/GetProductVariantByBarcodeController";

export async function productVariantsRoutes(app: FastifyInstance) {
  hideTargetMarginFromNonAdmins(app);
  app.get(
    "/:id",
    { preHandler: [authorize("catalog.read")] },
    makeGetProductVariantController(),
  );
  app.get(
    "/barcode/:id",
    { preHandler: [authorize("catalog.read")] },
    makeGetProductVariantByBarcodeController(),
  );
  app.put(
    "/:id",
    { preHandler: [authorize("catalog.write")] },
    makeUpdateVariantController(),
  );
  app.delete(
    "/:id",
    { preHandler: [authorize("catalog.delete")] },
    makeDeleteProductVariantController(),
  );
}
