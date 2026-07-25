import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeGetProductVariantController } from "../controllers/GetProductVariantController";
import { makeDeleteProductVariantController } from "../controllers/DeleteProductVariantController";

export async function productVariantsRoutes(app: FastifyInstance) {
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetProductVariantController(),
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
