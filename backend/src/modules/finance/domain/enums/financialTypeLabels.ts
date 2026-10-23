import { FinancialType } from "./FinancialType";

/** Nome do documento nas mensagens ("Conta a receber cancelada.", "Conta a pagar não encontrada."). */
export const FINANCIAL_TYPE_LABEL: Record<FinancialType, string> = {
  [FinancialType.RECEIVABLE]: "Conta a receber",
  [FinancialType.PAYABLE]: "Conta a pagar",
};
