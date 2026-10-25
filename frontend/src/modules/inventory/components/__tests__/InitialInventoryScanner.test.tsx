import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InitialInventoryScanner } from '../InitialInventoryScanner';

vi.mock('@/components/BarcodeScanner', () => ({ BarcodeScanner: () => <div>scanner</div> }));

function setup(props: Partial<React.ComponentProps<typeof InitialInventoryScanner>> = {}) {
  const onBarcodeRead = vi.fn();
  render(<InitialInventoryScanner barcode="" loading={false} scannerOpen={false} onOpenScanner={() => {}} onCloseScanner={() => {}} onBarcodeRead={onBarcodeRead} {...props} />);
  return { onBarcodeRead };
}

describe('InitialInventoryScanner', () => {
  test('o campo é editável: digitar e Enter busca o código (leitor Bluetooth/USB)', async () => {
    const { onBarcodeRead } = setup();

    await userEvent.type(screen.getByLabelText('Código de barras'), '7891234567890{Enter}');

    expect(onBarcodeRead).toHaveBeenCalledWith('7891234567890');
  });

  test('o botão "Buscar" também busca o código digitado', async () => {
    const { onBarcodeRead } = setup();

    await userEvent.type(screen.getByLabelText('Código de barras'), ' 123 ');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onBarcodeRead).toHaveBeenCalledWith('123');
  });

  test('"Buscar" fica desabilitado com o campo vazio e Enter vazio não busca', async () => {
    const { onBarcodeRead } = setup();

    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Código de barras'), '{Enter}');
    expect(onBarcodeRead).not.toHaveBeenCalled();
  });

  test('mostra o código vindo da leitura pela câmera e continua editável', async () => {
    setup({ barcode: '999' });

    const input = screen.getByLabelText('Código de barras');
    expect(input).toHaveValue('999');
    expect(input).not.toHaveAttribute('readonly');
  });

  test('"📷 Ler" continua abrindo a câmera', async () => {
    const onOpenScanner = vi.fn();
    setup({ onOpenScanner });

    await userEvent.click(screen.getByRole('button', { name: '📷 Ler' }));

    expect(onOpenScanner).toHaveBeenCalled();
  });
});
