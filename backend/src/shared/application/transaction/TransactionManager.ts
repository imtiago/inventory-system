export interface TransactionManager {
  execute<T>(callback: () => Promise<T>): Promise<T>;
}
