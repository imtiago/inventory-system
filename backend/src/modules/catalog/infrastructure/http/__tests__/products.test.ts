import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createCatalogTestData } from "./catalogTestData";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/catalog/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

describe("Produtos (/products)", () => {
  const data = createCatalogTestData();
  let admin: TestUser;
  let vendedor: TestUser;

  const call = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    payload?: object,
    token: string = admin.token,
  ) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } });

  const createViaApi = async (payload: object) => {
    const res = await call("POST", "/products", payload);
    assert.equal(res.statusCode, 201, res.body);
    data.trackProduct(res.json().data.id);
    return res.json().data;
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
  });

  after(async () => {
    try {
      await data.cleanup();
    } finally {
      await admin.cleanup();
      await vendedor.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("POST /products → 201 { data } completo (marca/categoria), nome com trim e descrição vazia → null", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const created = await createViaApi({
      name: "  tx-test-criado  ",
      description: "   ",
      brandId: brand.id,
      categoryId: category.id,
    });
    assert.equal(created.name, "tx-test-criado");
    assert.equal(created.description, null);
    assert.deepEqual(created.brand, { id: brand.id, name: brand.name });
    assert.deepEqual(created.category, { id: category.id, name: category.name });
    assert.equal(created.variantsCount, 1);
    assert.ok(created.createdAt);
  });

  test("VENDEDOR cria produto com preço de venda → a variante Padrão nasce precificada", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const res = await call("POST", "/products", { name: "tx-test-com-preco", brandId: brand.id, categoryId: category.id, salePrice: 25.9 }, vendedor.token);
    assert.equal(res.statusCode, 201, res.body);
    data.trackProduct(res.json().data.id);
    const variants = await call("GET", `/products/${res.json().data.id}/variants?page=1&limit=10`);
    assert.equal(variants.json().data[0].salePrice, 25.9);
    assert.equal(variants.json().data[0].name, "Padrão");
  });

  test("POST /products com preço negativo → 400", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const res = await call("POST", "/products", { name: "tx-test-preco-neg", brandId: brand.id, categoryId: category.id, salePrice: -1 });
    assert.equal(res.statusCode, 400, res.body);
  });

  test("POST /products com marca inexistente → 404 BRAND_NOT_FOUND; descrição > 500 → 400", async () => {
    const category = await data.category();
    const res = await call("POST", "/products", {
      name: "tx-test-sem-marca",
      brandId: randomUUID(),
      categoryId: category.id,
    });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, "BRAND_NOT_FOUND");

    const brand = await data.brand();
    const long = await call("POST", "/products", {
      name: "tx-test-longo",
      description: "x".repeat(501),
      brandId: brand.id,
      categoryId: category.id,
    });
    assert.equal(long.statusCode, 400);
    assert.ok(long.json().errors.some((e: { field: string }) => e.field === "description"));
  });

  test("PUT /products/:id só com brandId troca a marca e mantém nome/descrição/categoria", async () => {
    const brandA = await data.brand();
    const brandB = await data.brand();
    const category = await data.category();
    const created = await createViaApi({
      name: "tx-test-put",
      description: "descrição original",
      brandId: brandA.id,
      categoryId: category.id,
    });

    const res = await call("PUT", `/products/${created.id}`, { brandId: brandB.id });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json().data;
    assert.deepEqual(body.brand, { id: brandB.id, name: brandB.name });
    assert.equal(body.name, "tx-test-put");
    assert.equal(body.description, "descrição original");
    assert.deepEqual(body.category, { id: category.id, name: category.name });
    assert.equal(body.code, created.code);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(row.brandId, brandB.id);
    assert.equal(row.name, "tx-test-put");
    assert.equal(row.description, "descrição original");
    assert.equal(row.categoryId, category.id);
  });

  test("PUT /products/:id altera nome/descrição; descrição vazia → null", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const created = await createViaApi({ name: "tx-test-ren", description: "algo", brandId: brand.id, categoryId: category.id });

    const res = await call("PUT", `/products/${created.id}`, { name: " tx-test-renomeado ", description: "" });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.name, "tx-test-renomeado");
    assert.equal(res.json().data.description, null);
  });

  test("PUT /products/:id com marca inexistente → 404 BRAND_NOT_FOUND; corpo vazio → 400", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const created = await createViaApi({ name: "tx-test-put404", brandId: brand.id, categoryId: category.id });

    const noBrand = await call("PUT", `/products/${created.id}`, { brandId: randomUUID() });
    assert.equal(noBrand.statusCode, 404);
    assert.equal(noBrand.json().code, "BRAND_NOT_FOUND");

    const noCategory = await call("PUT", `/products/${created.id}`, { categoryId: randomUUID() });
    assert.equal(noCategory.statusCode, 404);
    assert.equal(noCategory.json().code, "CATEGORY_NOT_FOUND");

    const noProduct = await call("PUT", `/products/${randomUUID()}`, { name: "tx-test-x" });
    assert.equal(noProduct.statusCode, 404);
    assert.equal(noProduct.json().code, "PRODUCT_NOT_FOUND");

    const empty = await call("PUT", `/products/${created.id}`, {});
    assert.equal(empty.statusCode, 400);
    assert.equal(empty.json().code, "VALIDATION_ERROR");

    const short = await call("PUT", `/products/${created.id}`, { name: "ab" });
    assert.equal(short.statusCode, 400);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(row.brandId, brand.id);
    assert.equal(row.name, "tx-test-put404");
  });

  test("GET /products/:id → { data } com brand e category; chaves = fixture productDetail", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const created = await createViaApi({ name: "tx-test-detalhe", description: "d", brandId: brand.id, categoryId: category.id });

    const res = await call("GET", `/products/${created.id}`);
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.deepEqual(body.data.brand, { id: brand.id, name: brand.name });
    assert.deepEqual(body.data.category, { id: category.id, name: category.name });
    assert.equal(body.data.variantsCount, 1);
    assert.deepEqual(keyShape(body), keyShape(loadFixture("productDetail")));
  });

  test("GET /products?search= encontra por nome, código do produto e código de barras; limit=101 → 400", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const unique = randomUUID();
    const byName = await data.product({ brandId: brand.id, categoryId: category.id, name: `tx-test-nome-${unique}` });
    const byCode = await data.product({ brandId: brand.id, categoryId: category.id });
    const barcode = `tx-test-bc-${randomUUID()}`;
    const byBarcode = await data.product({ brandId: brand.id, categoryId: category.id, barcode });

    const ids = async (search: string) => {
      const res = await call("GET", `/products?search=${encodeURIComponent(search)}&limit=100`);
      assert.equal(res.statusCode, 200, res.body);
      return res.json().data.map((p: { id: string }) => p.id);
    };

    assert.deepEqual(await ids(`NOME-${unique.toUpperCase()}`), [byName.product.id]);
    assert.deepEqual(await ids(byCode.product.code.toUpperCase()), [byCode.product.id]);
    assert.deepEqual(await ids(barcode.toUpperCase()), [byBarcode.product.id]);
    // trecho do código de barras também encontra
    assert.deepEqual(await ids(barcode.slice(11, 30)), [byBarcode.product.id]);

    const tooMany = await call("GET", "/products?limit=101");
    assert.equal(tooMany.statusCode, 400);
    assert.equal(tooMany.json().code, "VALIDATION_ERROR");
  });

  test("GET /products?search= é literal: %, _ e \\ não viram curingas", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const u = randomUUID();
    const literal = await data.product({ brandId: brand.id, categoryId: category.id, name: `tx-test-${u}-50%_a\\b` });
    const other = await data.product({ brandId: brand.id, categoryId: category.id, name: `tx-test-${u}-50Xzab` });
    const ids = async (search: string) => {
      const res = await call("GET", `/products?search=${encodeURIComponent(search)}&limit=100`);
      assert.equal(res.statusCode, 200, res.body);
      return res.json().data.map((p: { id: string }) => p.id).sort();
    };
    assert.deepEqual(await ids(`${u}-50%_a\\b`), [literal.product.id]);
    assert.deepEqual(await ids(`${u}-50%`), [literal.product.id]);
    assert.deepEqual(await ids(`${u}-50_`), []);
    assert.deepEqual(await ids(`${u}-50`), [literal.product.id, other.product.id].sort());
  });

  test("GET /products?brandId=&categoryId= filtra; chaves = fixture productList", async () => {
    const brand = await data.brand();
    const otherBrand = await data.brand();
    const catX = await data.category();
    const catY = await data.category();
    const a = await data.product({ brandId: brand.id, categoryId: catX.id });
    const b = await data.product({ brandId: brand.id, categoryId: catY.id });
    await data.product({ brandId: otherBrand.id, categoryId: catY.id });

    const byBrand = await call("GET", `/products?brandId=${brand.id}`);
    assert.equal(byBrand.statusCode, 200, byBrand.body);
    assert.deepEqual(
      byBrand.json().data.map((p: { id: string }) => p.id).sort(),
      [a.product.id, b.product.id].sort(),
    );
    assert.equal(byBrand.json().pagination.total, 2);
    assert.deepEqual(keyShape(byBrand.json()), keyShape(loadFixture("productList")));

    const both = await call("GET", `/products?brandId=${brand.id}&categoryId=${catY.id}`);
    assert.deepEqual(both.json().data.map((p: { id: string }) => p.id), [b.product.id]);

    const byCategory = await call("GET", `/products?categoryId=${catY.id}`);
    assert.equal(byCategory.json().pagination.total, 2);

    const invalid = await call("GET", "/products?brandId=nao-e-uuid");
    assert.equal(invalid.statusCode, 400);
  });

  test("GET /products/:productId/variants → chaves = fixture variantList", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const { product } = await data.product({ brandId: brand.id, categoryId: category.id, barcode: `tx-test-${randomUUID()}` });
    const res = await call("GET", `/products/${product.id}/variants?page=1&limit=10`);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().pagination.total, 1);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("variantList")));
  });

  test("DELETE /products/:id sem uso → 204 e variantes/estoque zerado somem", async () => {
    const brand = await data.brand();
    const category = await data.category();
    const { product, variant } = await data.product({ brandId: brand.id, categoryId: category.id });
    const second = await data.variant(product.id);
    await data.zeroInventory(variant.id);

    const forbidden = await call("DELETE", `/products/${product.id}`, undefined, vendedor.token);
    assert.equal(forbidden.statusCode, 403);

    const res = await call("DELETE", `/products/${product.id}`);
    assert.equal(res.statusCode, 204, res.body);
    assert.equal(await prisma.product.count({ where: { id: product.id } }), 0);
    assert.equal(await prisma.productVariant.count({ where: { id: { in: [variant.id, second.id] } } }), 0);
    assert.equal(await prisma.inventory.count({ where: { productVariantId: variant.id } }), 0);

    const again = await call("DELETE", `/products/${product.id}`);
    assert.equal(again.statusCode, 404);
    assert.equal(again.json().code, "PRODUCT_NOT_FOUND");
  });

  test("DELETE /products/:id com movimentação ou venda → 409 PRODUCT_IN_USE e nada apagado", async () => {
    const brand = await data.brand();
    const category = await data.category();

    // movimentação numa variante que não é a padrão
    const withMovement = await data.product({ brandId: brand.id, categoryId: category.id });
    const moved = await data.variant(withMovement.product.id);
    await data.movement(moved.id);

    const res = await call("DELETE", `/products/${withMovement.product.id}`);
    assert.equal(res.statusCode, 409, res.body);
    assert.deepEqual(res.json(), {
      message: "Produto possui movimentações, vendas ou compras e não pode ser excluído.",
      code: "PRODUCT_IN_USE",
    });
    assert.equal(await prisma.product.count({ where: { id: withMovement.product.id } }), 1);
    assert.equal(await prisma.productVariant.count({ where: { productId: withMovement.product.id } }), 2);
    assert.equal(await prisma.inventory.count({ where: { productVariantId: moved.id } }), 1);

    // venda
    const withSale = await data.product({ brandId: brand.id, categoryId: category.id });
    await data.sale(withSale.variant.id);
    const sold = await call("DELETE", `/products/${withSale.product.id}`);
    assert.equal(sold.statusCode, 409);
    assert.equal(sold.json().code, "PRODUCT_IN_USE");
    assert.equal(await prisma.productVariant.count({ where: { productId: withSale.product.id } }), 1);

    // estoque com saldo (sem movimentação)
    const withStock = await data.product({ brandId: brand.id, categoryId: category.id });
    await prisma.inventory.create({ data: { productVariantId: withStock.variant.id, quantity: 3 } });
    const stocked = await call("DELETE", `/products/${withStock.product.id}`);
    assert.equal(stocked.statusCode, 409);
    assert.equal(stocked.json().code, "PRODUCT_IN_USE");
  });
});
