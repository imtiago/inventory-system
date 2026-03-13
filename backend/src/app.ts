import Fastify from "fastify";
import { productRoutes } from "./modules/catalog/infrastructure/http/routes/productRoutes";
import { brandRoutes } from "./modules/catalog/infrastructure/http/routes/brandRoutes";
import { categoryRoutes } from "./modules/catalog/infrastructure/http/routes/categoryRoutes";
import { saleRoutes } from "./modules/sales/infrastructure/http/routes/saleRoutes";
import { inventoryRoutes } from "./modules/inventory/infrastructure/http/routes/inventoryRoutes";
import { customerRoutes } from "./modules/customer/infrastructure/http/routes/customerRoutes";
import { userRoutes } from "./modules/auth/infrastructure/http/routes/userRoutes";
import { authenticate } from "./shared/middleware/auth";

export const app = Fastify({
  logger: true,
});

// Lista de rotas públicas
const publicRoutes = [
  "/users", // criação de usuário
  "/auth/login", // login
];

// Middleware global
app.addHook("onRequest", async (request, reply) => {
  if (!publicRoutes.includes(request.url)) {
    await authenticate(request, reply);
  }
});

app.register(productRoutes, { prefix: "/products" });
app.register(brandRoutes, { prefix: "/brands" });
app.register(categoryRoutes, { prefix: "/categories" });
app.register(saleRoutes, { prefix: "/sales" });
app.register(customerRoutes, { prefix: "/customers" });
app.register(inventoryRoutes, { prefix: "/inventory" });
app.register(userRoutes);
