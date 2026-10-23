import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { ConflictError } from "@shared/domain/errors";
import { Brand } from "@catalog/domain/entities/Brand";
import { Category } from "@catalog/domain/entities/Category";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";
import { PrismaCategoryRepository } from "@catalog/infrastructure/prisma/repositories/PrismaCategoryRepository";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createCatalogTestData } from "./catalogTestData";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/catalog/", import.meta.url);
const brandListFixture = JSON.parse(readFileSync(new URL("brandList.json", FIXTURES_DIR), "utf8"));

type Data = ReturnType<typeof createCatalogTestData>;

/** Marcas e categorias têm o mesmo contrato; os mesmos cenários rodam para as duas. */
const entities = [
  {
    label: "Marcas (/brands)",
    path: "/brands",
    code: "BRAND",
    messages: {
      exists: "Já existe uma marca com esse nome.",
      inUse: "Marca possui produtos e não pode ser excluída.",
      notFound: "Marca não encontrada.",
    },
    make: (data: Data) => data.brand(),
    track: (data: Data, id: string) => data.trackBrand(id),
    withProduct: async (data: Data, id: string) =>
      data.product({ brandId: id, categoryId: (await data.category()).id }),
    /** Cria direto pelo repositório, sem a checagem do use case (só o índice protege). */
    repoCreate: (name: string) => new PrismaBrandRepository().create(new Brand({ name })),
  },
  {
    label: "Categorias (/categories)",
    path: "/categories",
    code: "CATEGORY",
    messages: {
      exists: "Já existe uma categoria com esse nome.",
      inUse: "Categoria possui produtos e não pode ser excluída.",
      notFound: "Categoria não encontrada.",
    },
    make: (data: Data) => data.category(),
    track: (data: Data, id: string) => data.trackCategory(id),
    withProduct: async (data: Data, id: string) =>
      data.product({ brandId: (await data.brand()).id, categoryId: id }),
    repoCreate: (name: string) => new PrismaCategoryRepository().create(new Category({ name })),
  },
];

let admin: TestUser;
let vendedor: TestUser;

before(async () => {
  admin = await createTestUser({ role: "ADMIN" });
  vendedor = await createTestUser({ role: "VENDEDOR" });
});

after(async () => {
  await admin.cleanup();
  await vendedor.cleanup();
  await app.close();
  await prisma.$disconnect();
});

for (const e of entities) {
  describe(e.label, () => {
    const data = createCatalogTestData();

    after(async () => {
      await data.cleanup();
    });

    const call = (
      method: "GET" | "POST" | "PUT" | "DELETE",
      url: string,
      payload?: object,
      token: string = admin.token,
    ) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } });

    /** POST registrando o id para limpeza; devolve a resposta crua. */
    const post = async (name: unknown) => {
      const res = await call("POST", e.path, { name });
      if (res.statusCode < 300) {
        // Também aceita corpo sem envelope, para não vazar linhas se o contrato regredir.
        const body = res.json();
        e.track(data, body.data?.id ?? body.id);
      }
      return res;
    };

    test("POST com espaços → nome normalizado; GET /:id → { data: { id, name, productsCount } }", async () => {
      const t = data.tag();
      const res = await post(`  ${t}   X  `);
      assert.equal(res.statusCode, 201, res.body);
      const created = res.json().data;
      assert.deepEqual(Object.keys(created).sort(), ["id", "name", "productsCount"]);
      assert.equal(created.name, `${t} X`);
      assert.equal(created.productsCount, 0);

      await e.withProduct(data, created.id);
      const get = await call("GET", `${e.path}/${created.id}`);
      assert.equal(get.statusCode, 200);
      assert.deepEqual(get.json(), { data: { id: created.id, name: `${t} X`, productsCount: 1 } });

      const missing = await call("GET", `${e.path}/${randomUUID()}`);
      assert.equal(missing.statusCode, 404);
      assert.deepEqual(missing.json(), { message: e.messages.notFound, code: `${e.code}_NOT_FOUND` });

      assert.equal((await call("GET", `${e.path}/nao-uuid`)).statusCode, 400);
    });

    test("POST valida o nome: vazio após trim → 400; 80 caracteres ok; 81 → 400", async () => {
      for (const name of ["   ", "", undefined, 123]) {
        const res = await post(name);
        assert.equal(res.statusCode, 400, `nome ${JSON.stringify(name)}`);
        assert.equal(res.json().code, "VALIDATION_ERROR");
      }
      const base = data.tag(); // 44 caracteres
      const ok = await post(`${base}-${"x".repeat(80 - base.length - 1)}`);
      assert.equal(ok.statusCode, 201, ok.body);
      const tooLong = await post(`${base}-${"x".repeat(80 - base.length)}`);
      assert.equal(tooLong.statusCode, 400);
    });

    test(`POST com nome existente em outra caixa → 409 ${e.code}_ALREADY_EXISTS`, async () => {
      const t = data.tag();
      assert.equal((await post(t)).statusCode, 201);
      const dup = await post(`  ${t.toUpperCase()} `);
      assert.equal(dup.statusCode, 409);
      assert.deepEqual(dup.json(), { message: e.messages.exists, code: `${e.code}_ALREADY_EXISTS` });
    });

    test(`duas criações simultâneas do mesmo nome → uma 201 e uma 409 ${e.code}_ALREADY_EXISTS`, async () => {
      const t = data.tag();
      const results = await Promise.all([post(t), post(t.toUpperCase())]);
      const statuses = results.map((r) => r.statusCode).sort();
      assert.deepEqual(statuses, [201, 409], results.map((r) => r.body).join(" | "));
      const conflict = results.find((r) => r.statusCode === 409)!;
      assert.deepEqual(conflict.json(), { message: e.messages.exists, code: `${e.code}_ALREADY_EXISTS` });
      assert.equal(
        await (e.code === "BRAND"
          ? prisma.brand.count({ where: { name: { equals: t, mode: "insensitive" } } })
          : prisma.category.count({ where: { name: { equals: t, mode: "insensitive" } } })),
        1,
      );
    });

    test("índice único lower(name): criação direta pelo repositório (corrida) → ConflictError específico", async () => {
      const existing = await e.make(data);
      const outcome = await e.repoCreate(existing.name.toUpperCase()).then(
        (created) => {
          e.track(data, created.id);
          return created;
        },
        (err: unknown) => err,
      );
      assert.ok(outcome instanceof ConflictError, `esperava ConflictError, veio ${String(outcome)}`);
      assert.equal(outcome.code, `${e.code}_ALREADY_EXISTS`);
      assert.equal(outcome.message, e.messages.exists);
    });

    test("PUT /:id renomeia (normalizado); mesma entidade em outra caixa ok; nome de outra → 409; 404; {} → 400", async () => {
      const a = await e.make(data);
      const b = await e.make(data);
      const newName = data.tag();

      const renamed = await call("PUT", `${e.path}/${a.id}`, { name: ` ${newName}   Novo ` });
      assert.equal(renamed.statusCode, 200, renamed.body);
      assert.deepEqual(renamed.json(), { data: { id: a.id, name: `${newName} Novo`, productsCount: 0 } });

      const sameUpper = await call("PUT", `${e.path}/${a.id}`, { name: `${newName} NOVO`.toUpperCase() });
      assert.equal(sameUpper.statusCode, 200, sameUpper.body);
      assert.equal(sameUpper.json().data.name, `${newName} NOVO`.toUpperCase());

      const clash = await call("PUT", `${e.path}/${a.id}`, { name: b.name.toUpperCase() });
      assert.equal(clash.statusCode, 409);
      assert.deepEqual(clash.json(), { message: e.messages.exists, code: `${e.code}_ALREADY_EXISTS` });

      const missing = await call("PUT", `${e.path}/${randomUUID()}`, { name: data.tag() });
      assert.equal(missing.statusCode, 404);
      assert.equal(missing.json().code, `${e.code}_NOT_FOUND`);

      assert.equal((await call("PUT", `${e.path}/${a.id}`, {})).statusCode, 400);
      assert.equal((await call("PUT", `${e.path}/${a.id}`, { name: "  " })).statusCode, 400);
    });

    test(`DELETE /:id com produtos → 409 ${e.code}_IN_USE; sem produtos → 204; VENDEDOR → 403`, async () => {
      const used = await e.make(data);
      await e.withProduct(data, used.id);
      const free = await e.make(data);

      assert.equal((await call("DELETE", `${e.path}/${free.id}`, undefined, vendedor.token)).statusCode, 403);

      const inUse = await call("DELETE", `${e.path}/${used.id}`);
      assert.equal(inUse.statusCode, 409);
      assert.deepEqual(inUse.json(), { message: e.messages.inUse, code: `${e.code}_IN_USE` });
      assert.equal((await call("GET", `${e.path}/${used.id}`)).statusCode, 200);

      const del = await call("DELETE", `${e.path}/${free.id}`);
      assert.equal(del.statusCode, 204);
      assert.equal((await call("GET", `${e.path}/${free.id}`)).statusCode, 404);

      const again = await call("DELETE", `${e.path}/${free.id}`);
      assert.equal(again.statusCode, 404);
      assert.equal(again.json().code, `${e.code}_NOT_FOUND`);
    });

    test("GET ?search=&limit= pagina, filtra sem caixa e ordena por nome sem caixa; chaves = fixture brandList", async () => {
      const u = randomUUID();
      const b = await post(`tx-test-${u}-b`);
      const a = await post(`TX-TEST-${u}-a`);
      const c = await post(`tx-test-${u}-C`);
      for (const r of [a, b, c]) assert.equal(r.statusCode, 201, r.body);
      await e.withProduct(data, b.json().data.id);

      const page1 = await call("GET", `${e.path}?search=${encodeURIComponent(`Tx-Test-${u}`)}&limit=2`);
      assert.equal(page1.statusCode, 200, page1.body);
      const body1 = page1.json();
      assert.deepEqual(body1.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 });
      assert.deepEqual(
        body1.data.map((x: { name: string; productsCount: number }) => [x.name, x.productsCount]),
        [
          [`TX-TEST-${u}-a`, 0],
          [`tx-test-${u}-b`, 1],
        ],
      );
      assert.deepEqual(keyShape(body1), keyShape(brandListFixture));

      const page2 = await call("GET", `${e.path}?search=${encodeURIComponent(`${u}-c`)}&page=1`);
      assert.deepEqual(page2.json().data.map((x: { name: string }) => x.name), [`tx-test-${u}-C`]);

      // Caracteres de LIKE na busca são literais.
      const pct = await call("GET", `${e.path}?search=${encodeURIComponent(`${u}%`)}`);
      assert.equal(pct.json().pagination.total, 0);

      assert.equal((await call("GET", `${e.path}?limit=101`)).statusCode, 400);
      assert.equal((await call("GET", e.path, undefined, vendedor.token)).statusCode, 200);
    });
  });
}
