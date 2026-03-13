import Fastify from "fastify";
import { productRoutes } from "./modules/catalog/interfaces/http/routes/productRoutes";
import { inventoryRoutes } from "./modules/inventory/interfaces/http/routes/inventoryRoutes";
import { brandRoutes } from "./modules/catalog/interfaces/http/routes/brandRoutes";
import { categoryRoutes } from "./modules/catalog/interfaces/http/routes/categoryRoutes";

export const app = Fastify({
  logger: true,
});

app.register(productRoutes, {
  prefix: "/api",
});

app.register(productRoutes, { prefix: "/products" });
app.register(brandRoutes, { prefix: "/brands" });
app.register(categoryRoutes, { prefix: "/categories" });
app.register(inventoryRoutes);
