export interface FinancialService {
  createReceivable(input: CreateReceivableInput): Promise<void>;
}
