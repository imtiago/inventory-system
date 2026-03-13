import Fastify from "fastify";
import { productRoutes } from "./modules/catalog/interfaces/http/routes/productRoutes";
import { variantRoutes } from "./modules/catalog/interfaces/http/routes/variantRoutes";
import { inventoryRoutes } from "./modules/inventory/interfaces/http/routes/inventoryRoutes";

export const app = Fastify({
  logger: true,
});

app.register(productRoutes, {
  prefix: "/api",
});

app.register(productRoutes);
app.register(variantRoutes);
app.register(inventoryRoutes);
