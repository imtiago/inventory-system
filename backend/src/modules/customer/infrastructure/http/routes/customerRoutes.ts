import { FastifyInstance } from "fastify";
import { makeListCustomersController } from "../controllers/ListCustomersController";
import { makeGetCustomerController } from "../controllers/GetCustomerController";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateCustomerController } from "../controllers/CreateCustomerController";
import { makeUpdateCustomerController } from "../controllers/UpdateCustomerController";

export async function customerRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize("customers.write")] },
    makeCreateCustomerController(),
  );
  app.put(
    "/:id",
    { preHandler: [authorize("customers.write")] },
    makeUpdateCustomerController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize("customers.read")] },
    makeGetCustomerController(),
  );
  app.get(
    "/",
    { preHandler: [authorize("customers.read")] },
    makeListCustomersController(),
  );
}
