import "./shared/config/zod";
import Fastify from "fastify";
import { registerErrorHandling } from "./shared/http/errorHandler";
import { productRoutes } from "./modules/catalog/infrastructure/http/routes/productRoutes";
import { brandRoutes } from "./modules/catalog/infrastructure/http/routes/brandRoutes";
import { categoryRoutes } from "./modules/catalog/infrastructure/http/routes/categoryRoutes";
import { saleRoutes } from "./modules/sales/infrastructure/http/routes/saleRoutes";
import { inventoryRoutes } from "./modules/inventory/infrastructure/http/routes/inventoryRoutes";
import { customerRoutes } from "./modules/customer/infrastructure/http/routes/customerRoutes";
import { supplierRoutes } from "./modules/purchases/infrastructure/http/routes/supplierRoutes";
import { purchaseRoutes } from "./modules/purchases/infrastructure/http/routes/purchaseRoutes";
import { userRoutes } from "./modules/auth/infrastructure/http/routes/userRoutes";
import { authenticate } from "./shared/middleware/auth";

import cors from "@fastify/cors";
import { nfeImportRoutes } from "@nfe-import/infrastructure/http/routes/nfeImportRoutes";
import { payableRoutes, receivableRoutes } from "@finance/infrastructure/http/routes/financialDocumentRoutes";
import { dashboardRoutes } from "./modules/dashboard/infrastructure/http/routes/dashboardRoutes";
import { productVariantsRoutes } from "@catalog/infrastructure/http/routes/productVariantsRoutes";

export const app = Fastify({
  logger: true,
});

registerErrorHandling(app);
app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

// Única rota pública: login. Todas as demais passam por `authenticate`.
const publicRoutes = ["/auth/login"];

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
app.register(supplierRoutes, { prefix: "/suppliers" });
app.register(purchaseRoutes, { prefix: "/purchases" });
app.register(receivableRoutes, { prefix: "/receivables" });
app.register(payableRoutes, { prefix: "/payables" });
// app.register(inventoryRoutes, { prefix: "/finance" });
app.register(userRoutes);
app.register(nfeImportRoutes, { prefix: "/nfe-imports" });
app.register(dashboardRoutes, { prefix: "/dashboard" });
