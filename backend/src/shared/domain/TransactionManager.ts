export interface TransactionManager {
  execute<T>(callback: (tx: any) => Promise<T>): Promise<T>;
}
