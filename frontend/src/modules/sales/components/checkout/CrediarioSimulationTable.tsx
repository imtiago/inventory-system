import { Badge } from '@/components/ui/badge';
import { useBreakpoint } from '@/shared/hooks/useMediaQuery';
import { formatCurrency } from '@/shared/utils/money';

import type { ISaleSimulationCrediario, ISaleSimulationCrediarioOption } from '../../types';
import { crediarioHardBlock, OPTION_BLOCK_LABELS, optionBlockReason } from '../../utils/checkout';

interface Props {
  crediario: ISaleSimulationCrediario;
  selected: number | null;
  onSelect: (installments: number) => void;
  /** Margem da venda em cada opção: só para quem vê lucro (ADMIN). */
  showMargin: boolean;
  disabled?: boolean;
}

const percent = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function surchargeText(option: ISaleSimulationCrediarioOption): string {
  return option.surcharge > 0 ? `${formatCurrency(option.surcharge)} (${percent(option.surchargePercent)})` : 'Sem acréscimo';
}

function marginText(option: ISaleSimulationCrediarioOption): string {
  return option.margin ? `${formatCurrency(option.margin.amount)} (${percent(option.margin.percent)})` : '—';
}

const optionLabel = (option: ISaleSimulationCrediarioOption) => `${option.installments}x de ${formatCurrency(option.installmentAmount)}`;

/**
 * Todas as opções do crediário (1..máximo) com entrada, parcela, total a prazo e acréscimo.
 * Opção que precisa de autorização (limite/atraso) fica esmaecida com o motivo, mas pode ser
 * escolhida; crediário desligado ou ficha suspensa desabilita todas. Celular: cartões.
 */
export function CrediarioSimulationTable({ crediario, selected, onSelect, showMargin, disabled = false }: Props) {
  const isWide = useBreakpoint('md');
  const locked = disabled || crediarioHardBlock(crediario) !== null;

  if (crediario.options.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted">Nada a financiar: a entrada cobre o total.</p>;
  }

  const rows = crediario.options.map((option) => {
    const reason = optionBlockReason(crediario, option);
    const radio = (
      <input
        type="radio"
        name="crediario-option"
        className="h-5 w-5 shrink-0 accent-primary"
        aria-label={optionLabel(option)}
        checked={selected === option.installments}
        disabled={locked}
        onChange={() => onSelect(option.installments)}
      />
    );
    return { option, reason, radio, isSelected: selected === option.installments };
  });

  if (!isWide) {
    return (
      <div role="radiogroup" aria-label="Opções do crediário" className="flex flex-col gap-2">
        {rows.map(({ option, reason, radio, isSelected }) => (
          <label
            key={option.installments}
            data-blocked={reason ? 'true' : undefined}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary' : reason ? 'bg-surface-muted' : 'bg-surface'} ${locked ? 'cursor-not-allowed' : ''}`}
          >
            <span className="pt-0.5">{radio}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-base font-semibold ${reason ? 'text-muted' : ''}`}>{optionLabel(option)}</span>
                {reason && <Badge tone={locked ? 'neutral' : 'warning'}>{OPTION_BLOCK_LABELS[reason]}</Badge>}
              </span>
              {option.lastInstallmentAmount !== option.installmentAmount && <span className="text-muted">última {formatCurrency(option.lastInstallmentAmount)}</span>}
              <span className="text-muted">
                Entrada {formatCurrency(option.downPayment)} · Total {formatCurrency(option.total)}
              </span>
              <span className="text-muted">Acréscimo: {surchargeText(option)}</span>
              {showMargin && <span className="text-muted">Margem: {marginText(option)}</span>}
            </span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label="Opções do crediário" className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Parcelas</th>
            <th className="px-3 py-2 text-right font-medium">Entrada</th>
            <th className="px-3 py-2 text-right font-medium">Parcela</th>
            <th className="px-3 py-2 text-right font-medium">Total a prazo</th>
            <th className="px-3 py-2 text-right font-medium">Acréscimo</th>
            {showMargin && <th className="px-3 py-2 text-right font-medium">Margem</th>}
            <th className="px-3 py-2 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ option, reason, radio, isSelected }) => (
            <tr
              key={option.installments}
              data-blocked={reason ? 'true' : undefined}
              onClick={() => !locked && onSelect(option.installments)}
              className={`border-t tabular-nums ${locked ? '' : 'cursor-pointer'} ${isSelected ? 'bg-primary/10' : reason ? 'bg-surface-muted text-muted' : 'hover:bg-surface-muted'}`}
            >
              <td className="px-3 py-2">
                <span className="flex items-center gap-3">
                  {radio}
                  <span className="font-semibold">{option.installments}x</span>
                </span>
              </td>
              <td className="px-3 py-2 text-right">{formatCurrency(option.downPayment)}</td>
              <td className="px-3 py-2 text-right">
                <span className="block font-medium">{formatCurrency(option.installmentAmount)}</span>
                {option.lastInstallmentAmount !== option.installmentAmount && <span className="block text-xs text-muted">última {formatCurrency(option.lastInstallmentAmount)}</span>}
              </td>
              <td className="px-3 py-2 text-right font-medium">{formatCurrency(option.total)}</td>
              <td className="px-3 py-2 text-right">{surchargeText(option)}</td>
              {showMargin && (
                <td data-testid="option-margin" className="px-3 py-2 text-right">
                  {marginText(option)}
                </td>
              )}
              <td className="px-3 py-2">{reason ? <Badge tone={locked ? 'neutral' : 'warning'}>{OPTION_BLOCK_LABELS[reason]}</Badge> : <span className="text-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
