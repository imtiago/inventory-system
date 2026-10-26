import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SaleBarcodeInput } from '../SaleBarcodeInput';

vi.mock('@/components/BarcodeScanner', () => ({
  BarcodeScanner: ({ onDetected, continuous }: { onDetected: (code: string) => void; continuous?: boolean }) => (
    <div data-testid="scanner" data-continuous={String(!!continuous)}>
      <button type="button" onClick={() => onDetected('111')}>
        Ler 111
      </button>
      <button type="button" onClick={() => onDetected('222')}>
        Ler 222
      </button>
    </div>
  ),
}));

describe('SaleBarcodeInput', () => {
  test('digitar e apertar Enter adiciona o código', async () => {
    const onSubmitBarcode = vi.fn();
    render(<SaleBarcodeInput loading={false} onSubmitBarcode={onSubmitBarcode} />);

    await userEvent.type(screen.getByLabelText('Código de barras do produto'), '789{Enter}');

    expect(onSubmitBarcode).toHaveBeenCalledWith('789');
  });

  test('abre o leitor em modo contínuo', async () => {
    render(<SaleBarcodeInput loading={false} onSubmitBarcode={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Escanear' }));

    expect(screen.getByTestId('scanner')).toHaveAttribute('data-continuous', 'true');
  });

  test('cada leitura adiciona o item e a câmera continua aberta', async () => {
    const onSubmitBarcode = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SaleBarcodeInput loading={false} onSubmitBarcode={onSubmitBarcode} />);

    await user.click(screen.getByRole('button', { name: 'Escanear' }));
    await user.click(screen.getByRole('button', { name: 'Ler 111' }));
    await user.click(screen.getByRole('button', { name: 'Ler 222' }));

    await waitFor(() => expect(onSubmitBarcode).toHaveBeenCalledTimes(2));
    expect(onSubmitBarcode).toHaveBeenNthCalledWith(1, '111');
    expect(onSubmitBarcode).toHaveBeenNthCalledWith(2, '222');
    expect(screen.getByTestId('scanner')).toBeInTheDocument();
  });

  test('leituras seguidas são processadas uma de cada vez', async () => {
    const order: string[] = [];
    let release!: () => void;
    const first = new Promise<void>((resolve) => (release = resolve));
    const onSubmitBarcode = vi.fn(async (code: string) => {
      order.push(`start ${code}`);
      if (code === '111') await first;
      order.push(`end ${code}`);
    });
    const user = userEvent.setup();
    render(<SaleBarcodeInput loading={false} onSubmitBarcode={onSubmitBarcode} />);

    await user.click(screen.getByRole('button', { name: 'Escanear' }));
    await user.click(screen.getByRole('button', { name: 'Ler 111' }));
    await user.click(screen.getByRole('button', { name: 'Ler 222' }));
    expect(order).toEqual(['start 111']);

    release();

    await waitFor(() => expect(order).toEqual(['start 111', 'end 111', 'start 222', 'end 222']));
  });

  test('"Fechar câmera" fecha o leitor', async () => {
    const user = userEvent.setup();
    render(<SaleBarcodeInput loading={false} onSubmitBarcode={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Escanear' }));
    await user.click(screen.getByRole('button', { name: 'Fechar câmera' }));

    expect(screen.queryByTestId('scanner')).not.toBeInTheDocument();
  });
});
