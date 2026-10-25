import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const loaded = vi.fn();

vi.mock('html5-qrcode', () => {
  loaded();
  class Html5Qrcode {
    static getCameras = vi.fn().mockResolvedValue([{ id: 'cam-1', label: 'Câmera traseira' }]);
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    clear = vi.fn();
  }
  return { Html5Qrcode, Html5QrcodeSupportedFormats: { EAN_13: 1, EAN_8: 2, UPC_A: 3, UPC_E: 4, CODE_128: 5, CODE_39: 6, ITF: 7 } };
});

describe('BarcodeScanner', () => {
  test('html5-qrcode só é carregado quando o scanner é aberto', async () => {
    const { BarcodeScanner } = await import('../BarcodeScanner');
    expect(loaded).not.toHaveBeenCalled();

    render(<BarcodeScanner onDetected={() => {}} />);

    await vi.waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.queryByText('Carregando câmeras...')).not.toBeInTheDocument());
  });
});
