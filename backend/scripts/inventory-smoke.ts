import "dotenv/config";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = "tx-test-inventory@local";

let failures = 0;
let token = "";

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`    ${ok ? "OK  " : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

async function call(method: string, path: string, expectedStatus: number, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get("content-type") ?? "";
  let json: any = null;
  if (contentType.includes("application/json")) json = await res.json();
  else await res.arrayBuffer();
  const ok = res.status === expectedStatus;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${method} ${path} -> ${res.status}${ok ? "" : ` (expected ${expectedStatus})`} ${json && !ok ? JSON.stringify(json) : ""}`);
  return { status: res.status, json, contentType };
}

async function main() {
  const stamp = Date.now();
  const tag = `tx-test-${stamp}`;
  const barcode = `tx-test-${stamp}`;
  const ids: { brand?: string; category?: string; product?: string; variant?: string; box?: string } = {};
  let lotIds: string[] = [];

  try {
    const user = await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      update: {},
      create: { name: "tx-test-inventory", email: TEST_EMAIL, password: "tx-test", role: "ADMIN" },
    });
    token = jwt.sign({ sub: user.id, role: "admin" }, process.env.JWT_SECRET || "secret");

    ids.brand = (await prisma.brand.create({ data: { name: tag } })).id;
    ids.category = (await prisma.category.create({ data: { name: tag } })).id;
    ids.product = (await prisma.product.create({ data: { name: tag, code: `${tag}-p`, brandId: ids.brand, categoryId: ids.category } })).id;
    const variant = await prisma.productVariant.create({ data: { name: tag, code: `${tag}-v`, barcode, productId: ids.product } });
    ids.variant = variant.id;
    console.log(`setup: variant ${variant.id} code ${variant.code} barcode ${barcode}`);

    // 1. barcode lookup
    const r1 = await call("GET", `/variants/barcode/${encodeURIComponent(barcode)}`, 200);
    check("variant id", r1.json?.data?.id, variant.id);

    // 2. create lot
    const r2 = await call("POST", "/inventory/lots", 200, {
      productVariantId: variant.id,
      batchNumber: "L-SMOKE",
      quantity: 10,
      unitCost: 5,
      expirationDate: "2028-09-15",
    });
    const lot = r2.json?.data;
    check("lot remainingQuantity", lot?.remainingQuantity, 10);
    check("lot allocatedQuantity", lot?.allocatedQuantity, 0);

    // 3. list lots
    const r3 = await call("GET", `/inventory/variants/${variant.id}/lots`, 200);
    const listed = (r3.json?.data ?? []).find((l: any) => l.id === lot?.id);
    check("listed lot remainingQuantity", listed?.remainingQuantity, 10);

    // 4. create box
    const r4 = await call("POST", "/inventory/boxes", 200, {});
    const box = r4.json?.data;
    ids.box = box?.id;
    console.log(`    box ${box?.code}`);

    // 5. search box
    const r5 = await call("GET", `/inventory/boxes?search=${encodeURIComponent(box?.code ?? "")}`, 200);
    check("search finds box", (r5.json?.data ?? []).some((b: any) => b.id === box?.id), true);

    // 6. add within limit
    const r6 = await call("POST", `/inventory/boxes/${box?.id}/items`, 200, { inventoryLotId: lot?.id, quantity: 4 });
    check("box item quantity", r6.json?.data?.quantity, 4);
    const r6b = await call("GET", `/inventory/variants/${variant.id}/lots`, 200);
    const after = (r6b.json?.data ?? []).find((l: any) => l.id === lot?.id);
    check("lot allocatedQuantity after add", after?.allocatedQuantity, 4);
    check("lot remainingQuantity after add", after?.remainingQuantity, 10);

    // 7. above limit (10 - 4 = 6 available; try 7)
    const r7 = await call("POST", `/inventory/boxes/${box?.id}/items`, 400, { inventoryLotId: lot?.id, quantity: 7 });
    check("limit message", r7.json?.message, "Quantidade excede o saldo do lote disponível para caixas (6).");

    // 8. inventory details
    const r8 = await call("GET", `/inventory/${lot?.inventoryId}`, 200);
    check("inventory quantity", r8.json?.data?.quantity, 10);
    check("inventory availableQuantity", r8.json?.data?.availableQuantity, 10);

    // 9. product labels
    const r9 = await call("POST", `/inventory/boxes/code/${encodeURIComponent(box?.code ?? "")}/product-labels`, 200, { productCode: variant.code, quantity: 1 });
    check("labels content-type", r9.contentType.split(";")[0], "application/pdf");
  } catch (e) {
    failures++;
    console.error("FAIL unexpected error:", e);
  } finally {
    try {
      if (ids.variant) {
        const v = ids.variant;
        lotIds = (await prisma.inventoryLot.findMany({ where: { productVariantId: v }, select: { id: true } })).map((l) => l.id);
        await prisma.inventoryBoxStock.deleteMany({ where: { inventoryLotId: { in: lotIds } } });
        await prisma.stockMovement.deleteMany({ where: { productVariantId: v } });
        await prisma.inventoryLot.deleteMany({ where: { productVariantId: v } });
        await prisma.inventory.deleteMany({ where: { productVariantId: v } });
        await prisma.productVariant.deleteMany({ where: { id: v } });
      }
      if (ids.box) await prisma.inventoryBox.deleteMany({ where: { id: ids.box } });
      if (ids.product) await prisma.product.deleteMany({ where: { id: ids.product } });
      if (ids.category) await prisma.category.deleteMany({ where: { id: ids.category } });
      if (ids.brand) await prisma.brand.deleteMany({ where: { id: ids.brand } });
      console.log("cleanup: done");
    } catch (e) {
      failures++;
      console.error("FAIL cleanup error:", e);
    }
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "SMOKE PASSED" : `SMOKE FAILED (${failures} failure(s))`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
