import Fastify from "fastify";
import { registerErrorHandling } from "./shared/http/errorHandler";
import { productRoutes } from "./modules/catalog/infrastructure/http/routes/productRoutes";
import { brandRoutes } from "./modules/catalog/infrastructure/http/routes/brandRoutes";
import { categoryRoutes } from "./modules/catalog/infrastructure/http/routes/categoryRoutes";
import { saleRoutes } from "./modules/sales/infrastructure/http/routes/saleRoutes";
import { inventoryRoutes } from "./modules/inventory/infrastructure/http/routes/inventoryRoutes";
import { customerRoutes } from "./modules/customer/infrastructure/http/routes/customerRoutes";
import { userRoutes } from "./modules/auth/infrastructure/http/routes/userRoutes";
import { authenticate } from "./shared/middleware/auth";
import { payableRoutes } from "modules/finance/infrastructure/http/routes/payableRoutes";

import cors from "@fastify/cors";
import { importNfeRoutes } from "modules/nfe-import/infrastructure/http/routes/importNfeRoutes";
import { receivableRoutes } from "@finance/infrastructure/http/routes/receivableRoutes";
import { productVariantsRoutes } from "@catalog/infrastructure/http/routes/productVariantsRoutes";

export const app = Fastify({
  logger: true,
});

registerErrorHandling(app);
app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

// Lista de rotas públicas
const publicRoutes = [
  "/users", // criação de usuário
  "/auth/login", // login
];

// Middleware global
app.addHook("onRequest", async (request, reply) => {
  if (!publicRoutes.includes(request.url.split("?")[0])) {
    await authenticate(request);
  }
});

app.register(productRoutes, { prefix: "/products" });
app.register(productVariantsRoutes, { prefix: "/variants" });
app.register(brandRoutes, { prefix: "/brands" });
app.register(categoryRoutes, { prefix: "/categories" });
app.register(inventoryRoutes, { prefix: "/inventory" });

app.register(saleRoutes, { prefix: "/sales" });
app.register(customerRoutes, { prefix: "/customers" });
app.register(receivableRoutes, { prefix: "/receivables" });
// app.register(inventoryRoutes, { prefix: "/finance" });
// app.register(payableRoutes);
app.register(userRoutes);
app.register(importNfeRoutes);
