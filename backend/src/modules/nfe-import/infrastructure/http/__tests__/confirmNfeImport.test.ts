import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { randomCnpj } from "../../../../../test/documentFixtures";
import { BOUNDARY, multipart, newNote, Note, noteXml, randomBarcode } from "./nfeTestNotes";

app.log.level = "silent";

/*
 * Nota base (nfe-completa.xml), custos por item na composição do vNF (centavos):
 *  1 A-001 CX 2      vProd 24100 vDesc 1100 vFrete 500 IPI 1205           → 24705 (lotes L001 1, L002 1)
 *  2 B-002 KG 10,5   vProd 4190  frete+seg+outro 350, ST+FCPST 714        → 5254
 *  3 C-003 UN 1      vProd 9999  vDesc 99, vICMSDeson deduzido 150        → 9750
 *  vNF 39709; duplicatas 132,36 / 132,36 / 132,37.
 */

describe("Confirmação de importação de NF-e (POST /nfe-imports/:id/confirm)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let brandId: string;
  let categoryId: string;
  let existingProductId: string;
  const tag = () => `tx-test-${randomUUID()}`;
  const importKeys: string[] = [];
  const supplierDocuments: string[] = [];
  const variantCleanups: (() => Promise<void>)[] = [];

  const call = (method: "GET" | "POST", url: string, payload?: object, user = admin) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${user.token}` }, payload });

  const uploadNote = async (note: Note, mutate?: (xml: string) => string) => {
    importKeys.push(note.key);
    supplierDocuments.push(note.cnpj);
    const res = await app.inject({
      method: "POST",
      url: "/nfe-imports",
      headers: {
        authorization: `Bearer ${admin.token}`,
        "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipart([{ name: "file", filename: "nota.xml", contentType: "application/xml", content: noteXml(note, mutate) }]),
    });
    assert.ok([200, 201].includes(res.statusCode), res.body);
    return res.json().data;
  };

  const confirm = (importId: string, body: object, user = admin) =>
    call("POST", `/nfe-imports/${importId}/confirm`, body, user);

  const createSupplier = async (document: string) => {
    supplierDocuments.push(document);
    return prisma.supplier.create({ data: { name: tag(), document } });
  };

  const existingVariant = async (barcode?: string) => {
    const { variantId, cleanup } = await createTestVariant();
    variantCleanups.push(cleanup);
    if (barcode) await prisma.productVariant.update({ where: { id: variantId }, data: { barcode } });
    return variantId;
  };

  const newProduct = (name = tag()) => ({ name, brandId, categoryId });

  const payableOf = async (purchaseId: string) =>
    prisma.financialDocument.findFirstOrThrow({
      where: { originType: "PURCHASE", originId: purchaseId },
      include: { parcels: { orderBy: { dueDate: "asc" } } },
    });

  const parcelsOf = async (purchaseId: string) =>
    (await payableOf(purchaseId)).parcels.map((p) => [p.dueDate.toISOString().slice(0, 10), p.amount.toNumber()]);

  const purchaseItems = async (purchaseId: string) =>
    prisma.purchaseItem.findMany({ where: { purchaseId } });

  const asNumbers = (item: { quantity: number; unitPrice: any; discount: any; freight: any; tax: any; total: any; unitCost: any }) => ({
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount),
    freight: Number(item.freight),
    tax: Number(item.tax),
    total: Number(item.total),
    unitCost: Number(item.unitCost),
  });

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    brandId = (await prisma.brand.create({ data: { name: tag() } })).id;
    categoryId = (await prisma.category.create({ data: { name: tag() } })).id;
    const t = tag();
    existingProductId = (
      await prisma.product.create({ data: { name: t, code: `${t}-p`, brandId, categoryId } })
    ).id;
    await prisma.productVariant.create({ data: { name: "Padrão", code: `${t}-v`, productId: existingProductId } });
  });

  after(async () => {
    try {
      const suppliers = await prisma.supplier.findMany({ where: { document: { in: supplierDocuments } } });
      const supplierIds = suppliers.map((s) => s.id);
      const purchases = await prisma.purchase.findMany({ where: { supplierId: { in: supplierIds } } });
      const purchaseIds = purchases.map((p) => p.id);
      const ourVariants = await prisma.productVariant.findMany({ where: { product: { brandId } } });
      const linkedVariants = await prisma.purchaseItem.findMany({ where: { purchaseId: { in: purchaseIds } } });
      const variantIds = [...new Set([...ourVariants.map((v) => v.id), ...linkedVariants.map((i) => i.productVariantId)])];

      const documents = { originType: "PURCHASE" as const, originId: { in: purchaseIds } };
      await prisma.payment.deleteMany({ where: { parcel: { document: documents } } });
      await prisma.financialParcel.deleteMany({ where: { document: documents } });
      await prisma.financialDocument.deleteMany({ where: documents });
      await prisma.stockMovement.deleteMany({ where: { productVariantId: { in: variantIds } } });
      await prisma.inventoryLot.deleteMany({ where: { productVariantId: { in: variantIds } } });
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
      await prisma.nfeImport.deleteMany({ where: { accessKey: { in: importKeys } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.supplierProductMapping.deleteMany({ where: { supplierId: { in: supplierIds } } });
      await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
      await prisma.inventory.deleteMany({ where: { productVariant: { product: { brandId } } } });
      await prisma.productVariant.deleteMany({ where: { product: { brandId } } });
      await prisma.product.deleteMany({ where: { brandId } });
      await prisma.category.deleteMany({ where: { id: categoryId } });
      await prisma.brand.deleteMany({ where: { id: brandId } });
      for (const cleanup of variantCleanups) await cleanup();
    } finally {
      await admin.cleanup();
      await vendedor.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("confirmar com fornecedor novo cria fornecedor, produto, variante, mapeamento, pedido XML e contas a pagar com as duplicatas", async () => {
    const note = newNote();
    const draft = await uploadNote(note);
    const linked = await existingVariant();
    const productName = tag();

    const res = await confirm(draft.id, {
      supplier: { create: { name: "  Distribuidora   Nova  ", email: "Compras@Nova.com.br", phone: "(11) 3333-4444" } },
      items: [
        {
          index: 1,
          create: { newProduct: { ...newProduct(productName), description: "Da nota" }, variantName: "300ml", salePrice: 19.9, unitsPerPackage: 12 },
        },
        { index: 2, link: { productVariantId: linked, unitsPerPackage: 2 } },
        { index: 3, create: { productId: existingProductId, variantName: "200ml", salePrice: 15 } },
      ],
      receive: false,
    });
    assert.equal(res.statusCode, 201, res.body);
    const { importId, purchaseId } = res.json().data;
    assert.deepEqual(res.json(), { data: { importId: draft.id, purchaseId } });

    // Fornecedor com o documento da nota.
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { document: note.cnpj } });
    assert.deepEqual([supplier.name, supplier.email, supplier.phone], ["Distribuidora Nova", "compras@nova.com.br", "1133334444"]);

    // Produto novo com exatamente uma variante (sem a "Padrão" automática); barcode padrão = o da nota.
    const product = await prisma.product.findFirstOrThrow({ where: { name: productName }, include: { variants: true } });
    assert.equal(product.description, "Da nota");
    assert.equal(product.variants.length, 1);
    const [v1] = product.variants;
    assert.deepEqual([v1.name, v1.barcode, v1.salePrice.toNumber()], ["300ml", note.barcode1, 19.9]);
    // Variante criada em produto existente; item 3 não tem cEAN (só cEANTrib) → barcode da nota.
    const v3 = await prisma.productVariant.findFirstOrThrow({ where: { productId: existingProductId, name: "200ml" } });
    assert.deepEqual([v3.barcode, v3.salePrice.toNumber()], [note.barcode3, 15]);

    // Mapeamentos (fornecedor, código) → variante, unidades por embalagem.
    const mappings = await prisma.supplierProductMapping.findMany({
      where: { supplierId: supplier.id },
      orderBy: { supplierCode: "asc" },
    });
    assert.deepEqual(
      mappings.map((m) => [m.supplierCode, m.productVariantId, m.unitsPerPackage]),
      [
        ["A-001", v1.id, 12],
        ["B-002", linked, 2],
        ["C-003", v3.id, 1],
      ],
    );

    // Pedido XML, data = emissão, observação, PENDING (sem entrada).
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    assert.deepEqual(
      [purchase.origin, purchase.status, purchase.supplierId, purchase.purchaseDate.toISOString().slice(0, 10), purchase.notes],
      ["XML", "PENDING", supplier.id, "2026-10-23", "NF-e 12345/1"],
    );
    assert.equal(purchase.totalAmount.toNumber(), 397.09);
    assert.equal(await prisma.stockMovement.count({ where: { originId: purchaseId } }), 0);

    // Contas a pagar com as duplicatas da nota.
    assert.deepEqual(await parcelsOf(purchaseId), [
      ["2026-11-22", 132.36],
      ["2026-12-22", 132.36],
      ["2027-01-21", 132.37],
    ]);
    const payable = await payableOf(purchaseId);
    assert.deepEqual([payable.type, payable.partyType, payable.partyId], ["PAYABLE", "SUPPLIER", supplier.id]);

    // Rascunho → CONFIRMED.
    const row = await prisma.nfeImport.findUniqueOrThrow({ where: { id: importId } });
    assert.equal(row.status, "CONFIRMED");
    assert.equal(row.purchaseId, purchaseId);
    assert.equal(row.confirmedById, admin.id);
    assert.ok(row.confirmedAt instanceof Date);
    const get = await call("GET", `/nfe-imports/${importId}`);
    assert.deepEqual([get.json().data.status, get.json().data.purchaseId], ["CONFIRMED", purchaseId]);

    // Confirmar de novo → 409; reenviar a chave → 409 NFE_ALREADY_IMPORTED.
    const again = await confirm(importId, {
      supplier: { id: supplier.id },
      items: [1, 2, 3].map((index) => ({ index, link: { productVariantId: linked, unitsPerPackage: index === 2 ? 2 : 1 } })),
      receive: false,
    });
    assert.equal(again.statusCode, 409, again.body);
    assert.deepEqual(again.json(), { message: "Importação já confirmada.", code: "NFE_IMPORT_CONFIRMED" });
  });

  test("caixa com 12 unidades: 2 CX → 24 unidades, custo unitário = custo/24 no pedido e no estoque", async () => {
    const note = newNote();
    const supplier = await createSupplier(note.cnpj);
    const draft = await uploadNote(note);
    const [box, bulk, unit] = [await existingVariant(), await existingVariant(), await existingVariant()];

    const res = await confirm(draft.id, {
      supplier: { id: supplier.id },
      items: [
        { index: 1, link: { productVariantId: box, unitsPerPackage: 12 } },
        { index: 2, link: { productVariantId: bulk, unitsPerPackage: 2 } },
        { index: 3, link: { productVariantId: unit } },
      ],
      receive: true,
    });
    assert.equal(res.statusCode, 201, res.body);
    const { purchaseId } = res.json().data;

    // 24 un; unitPrice = round(241,00 / 24) = 10,04; 24 × 10,04 = 240,96 → resíduo −0,04 vai para o imposto.
    // total = 240,96 − 11,00 + 5,00 + 12,09 = 247,05 = custo do item; unitCost = round(247,05 / 24) = 10,29.
    const items = await purchaseItems(purchaseId);
    const byVariant = (id: string) => asNumbers(items.find((i) => i.productVariantId === id)!);
    assert.deepEqual(byVariant(box), { quantity: 24, unitPrice: 10.04, discount: 11, freight: 5, tax: 12.09, total: 247.05, unitCost: 10.29 });

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: box } });
    assert.equal(inventory.quantity, 24);
    assert.equal(inventory.averageCost.toNumber(), 10.29);
    const lots = await prisma.inventoryLot.findMany({ where: { productVariantId: box }, orderBy: { batchNumber: "asc" } });
    assert.deepEqual(
      lots.map((l) => [l.batchNumber, l.initialQuantity, l.unitCost.toNumber()]),
      [
        ["L001", 12, 10.29],
        ["L002", 12, 10.29],
      ],
    );
  });

  test("total do pedido = vNF ao centavo com desconto/frete/IPI; parcelas editadas com soma divergente → 422", async () => {
    const note = newNote();
    const supplier = await createSupplier(note.cnpj);
    const draft = await uploadNote(note);
    const [a, b, c] = [await existingVariant(), await existingVariant(), await existingVariant()];
    const items = [
      { index: 1, link: { productVariantId: a, unitsPerPackage: 12 } },
      { index: 2, link: { productVariantId: b, unitsPerPackage: 2 } },
      { index: 3, link: { productVariantId: c } },
    ];
    const body = (installments?: object[]) => ({ supplier: { id: supplier.id }, items, installments, receive: false });

    const mismatch = await confirm(draft.id, body([{ dueDate: "2026-11-01", amount: 200 }, { dueDate: "2026-12-01", amount: 197 }]));
    assert.equal(mismatch.statusCode, 422, mismatch.body);
    assert.deepEqual(mismatch.json(), {
      message: "A soma das parcelas difere do total do pedido.",
      code: "INSTALLMENTS_TOTAL_MISMATCH",
    });
    const beforeIssue = await confirm(draft.id, body([{ dueDate: "2026-10-22", amount: 397.09 }]));
    assert.equal(beforeIssue.statusCode, 400, beforeIssue.body);
    const threeDecimals = await confirm(draft.id, body([{ dueDate: "2026-10-23", amount: 397.091 }]));
    assert.equal(threeDecimals.statusCode, 400, threeDecimals.body);
    assert.equal((await prisma.nfeImport.findUniqueOrThrow({ where: { id: draft.id } })).status, "DRAFT");

    const res = await confirm(draft.id, body([{ dueDate: "2026-10-23", amount: 200 }, { dueDate: "2026-12-01", amount: 197.09 }]));
    assert.equal(res.statusCode, 201, res.body);
    const { purchaseId } = res.json().data;

    // Item 2: 21 un; round(41,90 / 21) = 2,00 → resíduo +0,10 vai para o desconto: 42,00 − 0,10 + 3,50 + 7,14 = 52,54.
    // Item 3: desconto = vDesc 0,99 + vICMSDeson deduzido 1,50.
    const rows = await purchaseItems(purchaseId);
    const byVariant = (id: string) => asNumbers(rows.find((i) => i.productVariantId === id)!);
    assert.deepEqual(byVariant(b), { quantity: 21, unitPrice: 2, discount: 0.1, freight: 3.5, tax: 7.14, total: 52.54, unitCost: 2.5 });
    assert.deepEqual(byVariant(c), { quantity: 1, unitPrice: 99.99, discount: 2.49, freight: 0, tax: 0, total: 97.5, unitCost: 97.5 });

    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    assert.equal(purchase.totalAmount.toNumber(), 397.09);
    assert.equal(rows.reduce((s, i) => s + Math.round(i.total.toNumber() * 100), 0), 39709);
    assert.deepEqual(await parcelsOf(purchaseId), [
      ["2026-10-23", 200],
      ["2026-12-01", 197.09],
    ]);

    // Nota sem duplicatas → parcela única com vencimento na emissão.
    const noBilling = newNote({ cnpj: note.cnpj });
    const draft2 = await uploadNote(noBilling, (xml) => xml.replace(/<cobr>[\s\S]*<\/cobr>/, ""));
    const res2 = await confirm(draft2.id, body());
    assert.equal(res2.statusCode, 201, res2.body);
    assert.deepEqual(await parcelsOf(res2.json().data.purchaseId), [["2026-10-23", 397.09]]);
  });

  test("receive true → estoque e lotes da nota; false → pedido PENDING; lote em conflito → 409 e nada criado", async () => {
    const note = newNote();
    const supplier = await createSupplier(note.cnpj);
    const draft = await uploadNote(note);
    const [a, b, c] = [await existingVariant(), await existingVariant(), await existingVariant()];
    const items = [
      { index: 1, link: { productVariantId: a, unitsPerPackage: 6 } },
      { index: 2, link: { productVariantId: b, unitsPerPackage: 2 } },
      { index: 3, link: { productVariantId: c } },
    ];

    // Lote L002 já existe em `a` vindo de outra origem → 409 BATCH_ALREADY_EXISTS; tudo desfeito.
    const inventory = await prisma.inventory.create({ data: { productVariantId: a, quantity: 0, averageCost: 0 } });
    const foreignLot = await prisma.inventoryLot.create({
      data: {
        inventoryId: inventory.id,
        productVariantId: a,
        sourceType: "MANUAL",
        initialQuantity: 1,
        remainingQuantity: 0,
        unitCost: 1,
        batchNumber: "L002",
      },
    });
    const conflict = await confirm(draft.id, { supplier: { id: supplier.id }, items, receive: true });
    assert.equal(conflict.statusCode, 409, conflict.body);
    assert.equal(conflict.json().code, "BATCH_ALREADY_EXISTS");
    assert.equal(await prisma.purchase.count({ where: { supplierId: supplier.id } }), 0);
    assert.equal(await prisma.supplierProductMapping.count({ where: { supplierId: supplier.id } }), 0);
    assert.equal(await prisma.inventoryLot.count({ where: { productVariantId: { in: [a, b, c] } } }), 1);
    assert.equal((await prisma.nfeImport.findUniqueOrThrow({ where: { id: draft.id } })).status, "DRAFT");
    await prisma.inventoryLot.delete({ where: { id: foreignLot.id } });

    const res = await confirm(draft.id, { supplier: { id: supplier.id }, items, receive: true });
    assert.equal(res.statusCode, 201, res.body);
    const { purchaseId } = res.json().data;
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    assert.equal(purchase.status, "RECEIVED");

    // Lotes da nota × unidades por embalagem: 1 CX × 6 = 6 un cada; itens sem rastro → um lote sem número.
    const lots = await prisma.inventoryLot.findMany({
      where: { productVariantId: { in: [a, b, c] } },
      orderBy: [{ productVariantId: "asc" }, { batchNumber: "asc" }],
    });
    const lotsOf = (id: string) =>
      lots
        .filter((l) => l.productVariantId === id)
        .map((l) => [
          l.batchNumber,
          l.initialQuantity,
          l.manufacturingDate?.toISOString().slice(0, 10) ?? null,
          l.expirationDate?.toISOString().slice(0, 10) ?? null,
          l.sourceId,
        ]);
    assert.deepEqual(lotsOf(a), [
      ["L001", 6, "2026-01-10", "2027-01-10", purchaseId],
      ["L002", 6, "2026-02-15", "2027-02-15", purchaseId],
    ]);
    assert.deepEqual(lotsOf(b), [[null, 21, null, null, purchaseId]]);
    assert.deepEqual(lotsOf(c), [[null, 1, null, null, purchaseId]]);
    const stock = await prisma.inventory.findMany({ where: { productVariantId: { in: [a, b, c] } } });
    assert.deepEqual(
      [a, b, c].map((id) => stock.find((s) => s.productVariantId === id)?.quantity),
      [12, 21, 1],
    );
    const movements = await prisma.stockMovement.findMany({ where: { originId: purchaseId } });
    assert.equal(movements.length, 4);
    assert.ok(movements.every((m) => m.userId === admin.id && m.origin === "PURCHASE" && m.type === "IN"));

    // receive false → PENDING, sem estoque.
    const pendingNote = newNote({ cnpj: note.cnpj });
    const pendingDraft = await uploadNote(pendingNote);
    const pending = await confirm(pendingDraft.id, { supplier: { id: supplier.id }, items, receive: false });
    assert.equal(pending.statusCode, 201, pending.body);
    const pendingPurchase = await prisma.purchase.findUniqueOrThrow({ where: { id: pending.json().data.purchaseId } });
    assert.equal(pendingPurchase.status, "PENDING");
    assert.equal(await prisma.stockMovement.count({ where: { originId: pendingPurchase.id } }), 0);
  });

  test("itens da mesma variante somados num item; quantidade não inteira → 422 NFE_QUANTITY_NOT_INTEGER", async () => {
    const note = newNote();
    const supplier = await createSupplier(note.cnpj);
    const draft = await uploadNote(note);
    const [same, other] = [await existingVariant(), await existingVariant()];

    const notInteger = await confirm(draft.id, {
      supplier: { id: supplier.id },
      items: [
        { index: 1, link: { productVariantId: same, unitsPerPackage: 12 } },
        { index: 2, link: { productVariantId: other } },
        { index: 3, link: { productVariantId: same } },
      ],
      receive: false,
    });
    assert.equal(notInteger.statusCode, 422, notInteger.body);
    assert.deepEqual(notInteger.json(), {
      message: "Quantidade do item 2 não resulta em unidades inteiras.",
      code: "NFE_QUANTITY_NOT_INTEGER",
    });

    const res = await confirm(draft.id, {
      supplier: { id: supplier.id },
      items: [
        { index: 1, link: { productVariantId: same, unitsPerPackage: 12 } },
        { index: 2, link: { productVariantId: other, unitsPerPackage: 2 } },
        { index: 3, link: { productVariantId: same } },
      ],
      receive: true,
    });
    assert.equal(res.statusCode, 201, res.body);
    const { purchaseId } = res.json().data;

    // Itens 1 + 3 na mesma variante: 25 un; vProd 340,99; round(340,99 / 25) = 13,64 → 341,00, resíduo +0,01 no desconto.
    // desconto = 11,00 + 0,99 + 1,50 + 0,01 = 13,50; frete 5,00; imposto 12,05 → total 344,55 = 247,05 + 97,50.
    const rows = await purchaseItems(purchaseId);
    assert.equal(rows.length, 2);
    const merged = asNumbers(rows.find((i) => i.productVariantId === same)!);
    assert.deepEqual(merged, { quantity: 25, unitPrice: 13.64, discount: 13.5, freight: 5, tax: 12.05, total: 344.55, unitCost: 13.78 });
    assert.equal((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).totalAmount.toNumber(), 397.09);

    // Lotes do item 1 (12 + 12) e o restante (1 un do item 3) sem lote, todos no mesmo item do pedido.
    const lots = await prisma.inventoryLot.findMany({ where: { productVariantId: same }, orderBy: { initialQuantity: "asc" } });
    assert.deepEqual(
      lots.map((l) => [l.batchNumber, l.initialQuantity]),
      [
        [null, 1],
        ["L001", 12],
        ["L002", 12],
      ],
    );
    assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: same } })).quantity, 25);
  });

  test("fornecedor existente com documento diferente → 422 SUPPLIER_DOCUMENT_MISMATCH; validações do corpo → 400; VENDEDOR → 403", async () => {
    const note = newNote();
    const draft = await uploadNote(note);
    const other = await createSupplier(randomCnpj());
    const v = await existingVariant();
    const items = [1, 2, 3].map((index) => ({ index, link: { productVariantId: v, unitsPerPackage: index === 2 ? 2 : 1 } }));

    const mismatch = await confirm(draft.id, { supplier: { id: other.id }, items, receive: false });
    assert.equal(mismatch.statusCode, 422, mismatch.body);
    assert.deepEqual(mismatch.json(), {
      message: "O fornecedor escolhido não é o emitente da nota.",
      code: "SUPPLIER_DOCUMENT_MISMATCH",
    });

    const unknownSupplier = await confirm(draft.id, { supplier: { id: randomUUID() }, items, receive: false });
    assert.equal(unknownSupplier.statusCode, 404, unknownSupplier.body);
    assert.equal(unknownSupplier.json().code, "SUPPLIER_NOT_FOUND");

    const unknownVariant = await confirm(draft.id, {
      supplier: { create: { name: "Fornecedor X" } },
      items: [{ index: 1, link: { productVariantId: randomUUID() } }, ...items.slice(1)],
      receive: false,
    });
    assert.equal(unknownVariant.statusCode, 404, unknownVariant.body);
    assert.equal(unknownVariant.json().code, "VARIANT_NOT_FOUND");
    assert.equal(await prisma.supplier.count({ where: { document: note.cnpj } }), 0);

    // Cada item da nota exatamente uma vez.
    for (const bad of [items.slice(0, 2), [...items, items[0]], [...items.slice(0, 2), { ...items[2], index: 4 }]]) {
      const res = await confirm(draft.id, { supplier: { create: { name: "Fornecedor X" } }, items: bad, receive: false });
      assert.equal(res.statusCode, 400, res.body);
    }
    // link e create juntos, unitsPerPackage 0, sem receive.
    for (const body of [
      { supplier: { create: { name: "Fornecedor X" } }, items: [{ index: 1, link: { productVariantId: v }, create: { productId: existingProductId, variantName: "x", salePrice: 1 } }, ...items.slice(1)], receive: false },
      { supplier: { create: { name: "Fornecedor X" } }, items: [{ index: 1, link: { productVariantId: v, unitsPerPackage: 0 } }, ...items.slice(1)], receive: false },
      { supplier: { create: { name: "Fornecedor X" } }, items },
    ]) {
      const res = await confirm(draft.id, body);
      assert.equal(res.statusCode, 400, res.body);
    }

    const forbidden = await confirm(draft.id, { supplier: { id: other.id }, items, receive: false }, vendedor);
    assert.equal(forbidden.statusCode, 403, forbidden.body);
    const missing = await confirm(randomUUID(), { supplier: { id: other.id }, items, receive: false });
    assert.equal(missing.statusCode, 404, missing.body);
    assert.equal(missing.json().code, "NFE_IMPORT_NOT_FOUND");

    // Item com indTot = 0 (não compõe o total) → 422 NFE_UNSUPPORTED_ITEM.
    const partial = newNote();
    const partialDraft = await uploadNote(partial, (xml) =>
      xml
        .replace("<vDesc>0.99</vDesc>\n<indTot>1</indTot>", "<vDesc>0.99</vDesc>\n<indTot>0</indTot>")
        .replace("<vNF>397.09</vNF>", "<vNF>299.59</vNF>"),
    );
    const unsupported = await confirm(partialDraft.id, { supplier: { create: { name: "Fornecedor X" } }, items, receive: false });
    assert.equal(unsupported.statusCode, 422, unsupported.body);
    assert.deepEqual(unsupported.json(), {
      message: "Item 3 não compõe o total da nota; importação não suportada.",
      code: "NFE_UNSUPPORTED_ITEM",
    });
  });

  test("código de barras duplicado num item → 409 e nada criado", async () => {
    const note = newNote();
    const draft = await uploadNote(note);
    const taken = randomBarcode();
    const owner = await existingVariant(taken);
    const linked = await existingVariant();
    const productName = tag();
    const variantsBefore = await prisma.productVariant.count({ where: { productId: existingProductId } });

    const res = await confirm(draft.id, {
      supplier: { create: { name: "Fornecedor Rollback" } },
      items: [
        { index: 1, create: { newProduct: newProduct(productName), variantName: "300ml", salePrice: 10, unitsPerPackage: 12 } },
        { index: 2, link: { productVariantId: linked, unitsPerPackage: 2 } },
        { index: 3, create: { productId: existingProductId, variantName: tag(), barcode: taken, salePrice: 10 } },
      ],
      receive: true,
    });
    assert.equal(res.statusCode, 409, res.body);
    assert.deepEqual(res.json(), { message: "Código de barras já cadastrado.", code: "BARCODE_ALREADY_EXISTS" });

    assert.equal(await prisma.supplier.count({ where: { document: note.cnpj } }), 0);
    assert.equal(await prisma.product.count({ where: { name: productName } }), 0);
    assert.equal(await prisma.productVariant.count({ where: { barcode: { in: [note.barcode1, note.barcode3] } } }), 0);
    assert.equal(await prisma.productVariant.count({ where: { productId: existingProductId } }), variantsBefore);
    assert.equal(await prisma.supplierProductMapping.count({ where: { productVariantId: { in: [linked, owner] } } }), 0);
    assert.equal(await prisma.purchaseItem.count({ where: { productVariantId: linked } }), 0);
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: linked } }), 0);
    const row = await prisma.nfeImport.findUniqueOrThrow({ where: { id: draft.id } });
    assert.deepEqual([row.status, row.purchaseId, row.confirmedById], ["DRAFT", null, null]);
  });

  test("duas confirmações simultâneas → uma 201 e uma 409; próxima nota do fornecedor sugere pelo mapeamento", async () => {
    const note = newNote();
    const draft = await uploadNote(note);
    const [a, b] = [await existingVariant(), await existingVariant()];
    const body = {
      supplier: { create: { name: "Fornecedor Concorrente" } },
      items: [
        { index: 1, link: { productVariantId: a, unitsPerPackage: 12 } },
        { index: 2, link: { productVariantId: b, unitsPerPackage: 2 } },
        { index: 3, create: { productId: existingProductId, variantName: tag(), salePrice: 5 } },
      ],
      receive: true,
    };

    const results = await Promise.all([confirm(draft.id, body), confirm(draft.id, body)]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 409], results.map((r) => r.body).join("\n"));
    const loser = results.find((r) => r.statusCode === 409)!;
    assert.equal(loser.json().code, "NFE_IMPORT_CONFIRMED");
    assert.equal(await prisma.supplier.count({ where: { document: note.cnpj } }), 1);
    assert.equal(await prisma.productVariant.count({ where: { barcode: note.barcode3 } }), 1);
    assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: a } })).quantity, 24);

    // Próxima nota do mesmo emitente: sugestões pelo mapeamento gravado, com as unidades por embalagem.
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { document: note.cnpj } });
    const v3 = await prisma.productVariant.findFirstOrThrow({ where: { barcode: note.barcode3 } });
    const next = await uploadNote(newNote({ cnpj: note.cnpj }));
    assert.deepEqual(next.supplier.match, { id: supplier.id, name: "Fornecedor Concorrente" });
    assert.deepEqual(
      next.items.map((i: any) => [i.suggestion?.source, i.suggestion?.productVariantId, i.suggestion?.unitsPerPackage]),
      [
        ["MAPPING", a, 12],
        ["MAPPING", b, 2],
        ["MAPPING", v3.id, 1],
      ],
    );
  });
});
