// /src/modules/customer/infrastructure/http/routes/customerRoutes.ts
import { FastifyInstance } from "fastify";
import { CreateCustomerController } from "../controllers/CreateCustomerController";
import { ListCustomersController } from "../controllers/ListCustomersController";
import { GetCustomerController } from "../controllers/GetCustomerController";
import { authorize } from "../../../../../shared/middleware/authorize";

export async function customerRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    CreateCustomerController,
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    GetCustomerController,
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    ListCustomersController,
  );
}
