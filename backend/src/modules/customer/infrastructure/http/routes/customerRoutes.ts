import { FastifyInstance } from "fastify";
import { makeListCustomersController } from "../controllers/ListCustomersController";
import { makeGetCustomerController } from "../controllers/GetCustomerController";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateCustomerController } from "../controllers/CreateCustomerController";
import { makeUpdateCustomerController } from "../controllers/UpdateCustomerController";

export async function customerRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateCustomerController(),
  );
  app.put(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeUpdateCustomerController(),
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
