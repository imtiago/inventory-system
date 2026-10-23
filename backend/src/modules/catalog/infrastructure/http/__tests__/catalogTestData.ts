import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";

/**
 * Dados de catálogo `tx-test-*` criados direto no banco, com ids rastreados.
 * cleanup() apaga tudo o que foi registrado (inclusive o que o teste criou via
 * API, desde que registrado com trackProduct), em ordem de dependência.
 */
export function createCatalogTestData() {
  const brandIds: string[] = [];
  const categoryIds: string[] = [];
  const productIds: string[] = [];
  const saleIds: string[] = [];
  const customerIds: string[] = [];

  const tag = () => `tx-test-${randomUUID()}`;

  return {
    tag,
    async brand(name = tag()) {
      const b = await prisma.brand.create({ data: { name } });
      brandIds.push(b.id);
      return b;
    },
    async category(name = tag()) {
      const c = await prisma.category.create({ data: { name } });
      categoryIds.push(c.id);
      return c;
    },
    trackProduct(id: string) {
      productIds.push(id);
    },
    trackBrand(id: string) {
      brandIds.push(id);
    },
    trackCategory(id: string) {
      categoryIds.push(id);
    },
    /** Produto + variante padrão direto no banco. */
    async product(opts: { brandId: string; categoryId: string; name?: string; barcode?: string | null }) {
      const t = tag();
      const p = await prisma.product.create({
        data: {
          name: opts.name ?? t,
          code: `${t}-p`,
          brandId: opts.brandId,
          categoryId: opts.categoryId,
        },
      });
      productIds.push(p.id);
      const v = await prisma.productVariant.create({
        data: { name: "Padrão", code: `${t}-v`, productId: p.id, barcode: opts.barcode ?? null },
      });
      return { product: p, variant: v };
    },
    async variant(productId: string, name = "tx-test-variant") {
      const t = tag();
      return prisma.productVariant.create({ data: { name, code: `${t}-v`, productId } });
    },
    /** Registro de estoque zerado (não conta como uso). */
    async zeroInventory(productVariantId: string) {
      return prisma.inventory.create({ data: { productVariantId } });
    },
    /** Movimentação de estoque (conta como uso). */
    async movement(productVariantId: string) {
      const inv =
        (await prisma.inventory.findUnique({ where: { productVariantId } })) ??
        (await prisma.inventory.create({ data: { productVariantId } }));
      return prisma.stockMovement.create({
        data: { inventoryId: inv.id, productVariantId, type: "IN", origin: "MANUAL", quantity: 1 },
      });
    },
    /** Venda com um item da variante (conta como uso). */
    async sale(productVariantId: string) {
      const t = tag();
      const customer = await prisma.customer.create({ data: { name: t, code: t } });
      customerIds.push(customer.id);
      const sale = await prisma.sale.create({
        data: {
          customerId: customer.id,
          items: {
            create: [{ productVariantId, productName: t, quantity: 1, unitPrice: 1 }],
          },
        },
      });
      saleIds.push(sale.id);
      return sale;
    },
    async cleanup() {
      // Inclui produtos criados via API e não registrados (ex.: teste que falhou no meio).
      const strays = await prisma.product.findMany({
        where: { OR: [{ brandId: { in: brandIds } }, { categoryId: { in: categoryIds } }] },
        select: { id: true },
      });
      productIds.push(...strays.map((p) => p.id));
      const variants = await prisma.productVariant.findMany({
        where: { productId: { in: productIds } },
        select: { id: true },
      });
      const variantWhere = { productVariantId: { in: variants.map((v) => v.id) } };
      await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
      await prisma.inventoryBoxStock.deleteMany({ where: { inventoryLot: variantWhere } });
      await prisma.stockMovement.deleteMany({ where: variantWhere });
      await prisma.inventoryLot.deleteMany({ where: variantWhere });
      await prisma.inventory.deleteMany({ where: variantWhere });
      await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
      await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
    },
  };
}
