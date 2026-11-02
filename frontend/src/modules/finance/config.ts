import { FINANCE_STATUS_LABELS, type IFinanceDetail, type IFinanceListItem, type IFinanceParcel, type IFinanceSummary } from './types';

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
  /** CSV report route, its read permission and the file name prefix (used when the server name is unreadable). */
  exportPath: '/reports/receivables.csv' | '/reports/payables.csv';
  exportPermission: 'finance.read' | 'payables.read';
  exportFilePrefix: 'contas-a-receber' | 'contas-a-pagar';
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
    exportPath: '/reports/receivables.csv',
    exportPermission: 'finance.read',
    exportFilePrefix: 'contas-a-receber',
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
    exportPath: '/reports/payables.csv',
    exportPermission: 'payables.read',
    exportFilePrefix: 'contas-a-pagar',
  },
};

/** Origem das dívidas antigas importadas do caderno: não tem venda nem pedido para abrir. */
export const LEGACY_ORIGIN = 'LEGACY';
export const LEGACY_LABEL = 'Caderninho';
export const DUE_TO_AGREE_LABEL = 'A combinar';

/**
 * Etiqueta de situação do documento. Em aberto e com todo o saldo em parcelas "a combinar" (dívida do caderninho
 * ainda sem datas) → "A combinar" no tom neutro, nunca "A vencer". Lista: sem próximo vencimento datado.
 */
export function documentStatusBadge(
  doc: Pick<IFinanceListItem, 'displayStatus'> & ({ parcels: Pick<IFinanceParcel, 'dueDateUnknown' | 'remainingAmount' | 'status'>[] } | Pick<IFinanceListItem, 'hasDueDateUnknown' | 'nextDueDate'>),
): { status: string; label: string } {
  const label = FINANCE_STATUS_LABELS[doc.displayStatus] ?? doc.displayStatus;
  if (doc.displayStatus !== 'OPEN') return { status: doc.displayStatus, label };
  const onlyToAgree =
    'parcels' in doc
      ? (() => {
          const open = doc.parcels.filter((p) => p.status !== 'CANCELED' && p.remainingAmount > 0);
          return open.length > 0 && open.every((p) => p.dueDateUnknown);
        })()
      : doc.hasDueDateUnknown && !doc.nextDueDate;
  return onlyToAgree ? { status: 'DUE_TO_AGREE', label: DUE_TO_AGREE_LABEL } : { status: doc.displayStatus, label };
}

export function partyOf(kind: FinanceKind, item: Pick<IFinanceDetail, 'customer' | 'supplier'>) {
  return item[FINANCE_KINDS[kind].partyKey];
}

export function summaryValue(kind: FinanceKind, summary?: IFinanceSummary) {
  return summary?.[FINANCE_KINDS[kind].summaryKey];
}
