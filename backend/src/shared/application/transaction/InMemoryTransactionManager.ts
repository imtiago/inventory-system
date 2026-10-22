import { TransactionManager } from "./TransactionManager";

/** Executa o trabalho sem transação. Para testes unitários de use cases. */
export class InMemoryTransactionManager implements TransactionManager {
  execute<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
