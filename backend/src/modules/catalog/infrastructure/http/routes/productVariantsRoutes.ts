import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeGetProductVariantController } from "../controllers/GetProductVariantController";
import { makeDeleteProductVariantController } from "../controllers/DeleteProductVariantController";
import { makeGetProductVariantByBarcodeController } from "../controllers/GetProductVariantByBarcodeController";

export async function productVariantsRoutes(app: FastifyInstance) {
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetProductVariantController(),
  );
  app.get(
    "/barcode/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetProductVariantByBarcodeController(),
  );
  // app.put(
  //   "/:id",
  //   { preHandler: [authorize(["admin", "vendedor"])] },
  //   makeUpdateProductController(),
  // );
  app.delete(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeDeleteProductVariantController(),
  );
}
