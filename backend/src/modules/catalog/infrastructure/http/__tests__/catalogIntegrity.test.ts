import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";

app.log.level = "silent";

describe("Catálogo: código de barras e edições concorrentes", () => {
  let productId: string;
  let variantId: string;
  let cleanupVariant: () => Promise<void>;
  let token: string;
  const createdVariantIds: string[] = [];

  before(async () => {
    ({ variantId, cleanup: cleanupVariant } = await createTestVariant());
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    productId = variant.productId;
    token = signTestToken(await getTestUserId());
  });

  after(async () => {
    try {
      await prisma.productVariant.deleteMany({ where: { id: { in: createdVariantIds } } });
    } finally {
      try {
        await cleanupVariant();
      } finally {
        await app.close();
        await prisma.$disconnect();
      }
    }
  });

  const call = (method: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${token}` } });

  const bc = () => `tx-${randomUUID()}`.slice(0, 30);

  test("barcode com mais de 64 caracteres → 400 no campo (criar e editar)", async () => {
    const long = "9".repeat(65);
    const created = await call("POST", `/products/${productId}/variants`, { name: "tx-test-bc", barcode: long });
    assert.equal(created.statusCode, 400, created.body);
    assert.ok(created.json().errors.some((e: { field: string }) => e.field === "barcode"));
    const edited = await call("PUT", `/variants/${variantId}`, { barcode: long });
    assert.equal(edited.statusCode, 400, edited.body);
    assert.ok(edited.json().errors.some((e: { field: string }) => e.field === "barcode"));
  });

  test("barcode é aparado (trim) ao criar e editar", async () => {
    const code = bc();
    const res = await call("POST", `/products/${productId}/variants`, { name: "tx-test-trim", barcode: `  ${code}  ` });
    assert.equal(res.statusCode, 201, res.body);
    createdVariantIds.push(res.json().data.id);
    assert.equal(res.json().data.barcode, code);
  });

  test("criação concorrente com o mesmo barcode: uma 201, as demais 409 BARCODE_ALREADY_EXISTS", async () => {
    const code = bc();
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => call("POST", `/products/${productId}/variants`, { name: `tx-test-race-${i}`, barcode: code })),
    );
    for (const r of results) if (r.statusCode === 201) createdVariantIds.push(r.json().data.id);
    assert.equal(results.filter((r) => r.statusCode === 201).length, 1, results.map((r) => r.body).join("\n"));
    for (const r of results.filter((r) => r.statusCode !== 201)) {
      assert.equal(r.statusCode, 409, r.body);
      assert.equal(r.json().code, "BARCODE_ALREADY_EXISTS");
      assert.equal(r.json().message, "Código de barras já cadastrado.");
    }
  });

  test("edição concorrente de barcode para o mesmo valor: uma 200, a outra 409 BARCODE_ALREADY_EXISTS", async () => {
    const a = await call("POST", `/products/${productId}/variants`, { name: "tx-test-a" });
    const b = await call("POST", `/products/${productId}/variants`, { name: "tx-test-b" });
    createdVariantIds.push(a.json().data.id, b.json().data.id);
    const code = bc();
    const [ra, rb] = await Promise.all([
      call("PUT", `/variants/${a.json().data.id}`, { barcode: code }),
      call("PUT", `/variants/${b.json().data.id}`, { barcode: code }),
    ]);
    assert.deepEqual([ra.statusCode, rb.statusCode].sort(), [200, 409], `${ra.body}\n${rb.body}`);
    const loser = ra.statusCode === 409 ? ra : rb;
    assert.equal(loser.json().code, "BARCODE_ALREADY_EXISTS");
  });

  test("edições concorrentes de campos diferentes da variante não se perdem", async () => {
    for (let i = 0; i < 5; i++) {
      const created = await call("POST", `/products/${productId}/variants`, { name: `tx-test-v-${i}` });
      const id = created.json().data.id;
      createdVariantIds.push(id);
      const code = bc();
      const name = `tx-test-renamed-${i}`;
      const [r1, r2] = await Promise.all([
        call("PUT", `/variants/${id}`, { name }),
        call("PUT", `/variants/${id}`, { barcode: code }),
      ]);
      assert.equal(r1.statusCode, 200, r1.body);
      assert.equal(r2.statusCode, 200, r2.body);
      const row = await prisma.productVariant.findUniqueOrThrow({ where: { id } });
      assert.equal(row.name, name);
      assert.equal(row.barcode, code);
    }
  });

  test("PUT completo da variante (nome, barcode e preço atual) continua aceito", async () => {
    const created = await call("POST", `/products/${productId}/variants`, { name: "tx-test-full", salePrice: 10 });
    const id = created.json().data.id;
    createdVariantIds.push(id);
    const code = bc();
    const res = await call("PUT", `/variants/${id}`, { name: "tx-test-full-2", barcode: code, salePrice: 10 });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.name, "tx-test-full-2");
    assert.equal(res.json().data.barcode, code);
    assert.equal(res.json().data.salePrice, 10);
  });

  test("edições concorrentes de nome e descrição do produto não se perdem", async () => {
    for (let i = 0; i < 5; i++) {
      const name = `tx-test-prod-${i}-${randomUUID().slice(0, 8)}`;
      const description = `desc-${i}`;
      const [r1, r2] = await Promise.all([
        call("PUT", `/products/${productId}`, { name }),
        call("PUT", `/products/${productId}`, { description }),
      ]);
      assert.equal(r1.statusCode, 200, r1.body);
      assert.equal(r2.statusCode, 200, r2.body);
      const row = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      assert.equal(row.name, name);
      assert.equal(row.description, description);
    }
  });
});
