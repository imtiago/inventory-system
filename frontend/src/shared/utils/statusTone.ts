/** Tom visual de um status (cores dos tokens success/warning/danger/info do tema). */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/**
 * Mapa único de status → tom, para vendas, compras, contas a receber/pagar, estoque, NF-e e usuários.
 * Concluído/pago/recebido/disponível = success; aberto/parcial/pendente/reservado = info ou warning;
 * cancelado/vencido/sem estoque = danger.
 */
export const statusTone: Record<string, Tone> = {
  // Vendas e compras
  COMPLETED: 'success',
  PENDING: 'warning',
  CANCELED: 'danger',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',

  // Contas e parcelas
  OPEN: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',

  // NF-e
  DRAFT: 'warning',
  CONFIRMED: 'success',

  // Estoque
  AVAILABLE: 'success',
  RESERVED: 'info',
  OUT_OF_STOCK: 'danger',

  // Usuários
  ACTIVE: 'success',
  INACTIVE: 'neutral',
};

export function toneFor(status: string | null | undefined): Tone {
  return (status && statusTone[status]) || 'neutral';
}
