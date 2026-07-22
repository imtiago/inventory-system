// /src/modules/customer/infrastructure/http/routes/customerRoutes.ts
import { FastifyInstance } from "fastify";
import { makeListCustomersController } from "../controllers/ListCustomersController";
import { makeGetCustomerController } from "../controllers/GetCustomerController";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateCustomerController } from "../controllers/CreateCustomerController";

export async function customerRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateCustomerController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetCustomerController(),
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListCustomersController(),
  );
}
