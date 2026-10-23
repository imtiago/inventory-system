import type { IFinanceDetail, IFinanceListItem, IFinanceSummary } from './types';

export type FinanceKind = 'receivable' | 'payable';

export interface IFinanceKindConfig {
  /** API base path and route base. */
  basePath: '/receivables' | '/payables';
  title: string;
  singular: string;
  /** Lowercase plural used in sentences, e.g. "contas a receber". */
  plural: string;
  partyLabel: string;
  partyKey: 'customer' | 'supplier';
  partyFilterKey: 'customerId' | 'supplierId';
  partyPlaceholder: string;
  partyEmpty: string;
  summaryKey: 'receivedAmount' | 'paidAmount';
  summaryId: 'received' | 'paid';
  summaryLabel: string;
  /** finance.* vs payables.* */
  pay: 'finance.pay' | 'payables.pay';
  reverse: 'finance.reverse' | 'payables.reverse';
  originColumn: string;
  originHref: (item: Pick<IFinanceListItem, 'originId'>) => string;
  originText: (item: Pick<IFinanceListItem, 'originId' | 'originType' | 'purchaseCode'>) => string | null;
  originDetailText: (item: Pick<IFinanceListItem, 'originId' | 'originType' | 'purchaseCode'>) => string;
  originType: 'SALE' | 'PURCHASE';
}

export const FINANCE_KINDS: Record<FinanceKind, IFinanceKindConfig> = {
  receivable: {
    basePath: '/receivables',
    title: 'Contas a receber',
    singular: 'Conta a receber',
    plural: 'contas a receber',
    partyLabel: 'Cliente',
    partyKey: 'customer',
    partyFilterKey: 'customerId',
    partyPlaceholder: 'Todos os clientes',
    partyEmpty: 'Nenhum cliente encontrado.',
    summaryKey: 'receivedAmount',
    summaryId: 'received',
    summaryLabel: 'Recebido',
    pay: 'finance.pay',
    reverse: 'finance.reverse',
    originColumn: 'Origem',
    originHref: (item) => `/sales/${item.originId}`,
    originText: (item) => `Venda #${item.originId.slice(0, 8).toUpperCase()}`,
    originDetailText: () => 'Venda de origem',
    originType: 'SALE',
  },
  payable: {
    basePath: '/payables',
    title: 'Contas a pagar',
    singular: 'Conta a pagar',
    plural: 'contas a pagar',
    partyLabel: 'Fornecedor',
    partyKey: 'supplier',
    partyFilterKey: 'supplierId',
    partyPlaceholder: 'Todos os fornecedores',
    partyEmpty: 'Nenhum fornecedor encontrado.',
    summaryKey: 'paidAmount',
    summaryId: 'paid',
    summaryLabel: 'Pago',
    pay: 'payables.pay',
    reverse: 'payables.reverse',
    originColumn: 'Origem',
    originHref: (item) => `/purchases/${item.originId}`,
    originText: (item) => `Pedido ${item.purchaseCode ?? `#${item.originId.slice(0, 8).toUpperCase()}`}`,
    originDetailText: (item) => `Pedido ${item.purchaseCode ?? `#${item.originId.slice(0, 8).toUpperCase()}`}`,
    originType: 'PURCHASE',
  },
};

export function partyOf(kind: FinanceKind, item: Pick<IFinanceDetail, 'customer' | 'supplier'>) {
  return item[FINANCE_KINDS[kind].partyKey];
}

export function summaryValue(kind: FinanceKind, summary?: IFinanceSummary) {
  return summary?.[FINANCE_KINDS[kind].summaryKey];
}
