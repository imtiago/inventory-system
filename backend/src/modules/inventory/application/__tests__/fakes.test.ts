import { test } from "node:test";
import assert from "node:assert/strict";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { InMemoryInventoryRepository } from "./fakes";

test("mutar entidade sem update() não altera o que o repositório devolve", async () => {
  const repo = new InMemoryInventoryRepository();
  const inv = new Inventory({ productVariantId: "v1" });
  await repo.create(inv);

  const read = (await repo.findById(inv.id))!;
  read.receive({ quantity: 5, unitCost: 1 });
  assert.equal((await repo.findById(inv.id))!.quantity, 0);

  inv.receive({ quantity: 3, unitCost: 1 });
  assert.equal((await repo.findByProductVariantId("v1"))!.quantity, 0);

  await repo.update(read);
  assert.equal((await repo.findById(inv.id))!.quantity, 5);
});

test("update e delete de id inexistente lançam erro", async () => {
  const repo = new InMemoryInventoryRepository();
  const inv = new Inventory({ productVariantId: "v1" });
  await assert.rejects(() => repo.update(inv));
  await assert.rejects(() => repo.delete("nope"));
});
