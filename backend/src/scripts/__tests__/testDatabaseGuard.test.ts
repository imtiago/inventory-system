import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestDatabaseGuard,
  assertTestDatabase,
  databaseName,
  resolveTestDatabaseUrl,
  withDatabaseName,
} from "../../test/testDatabase";
import { prepareTestDb } from "../prepareTestDb";

const dev = "postgresql://u:p@localhost:5432/inventory?schema=public";
const test_ = "postgresql://u:p@localhost:5432/inventory_test?schema=public";

describe("guarda do banco de testes", () => {
  test("aceita banco terminado em _test", () => {
    assert.equal(assertTestDatabase(test_), test_);
  });
  test("recusa o banco de desenvolvimento", () => {
    assert.throws(() => assertTestDatabase(dev), /não termina em "_test"/);
  });
  test("recusa URL ausente ou inválida", () => {
    assert.throws(() => assertTestDatabase(undefined));
    assert.throws(() => assertTestDatabase("nao-e-url"));
  });
  test("extrai e troca o nome do banco", () => {
    assert.equal(databaseName(dev), "inventory");
    assert.equal(databaseName(withDatabaseName(dev, "postgres")), "postgres");
  });
  test("resolve TEST_DATABASE_URL; DATABASE_URL só com CI=true", () => {
    assert.equal(resolveTestDatabaseUrl({ TEST_DATABASE_URL: test_, DATABASE_URL: dev }), test_);
    assert.throws(() => resolveTestDatabaseUrl({ DATABASE_URL: test_ }));
    assert.equal(resolveTestDatabaseUrl({ DATABASE_URL: test_, CI: "true" }), test_);
    assert.throws(() => resolveTestDatabaseUrl({ DATABASE_URL: dev, CI: "true" }));
  });
  test("prepare recusa banco que não é _test antes de conectar", async () => {
    await assert.rejects(prepareTestDb(dev), /não termina em "_test"/);
  });
});

test("execução de um arquivo de teste isolado (sem bootstrap) troca para o banco de testes ou aborta", () => {
  const env: NodeJS.ProcessEnv = {
    NODE_TEST_CONTEXT: "child-v8",
    DATABASE_URL: "postgresql://u:p@localhost:5432/inventory",
    TEST_DATABASE_URL: "postgresql://u:p@localhost:5432/inventory_test",
  };
  applyTestDatabaseGuard(env);
  assert.equal(env.DATABASE_URL, "postgresql://u:p@localhost:5432/inventory_test");

  assert.throws(
    () => applyTestDatabaseGuard({ NODE_TEST_CONTEXT: "child-v8", DATABASE_URL: "postgresql://u:p@localhost:5432/inventory" }),
    /TEST_DATABASE_URL/,
  );

  const app: NodeJS.ProcessEnv = { DATABASE_URL: "postgresql://u:p@localhost:5432/inventory" };
  applyTestDatabaseGuard(app);
  assert.equal(app.DATABASE_URL, "postgresql://u:p@localhost:5432/inventory");
});
