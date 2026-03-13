// backend/src/modules/inventory/__tests__/inventory.test.ts
import request from "supertest";
import { app } from "../../../app"; // ou seu app.ts
import { prisma } from "../../../shared/prisma";

describe("Inventory Module", () => {
  let variantId: string;

  beforeAll(async () => {
    // Cria um produto e variante de teste
    const product = await prisma.product.create({
      data: {
        name: "Test Product",
        brandId: "3746d94f-1086-40b2-8ffb-700ff9c8b712", // use IDs de seed
        categoryId: "529d6fc5-e7af-450e-b22d-e3a5b616e18b",
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        name: "Test Variant",
        sku: "TESTSKU123",
        productId: product.id,
      },
    });

    variantId = variant.id;
  });

  afterAll(async () => {
    // Limpeza de dados
    await prisma.stockMovement.deleteMany({});
    await prisma.inventory.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.$disconnect();
  });

  it("should add inventory", async () => {
    const res = await request(app)
      .post("/inventory/add")
      .send({ productVariantId: variantId, quantity: 10 });

    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(10);
  });

  it("should remove inventory", async () => {
    const res = await request(app)
      .post("/inventory/remove")
      .send({ productVariantId: variantId, quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(5);
  });

  it("should not remove more than available", async () => {
    const res = await request(app)
      .post("/inventory/remove")
      .send({ productVariantId: variantId, quantity: 100 });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Not enough stock to remove");
  });

  it("should get inventory", async () => {
    const res = await request(app).get(`/inventory/${variantId}`);

    expect(res.status).toBe(200);
    expect(res.body.productVariantId).toBe(variantId);
    expect(res.body.quantity).toBe(5);
  });
});
