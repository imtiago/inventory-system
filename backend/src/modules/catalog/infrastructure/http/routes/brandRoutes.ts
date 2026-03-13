// backend/src/modules/catalog/interfaces/http/routes/brandRoutes.ts
import { FastifyInstance } from "fastify";
import { PrismaProductRepository } from "../../../infrastructure/repositories/PrismaProductRepository";
import { createBrandSchema } from "../../../interfaces/http/schemas/createBrandSchema";

export async function brandRoutes(app: FastifyInstance) {
  const repo = new PrismaProductRepository();

  app.post("/", async (req, reply) => {
    const parsed = createBrandSchema.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ errors: parsed.error.format() });

    const brand = await repo.createBrand(parsed.data);
    return reply.status(201).send(brand);
  });

  app.get("/", async (req, reply) => {
    const brands = await repo.listBrands();
    return reply.send(brands);
  });
}
