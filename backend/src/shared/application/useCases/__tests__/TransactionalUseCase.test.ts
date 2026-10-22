import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";

class SpyTransactionManager implements TransactionManager {
  calls = 0;
  execute<T>(work: () => Promise<T>): Promise<T> {
    this.calls++;
    return work();
  }
}

class DoubleUseCase extends TransactionalUseCase<number, number> {
  protected async handle(request: number): Promise<number> {
    return request * 2;
  }
}

describe("TransactionalUseCase", () => {
  test("execute delega handle ao transactionManager", async () => {
    const spy = new SpyTransactionManager();
    const uc = new DoubleUseCase(spy);

    assert.equal(await uc.execute(21), 42);
    assert.equal(spy.calls, 1);
  });

  test("execute sempre passa pelo transactionManager, sem atalho por tx externo", async () => {
    const spy = new SpyTransactionManager();
    const uc = new DoubleUseCase(spy);

    // Antes, um segundo argumento fazia o use case pular o manager.
    await (uc.execute as (...args: unknown[]) => Promise<number>)(1, {});

    assert.equal(spy.calls, 1);
  });
});
