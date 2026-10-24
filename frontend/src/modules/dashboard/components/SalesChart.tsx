import { formatCurrency } from '@/shared/utils/money';
import { formatDateOnly } from '@/shared/utils/formatDateOnly';
import type { IDashboardDay } from '../types';

const MIN_BAR_PERCENT = 3;

function dayLabel(date: string) {
  return formatDateOnly(date).slice(0, 5);
}

function salesText(count: number) {
  return `${count} ${count === 1 ? 'venda' : 'vendas'}`;
}

export function SalesChart({ days }: { days: IDashboardDay[] }) {
  const max = Math.max(...days.map((day) => day.total), 0);

  return (
    <div>
      <div role="img" aria-label="Gráfico de vendas dos últimos 7 dias" className="flex h-40 items-end gap-2">
        {days.map((day) => {
          const percent = max > 0 ? Math.max((day.total / max) * 100, MIN_BAR_PERCENT) : MIN_BAR_PERCENT;
          const label = dayLabel(day.date);

          return (
            <div key={day.date} className="flex h-full flex-1 flex-col justify-end text-center">
              <div
                data-testid="sales-bar"
                aria-label={`${label}: ${formatCurrency(day.total)} (${salesText(day.count)})`}
                title={`${formatCurrency(day.total)} (${salesText(day.count)})`}
                style={{ height: `${percent}%` }}
                className="w-full rounded-t bg-blue-600"
              />
              <span className="mt-1 text-xs text-gray-500" aria-hidden="true">
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <table className="sr-only" aria-label="Vendas por dia">
        <thead>
          <tr>
            <th>Dia</th>
            <th>Total</th>
            <th>Vendas</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{dayLabel(day.date)}</td>
              <td>{formatCurrency(day.total)}</td>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
