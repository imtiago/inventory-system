// src/modules/auth/infrastructure/http/routes/userRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import { makeCreateUserController } from "../controllers/CreateUserController";
import { makeAuthenticateUserController } from "../controllers/AuthenticateUserController";
import { makeListUsersController } from "../controllers/ListUsersController";
import { makeGetMeController } from "../controllers/GetMeController";
import { makeGetUserController } from "../controllers/GetUserController";
import { makeUpdateUserController } from "../controllers/UpdateUserController";
import { makeResetUserPasswordController } from "../controllers/ResetUserPasswordController";
import { makeChangeOwnPasswordController } from "../controllers/ChangeOwnPasswordController";

// `authenticate` roda no hook global (app.ts) para toda rota não pública.
export async function userRoutes(app: FastifyInstance) {
  app.post("/auth/login", makeAuthenticateUserController());

  // próprio usuário (rotas estáticas têm prioridade sobre /users/:id)
  app.get("/users/me", { preHandler: [authorize("self")] }, makeGetMeController());
  app.put(
    "/users/me/password",
    { preHandler: [authorize("self")] },
    makeChangeOwnPasswordController(),
  );

  // administração de usuários
  app.post("/users", { preHandler: [authorize("users.manage")] }, makeCreateUserController());
  app.get("/users", { preHandler: [authorize("users.manage")] }, makeListUsersController());
  app.get("/users/:id", { preHandler: [authorize("users.manage")] }, makeGetUserController());
  app.patch("/users/:id", { preHandler: [authorize("users.manage")] }, makeUpdateUserController());
  app.post(
    "/users/:id/password",
    { preHandler: [authorize("users.manage")] },
    makeResetUserPasswordController(),
  );
}
