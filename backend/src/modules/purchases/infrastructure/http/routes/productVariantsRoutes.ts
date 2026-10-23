import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeGetProductVariantController } from "../controllers/GetProductVariantController";
import { makeDeleteProductVariantController } from "../controllers/DeleteProductVariantController";

export async function productVariantsRoutes(app: FastifyInstance) {
  app.get(
    "/:id",
    { preHandler: [authorize("catalog.read")] },
    makeGetProductVariantController(),
  );
  // app.put(
  //   "/:id",
  //   { preHandler: [authorize("catalog.write")] },
  //   makeUpdateProductController(),
  // );
  app.delete(
    "/:id",
    { preHandler: [authorize("catalog.delete")] },
    makeDeleteProductVariantController(),
  );
}
