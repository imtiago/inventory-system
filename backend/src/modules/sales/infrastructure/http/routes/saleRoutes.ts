import { FastifyInstance } from "fastify";
import { makeCreateSaleController } from "../controllers/CreateSaleController";
import { makeListSalesController } from "../controllers/ListSalesController";
import { makeGetSaleController } from "../controllers/GetSaleController";
import { authorize } from "../../../../../shared/middleware/authorize";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { PrismaSaleRepository } from "../../prisma/repositories/PrismaSaleRepository";
import { PrismaReceivableRepository } from "modules/finance/infrastructure/repositories/PrismaReceivableRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export async function saleRoutes(app: FastifyInstance) {
  const inventoryRepo = new PrismaInventoryRepository();
  const saleRepo = new PrismaSaleRepository();
  const receivableRepository = new PrismaReceivableRepository();
  const transaction = new PrismaTransactionManager();

  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateSaleController(),
    // makeCreateSaleController(
    //   inventoryRepo,
    //   saleRepo,
    //   receivableRepository,
    //   transaction,
    // ),
  );
  // app.get(
  //   "/:id",
  //   { preHandler: [authorize(["admin", "vendedor"])] },
  //   makeGetSaleController(saleRepo),
  // );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListSalesController(),
  );
}
