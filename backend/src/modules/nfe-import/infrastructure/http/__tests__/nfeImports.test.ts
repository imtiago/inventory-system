import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { randomCnpj } from "../../../../../test/documentFixtures";
import { buildAccessKey } from "../../../../../test/accessKeyFixtures";
import { NfeParser } from "../../parser/NfeParser";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/nfe/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const xmlFixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../__fixtures__/${name}`, import.meta.url)), "utf-8");

// Valores fixos de nfe-completa.xml, trocados por aleatórios em cada nota de teste
// (testes paralelos: chave, CNPJ e códigos de barras únicos).
const TEMPLATE_KEY = "35261011222333000181550010000123451123456784";
const TEMPLATE_CNPJ = "11222333000181";
const TEMPLATE_BARCODE_1 = "7891234567895";
const TEMPLATE_BARCODE_3 = "7890000000017";
const TEMPLATE = xmlFixture("nfe-completa.xml");

const randomBarcode = () => `789${Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("")}`;

type Note = { key: string; cnpj: string; barcode1: string; barcode3: string };

function newNote(overrides: Partial<Note> = {}): Note {
  const cnpj = overrides.cnpj ?? randomCnpj();
  return {
    cnpj,
    key: overrides.key ?? buildAccessKey({ cnpj }),
    barcode1: overrides.barcode1 ?? randomBarcode(),
    barcode3: overrides.barcode3 ?? randomBarcode(),
  };
}

function noteXml(note: Note, mutate: (xml: string) => string = (x) => x): string {
  return mutate(
    TEMPLATE.replaceAll(TEMPLATE_KEY, note.key)
      .replaceAll(TEMPLATE_CNPJ, note.cnpj)
      .replaceAll(TEMPLATE_BARCODE_1, note.barcode1)
      .replaceAll(TEMPLATE_BARCODE_3, note.barcode3),
  );
}

const BOUNDARY = "----tx-test-nfe-boundary";

function multipart(parts: { name: string; filename?: string; contentType?: string; content: string | Buffer }[]) {
  const chunks: Buffer[] = [];
  for (const p of parts) {
    const disposition = `form-data; name="${p.name}"${p.filename ? `; filename="${p.filename}"` : ""}`;
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: ${disposition}\r\n` +
          (p.contentType ? `Content-Type: ${p.contentType}\r\n` : "") +
          "\r\n",
      ),
      Buffer.isBuffer(p.content) ? p.content : Buffer.from(p.content),
      Buffer.from("\r\n"),
    );
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

describe("Importações de NF-e (/nfe-imports)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  const importKeys: string[] = [];
  const supplierIds: string[] = [];
  const purchaseIds: string[] = [];
  const variantCleanups: (() => Promise<void>)[] = [];
  const tag = () => `tx-test-${randomUUID()}`;

  const upload = (content: string | Buffer, user = admin, filename = "nota.xml") =>
    app.inject({
      method: "POST",
      url: "/nfe-imports",
      headers: {
        authorization: `Bearer ${user.token}`,
        "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipart([{ name: "file", filename, contentType: "application/xml", content }]),
    });

  const uploadNote = (note: Note, mutate?: (xml: string) => string, user = admin) => {
    importKeys.push(note.key);
    return upload(noteXml(note, mutate), user);
  };

  const call = (method: "GET" | "DELETE" | "POST", url: string, user = admin, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${user.token}` }, payload });

  const createSupplier = async (document: string) => {
    const s = await prisma.supplier.create({ data: { name: tag(), document } });
    supplierIds.push(s.id);
    return s;
  };

  const createVariant = async (barcode?: string) => {
    const { variantId, cleanup } = await createTestVariant();
    variantCleanups.push(cleanup);
    const v = await prisma.productVariant.update({
      where: { id: variantId },
      data: { barcode: barcode ?? null },
      include: { product: true },
    });
    return { id: v.id, label: `${v.product.name} — ${v.name} (${v.code})` };
  };

  /** Marca a importação como confirmada (a confirmação de verdade é a Task 3). */
  const markConfirmed = async (importId: string, supplierId: string) => {
    const purchase = await prisma.purchase.create({
      data: {
        code: tag(),
        supplierId,
        status: "PENDING",
        origin: "XML",
        purchaseDate: new Date("2026-10-23T00:00:00.000Z"),
      },
    });
    purchaseIds.push(purchase.id);
    await prisma.nfeImport.update({
      where: { id: importId },
      data: { status: "CONFIRMED", purchaseId: purchase.id, confirmedById: admin.id, confirmedAt: new Date() },
    });
    return purchase.id;
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
  });

  after(async () => {
    try {
      await prisma.nfeImport.deleteMany({ where: { accessKey: { in: importKeys } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.supplierProductMapping.deleteMany({ where: { supplierId: { in: supplierIds } } });
      await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
      for (const cleanup of variantCleanups) await cleanup();
    } finally {
      await admin.cleanup();
      await vendedor.cleanup();
      await estoquista.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("POST /nfe-imports com XML válido → 201 rascunho; fornecedor encontrado por documento", async () => {
    const note = newNote();
    const supplier = await createSupplier(note.cnpj);

    const res = await uploadNote(note);
    assert.equal(res.statusCode, 201, res.body);
    const d = res.json().data;
    assert.equal(d.status, "DRAFT");
    assert.equal(d.accessKey, note.key);
    assert.deepEqual([d.number, d.series, d.issueDate, d.totalAmount, d.purchaseId], ["12345", "1", "2026-10-23", 397.09, null]);
    assert.deepEqual(d.supplier, {
      document: note.cnpj,
      name: "Distribuidora Exemplo Ltda",
      match: { id: supplier.id, name: supplier.name },
    });
    assert.equal(d.items.length, 3);
    // custo / quantidade, arredondado meio para cima: 247,05 / 2; 52,54 / 10,5; 97,50 / 1
    assert.deepEqual(
      d.items.map((i: any) => [i.index, i.supplierCode, i.unit, i.quantity, i.unitCost, i.total]),
      [
        [1, "A-001", "CX", 2, 123.53, 247.05],
        [2, "B-002", "KG", 10.5, 5, 52.54],
        [3, "C-003", "UN", 1, 97.5, 97.5],
      ],
    );
    assert.deepEqual(
      d.items.map((i: any) => i.barcode),
      [note.barcode1, null, note.barcode3],
    );
    assert.equal(d.items[0].name, "Shampoo P&G 300ml");
    assert.deepEqual(d.items[0].lots[0], {
      batchNumber: "L001",
      quantity: 1,
      manufacturingDate: "2026-01-10",
      expirationDate: "2027-01-10",
    });
    assert.deepEqual(
      d.installments,
      [
        { number: "001", dueDate: "2026-11-22", amount: 132.36 },
        { number: "002", dueDate: "2026-12-22", amount: 132.36 },
        { number: "003", dueDate: "2027-01-21", amount: 132.37 },
      ],
    );
    assert.ok(d.items.every((i: any) => i.suggestion === null));

    const row = await prisma.nfeImport.findUniqueOrThrow({ where: { id: d.id } });
    assert.equal(row.status, "DRAFT");
    assert.equal(row.createdById, admin.id);
    assert.equal(row.supplierDocument, note.cnpj);
    assert.equal(row.supplierName, "Distribuidora Exemplo Ltda");
    assert.equal(row.totalAmount.toString(), "397.09");
    assert.equal(row.issueDate.toISOString().slice(0, 10), "2026-10-23");

    // Sem fornecedor cadastrado com o documento da nota → match null.
    const other = await uploadNote(newNote());
    assert.equal(other.statusCode, 201, other.body);
    assert.equal(other.json().data.supplier.match, null);
  });

  test("sugestão por mapeamento do fornecedor e, sem mapeamento, por código de barras", async () => {
    const note = newNote();
    const supplier = await createSupplier(note.cnpj);
    const mapped = await createVariant();
    const byBarcode1 = await createVariant(note.barcode1);
    const byBarcode3 = await createVariant(note.barcode3);
    await prisma.supplierProductMapping.create({
      data: { supplierId: supplier.id, supplierCode: "A-001", productVariantId: mapped.id, unitsPerPackage: 12 },
    });

    const res = await uploadNote(note);
    assert.equal(res.statusCode, 201, res.body);
    // Item 1: mapeamento vence o código de barras; item 2: SEM GTIN e sem mapeamento; item 3: código de barras.
    assert.deepEqual(
      res.json().data.items.map((i: any) => i.suggestion),
      [
        { source: "MAPPING", productVariantId: mapped.id, label: mapped.label, unitsPerPackage: 12 },
        null,
        { source: "BARCODE", productVariantId: byBarcode3.id, label: byBarcode3.label, unitsPerPackage: 1 },
      ],
    );

    // GET recalcula na leitura (nada guardado): sem o mapeamento, o item 1 cai no código de barras.
    await prisma.supplierProductMapping.deleteMany({ where: { supplierId: supplier.id } });
    const get = await call("GET", `/nfe-imports/${res.json().data.id}`);
    assert.equal(get.statusCode, 200, get.body);
    assert.deepEqual(get.json().data.items[0].suggestion, {
      source: "BARCODE",
      productVariantId: byBarcode1.id,
      label: byBarcode1.label,
      unitsPerPackage: 1,
    });

    // Mapeamento de outro fornecedor não vale: nota de emitente sem cadastro usa só o código de barras.
    const anotherSupplier = await createSupplier(randomCnpj());
    await prisma.supplierProductMapping.create({
      data: { supplierId: anotherSupplier.id, supplierCode: "A-001", productVariantId: mapped.id },
    });
    const unknown = await uploadNote(newNote({ barcode1: note.barcode1, barcode3: note.barcode3 }));
    assert.equal(unknown.statusCode, 201, unknown.body);
    assert.deepEqual(
      unknown.json().data.items.map((i: any) => i.suggestion?.productVariantId ?? null),
      [byBarcode1.id, null, byBarcode3.id],
    );
  });

  test("reenviar a mesma chave em rascunho → 200 mesmo id; chave confirmada → 409 NFE_ALREADY_IMPORTED com purchaseId", async () => {
    const note = newNote();
    const supplier = await createSupplier(note.cnpj);
    const first = await uploadNote(note);
    assert.equal(first.statusCode, 201, first.body);
    const id = first.json().data.id;

    // Mesmo conteúdo com outro nome de item: o rascunho é substituído.
    const again = await uploadNote(note, (xml) => xml.replace("Shampoo P&amp;G 300ml", "Shampoo Renomeado"));
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(again.json().data.id, id);
    assert.equal(again.json().data.items[0].name, "Shampoo Renomeado");
    assert.equal(await prisma.nfeImport.count({ where: { accessKey: note.key } }), 1);

    const purchaseId = await markConfirmed(id, supplier.id);
    const confirmed = await uploadNote(note);
    assert.equal(confirmed.statusCode, 409, confirmed.body);
    assert.deepEqual(confirmed.json(), {
      message: "Esta NF-e já foi importada.",
      code: "NFE_ALREADY_IMPORTED",
      details: { purchaseId, importId: id },
    });
    const row = await prisma.nfeImport.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, "CONFIRMED");
    assert.equal((row.payload as any).items[0].name, "Shampoo Renomeado");

    // Dois envios simultâneos de uma chave nova → um 201, o outro 200 com o mesmo rascunho.
    const fresh = newNote();
    const results = await Promise.all([uploadNote(fresh), uploadNote(fresh)]);
    assert.deepEqual(
      results.map((r) => r.statusCode).sort(),
      [200, 201],
      results.map((r) => r.body).join("\n"),
    );
    assert.equal(results[0].json().data.id, results[1].json().data.id);
    assert.equal(await prisma.nfeImport.count({ where: { accessKey: fresh.key } }), 1);
  });

  test("mapeamento não impede excluir o produto/variante: o vínculo some junto (Cascade)", async () => {
    const supplier = await createSupplier(randomCnpj());
    const variant = await createVariant();
    const { productId } = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    await prisma.supplierProductMapping.create({
      data: { supplierId: supplier.id, supplierCode: "X-1", productVariantId: variant.id },
    });
    const res = await call("DELETE", `/products/${productId}`);
    assert.equal(res.statusCode, 204, res.body);
    assert.equal(await prisma.supplierProductMapping.count({ where: { supplierId: supplier.id } }), 0);
  });

  test("corrida na chave nova: INSERT do envio espera o de outra transação, falha na unicidade e vira 200 no rascunho dela", async () => {
    const note = newNote();
    importKeys.push(note.key);
    const document = new NfeParser().parse(noteXml(note));
    let uploadPromise!: ReturnType<typeof upload>;
    let otherId = "";

    await prisma.$transaction(
      async (tx) => {
        // Rascunho gravado e ainda não confirmado por outra transação.
        otherId = (
          await tx.nfeImport.create({
            data: {
              accessKey: note.key,
              supplierDocument: note.cnpj,
              supplierName: "outra transação",
              issueDate: new Date("2026-10-23T00:00:00.000Z"),
              totalAmount: 397.09,
              payload: document as any,
            },
          })
        ).id;
        uploadPromise = upload(noteXml(note));
        // Espera o envio ficar bloqueado no INSERT (espera de trava na mesma chave).
        const deadline = Date.now() + 4000;
        for (;;) {
          const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
            SELECT count(*)::int AS waiting FROM pg_stat_activity
            WHERE wait_event_type = 'Lock' AND query LIKE 'INSERT INTO "public"."NfeImport"%'`;
          if (waiting > 0) break;
          if (Date.now() > deadline) throw new Error("o envio não chegou a esperar a trava");
          await new Promise((r) => setTimeout(r, 20));
        }
      },
      { timeout: 10000 },
    );

    const res = await uploadPromise;
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.id, otherId);
    const row = await prisma.nfeImport.findUniqueOrThrow({ where: { id: otherId } });
    assert.equal(row.supplierName, "Distribuidora Exemplo Ltda");
  });

  test("PDF → 400 UNSUPPORTED_FILE_TYPE; sem arquivo → 400", async () => {
    const pdf = await upload(Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n"), admin, "nota.xml");
    assert.equal(pdf.statusCode, 400, pdf.body);
    assert.equal(pdf.json().code, "UNSUPPORTED_FILE_TYPE");
    assert.equal(pdf.json().message, "Envie o arquivo XML da NF-e.");

    const noFile = await app.inject({
      method: "POST",
      url: "/nfe-imports",
      headers: {
        authorization: `Bearer ${admin.token}`,
        "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipart([{ name: "note", content: "x" }]),
    });
    assert.equal(noFile.statusCode, 400, noFile.body);
    assert.equal(noFile.json().code, "FILE_REQUIRED");

    const notMultipart = await call("POST", "/nfe-imports", admin, {});
    assert.equal(notMultipart.statusCode, 400, notMultipart.body);
    assert.equal(notMultipart.json().code, "FILE_REQUIRED");

    const malformed = await upload("<nfeProc><broken");
    assert.equal(malformed.statusCode, 400, malformed.body);
    assert.equal(malformed.json().code, "INVALID_FILE_CONTENT");

    const nfce = await upload(xmlFixture("nfce-modelo-65.xml"));
    assert.equal(nfce.statusCode, 422, nfce.body);
    assert.equal(nfce.json().code, "INVALID_NFE");
  });

  test("GET lista e detalhe; DELETE rascunho 204; DELETE confirmado 409; chaves = fixtures; VENDEDOR/ESTOQUISTA 403", async () => {
    const note = newNote();
    const supplier = await createSupplier(note.cnpj);
    await createVariant(note.barcode1);
    const older = (await uploadNote(note)).json().data;
    const newer = (await uploadNote(newNote())).json().data;

    const list = await call("GET", "/nfe-imports?status=DRAFT&limit=100");
    assert.equal(list.statusCode, 200, list.body);
    const ids = list.json().data.map((i: any) => i.id);
    assert.ok(ids.indexOf(newer.id) >= 0 && ids.indexOf(newer.id) < ids.indexOf(older.id), "createdAt desc");
    const listed = list.json().data.find((i: any) => i.id === older.id);
    assert.deepEqual(listed, {
      id: older.id,
      accessKey: note.key,
      status: "DRAFT",
      number: "12345",
      series: "1",
      issueDate: "2026-10-23",
      totalAmount: 397.09,
      supplier: { document: note.cnpj, name: "Distribuidora Exemplo Ltda" },
      itemsCount: 3,
      purchaseId: null,
      createdAt: older.createdAt,
    });
    assert.deepEqual(keyShape(list.json()), keyShape(loadFixture("nfeImportList")));
    assert.equal(list.json().pagination.limit, 100);
    assert.equal((await call("GET", "/nfe-imports?limit=101")).statusCode, 400);
    assert.equal((await call("GET", "/nfe-imports?status=FOO")).statusCode, 400);

    const detail = await call("GET", `/nfe-imports/${older.id}`);
    assert.equal(detail.statusCode, 200, detail.body);
    assert.deepEqual(detail.json(), { data: older });
    assert.deepEqual(keyShape(detail.json()), keyShape(loadFixture("nfeImport")));

    const missing = await call("GET", `/nfe-imports/${randomUUID()}`);
    assert.equal(missing.statusCode, 404, missing.body);
    assert.deepEqual(missing.json(), { message: "Importação não encontrada.", code: "NFE_IMPORT_NOT_FOUND" });
    assert.equal((await call("GET", "/nfe-imports/not-a-uuid")).statusCode, 400);
    assert.equal((await call("DELETE", `/nfe-imports/${randomUUID()}`)).statusCode, 404);

    // Permissões: só purchases.write (ADMIN).
    for (const user of [vendedor, estoquista]) {
      const responses = [
        await call("GET", "/nfe-imports", user),
        await call("GET", `/nfe-imports/${older.id}`, user),
        await call("DELETE", `/nfe-imports/${older.id}`, user),
        await uploadNote(newNote(), undefined, user),
      ];
      for (const res of responses) {
        assert.equal(res.statusCode, 403, `${user.role}: ${res.body}`);
        assert.deepEqual(res.json(), { message: "Acesso negado.", code: "FORBIDDEN" });
      }
    }
    assert.equal((await call("GET", `/nfe-imports/${older.id}`)).statusCode, 200);

    const discarded = await call("DELETE", `/nfe-imports/${newer.id}`);
    assert.equal(discarded.statusCode, 204, discarded.body);
    assert.equal((await call("GET", `/nfe-imports/${newer.id}`)).statusCode, 404);

    const purchaseId = await markConfirmed(older.id, supplier.id);
    const confirmedDelete = await call("DELETE", `/nfe-imports/${older.id}`);
    assert.equal(confirmedDelete.statusCode, 409, confirmedDelete.body);
    assert.deepEqual(confirmedDelete.json(), { message: "Importação já confirmada.", code: "NFE_IMPORT_CONFIRMED" });
    const confirmedGet = await call("GET", `/nfe-imports/${older.id}`);
    assert.equal(confirmedGet.json().data.status, "CONFIRMED");
    assert.equal(confirmedGet.json().data.purchaseId, purchaseId);
    const confirmedList = await call("GET", "/nfe-imports?status=CONFIRMED&limit=100");
    assert.ok(confirmedList.json().data.some((i: any) => i.id === older.id));
    assert.ok(!list.json().data.some((i: any) => i.status !== "DRAFT"));
  });
});
