// backend/src/modules/catalog/interfaces/http/routes/categoryRoutes.ts
import { FastifyInstance } from "fastify";
import { PrismaProductRepository } from "../../../infrastructure/repositories/PrismaProductRepository";
import { createCategorySchema } from "../../../interfaces/http/schemas/createCategorySchema";

export async function categoryRoutes(app: FastifyInstance) {
  const repo = new PrismaProductRepository();

  app.post("/", async (req, reply) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ errors: parsed.error.format() });

    const category = await repo.createCategory(parsed.data);
    return reply.status(201).send(category);
  });

  app.get("/", async (req, reply) => {
    const categories = await repo.listCategories();
    return reply.send(categories);
  });
}
