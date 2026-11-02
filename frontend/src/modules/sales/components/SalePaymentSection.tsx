import { FileText, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Section } from '@/shared/components/details/Section';
import { InfoItem } from '@/shared/components/details/InfoItem';
import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';

import type { ISaleDetail, ISaleFinancing } from '../types';
import { OVERRIDE_KIND_LABELS, PAYMENT_METHOD_LABELS, planParcels, saleConditionLabel } from '../utils/checkout';

const percent = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Condição de pagamento da venda: repasse do cartão ou o plano do crediário (com a autorização, se houve). */
export function SalePaymentSection({ sale }: { sale: ISaleDetail }) {
  const financing = sale.paymentCondition === 'CREDIARIO' ? sale.financing : null;

  return (
    <Section
      title="Pagamento"
      actions={
        financing ? (
          // Task 13 liga o download do carnê.
          <Button type="button" variant="outline" className="min-h-11" disabled aria-describedby="carne-soon">
            <FileText size={16} aria-hidden="true" />
            Carnê
          </Button>
        ) : undefined
      }
    >
      <div data-testid="sale-payment" className="flex flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
          <InfoItem label="Condição" value={saleConditionLabel(sale)} />
          {sale.paymentCondition !== 'CREDIARIO' && <InfoItem label="Total cobrado" value={formatCurrency(sale.totalAmount)} />}
          {(sale.paymentCondition === 'DEBIT_CARD' || sale.paymentCondition === 'CREDIT_CARD') && (
            <InfoItem
              label="Taxa do cartão"
              value={sale.cardFeePassedOn ? `Repassada ao cliente: ${formatCurrency(sale.surchargeAmount)}` : 'Absorvida pela loja'}
            />
          )}
        </div>

        {financing && <FinancingSummary sale={sale} financing={financing} />}

        {financing && (
          <p id="carne-soon" className="text-xs text-muted">
            O carnê para imprimir fica disponível em breve.
          </p>
        )}
      </div>
    </Section>
  );
}

function FinancingSummary({ sale, financing }: { sale: ISaleDetail; financing: ISaleFinancing }) {
  const parcels = planParcels(sale);
  const first = parcels[0]?.amount;
  const last = parcels[parcels.length - 1]?.amount;
  const installmentsText =
    first === undefined
      ? `${financing.installments}x`
      : `${financing.installments}x de ${formatCurrency(first)}${last !== undefined && last !== first ? ` (última ${formatCurrency(last)})` : ''}`;
  const dueDay = financing.dueDay ?? Number(financing.firstDueDate.slice(8, 10));
  const surchargePercent = financing.financedAmount > 0 ? (financing.surchargeAmount / financing.financedAmount) * 100 : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-t pt-5 lg:grid-cols-4">
        <InfoItem label="À vista" value={formatCurrency(financing.cashPrice)} />
        <InfoItem
          label="Entrada"
          value={financing.downPayment > 0 ? `${formatCurrency(financing.downPayment)} · ${financing.downPaymentMethod ? PAYMENT_METHOD_LABELS[financing.downPaymentMethod] : '—'}` : 'Sem entrada'}
        />
        <InfoItem label="Financiado" value={formatCurrency(financing.financedAmount)} />
        <InfoItem label="Parcelas" value={installmentsText} />
        <InfoItem label="Taxa" value={financing.surchargeAmount > 0 ? `${percent(financing.monthlyRatePercent)} ao mês` : 'Sem juros'} />
        <InfoItem label="Acréscimo" value={financing.surchargeAmount > 0 ? `${formatCurrency(financing.surchargeAmount)} (${percent(surchargePercent)})` : 'Sem acréscimo'} />
        <InfoItem label="Total a prazo" value={formatCurrency(financing.totalAmount)} />
        <InfoItem label="Vencimentos" value={`Todo dia ${dueDay} · 1º em ${formatDateOnly(financing.firstDueDate)}`} />
      </div>

      {financing.override && (
        <div data-testid="sale-override" className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">
              {`Exceção autorizada${financing.override.approver ? ` por ${financing.override.approver.name}` : ''}: ${financing.override.kinds.map((kind) => OVERRIDE_KIND_LABELS[kind]).join(' e ')}`}
            </p>
            <p className="mt-1 whitespace-normal break-words">{`Motivo: ${financing.override.reason}`}</p>
          </div>
        </div>
      )}
    </>
  );
}
