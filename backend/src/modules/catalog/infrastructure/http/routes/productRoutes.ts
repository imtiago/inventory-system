import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { PrismaProductRepository } from "../../repositories/PrismaProductRepository";
import { makeCreateProductController } from "../controllers/CreateProductController";
import { makeListProductsController } from "../controllers/ListProductsController";
import { makeCreateVariantController } from "../controllers/CreateVariantController";
import { makeGetProductController } from "../controllers/GetProductController";
import { makeListProductVariantsController } from "../controllers/ListProductVariantsController";
import { makeUpdateProductController } from "../controllers/UpdateProductController";
import { makeDeleteProductController } from "../controllers/DeleteProductController";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/repositories/PrismaProductVariantRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaBrandRepository } from "@catalog/infrastructure/repositories/PrismaBrandRepository";
import { PrismaCategoryRepository } from "@catalog/infrastructure/repositories/PrismaCategoryRepository";

export async function productRoutes(app: FastifyInstance) {
  const brandRepo = new PrismaBrandRepository();
  const categoryRepo = new PrismaCategoryRepository();
  const productRepo = new PrismaProductRepository();
  const productVariantRepo = new PrismaProductVariantRepository();
  const inventoryRepo = new PrismaInventoryRepository();
  const transactionManager = new PrismaTransactionManager();

  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateProductController(
      brandRepo,
      categoryRepo,
      productRepo,
      productVariantRepo,
      inventoryRepo,
      transactionManager,
    ),
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListProductsController(productRepo),
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetProductController(productRepo),
  );
  app.put(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeUpdateProductController(productRepo),
  );
  app.delete(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeDeleteProductController(productRepo),
  );
  app.post(
    "/:productId/variants",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateVariantController(productRepo),
  );
  app.get(
    "/:productId/variants",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListProductVariantsController(productRepo),
  );
}
