// /src/modules/customer/infrastructure/http/routes/customerRoutes.ts
import { FastifyInstance } from "fastify";
import { makeListCustomersController } from "../controllers/ListCustomersController";
import { makeGetCustomerController } from "../controllers/GetCustomerController";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateCustomerController } from "../controllers/CreateCustomerController";
import { PrismaCustomerRepository } from "../../repositories/PrismaCustomerRepository";

export async function customerRoutes(app: FastifyInstance) {
  const repository = new PrismaCustomerRepository();

  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateCustomerController(repository),
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetCustomerController(repository),
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListCustomersController(repository),
  );
}
