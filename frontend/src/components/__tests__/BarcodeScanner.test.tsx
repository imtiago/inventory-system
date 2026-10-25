import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const h = vi.hoisted(() => ({
  loaded: vi.fn(),
  getCameras: vi.fn(),
  start: vi.fn(),
  torchApply: vi.fn(),
  torchSupported: true,
  onSuccess: null as null | ((text: string) => void),
}));

vi.mock('html5-qrcode', () => {
  h.loaded();
  class Html5Qrcode {
    static getCameras = h.getCameras;
    start = (...args: unknown[]) => {
      h.onSuccess = args[2] as (text: string) => void;
      return h.start(...args);
    };
    stop = vi.fn().mockResolvedValue(undefined);
    clear = vi.fn();
    getRunningTrackCameraCapabilities = () => ({
      torchFeature: () => ({ isSupported: () => h.torchSupported, apply: h.torchApply }),
    });
  }
  return { Html5Qrcode, Html5QrcodeSupportedFormats: { EAN_13: 1, EAN_8: 2, UPC_A: 3, UPC_E: 4, CODE_128: 5, CODE_39: 6, ITF: 7 } };
});

function setSecure(secure: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  Object.defineProperty(navigator, 'mediaDevices', { value: secure ? { getUserMedia: vi.fn() } : undefined, configurable: true });
}

const cameraError = (name: string) => Object.assign(new Error(name), { name });

beforeEach(() => {
  setSecure(true);
  h.getCameras.mockReset().mockResolvedValue([{ id: 'cam-1', label: 'Câmera traseira' }]);
  h.start.mockReset().mockResolvedValue(undefined);
  h.torchApply.mockReset().mockResolvedValue(undefined);
  h.torchSupported = true;
  h.onSuccess = null;
  h.loaded.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function renderScanner(props: Record<string, unknown> = {}) {
  const { BarcodeScanner } = await import('../BarcodeScanner');
  const onDetected = vi.fn();
  render(<BarcodeScanner onDetected={onDetected} {...props} />);
  return onDetected;
}

describe('BarcodeScanner', () => {
  test('html5-qrcode só é carregado quando o scanner é aberto', async () => {
    const { BarcodeScanner } = await import('../BarcodeScanner');
    expect(h.loaded).not.toHaveBeenCalled();

    render(<BarcodeScanner onDetected={() => {}} />);

    await vi.waitFor(() => expect(h.loaded).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.queryByText('Carregando câmeras...')).not.toBeInTheDocument());
  });

  test('sem contexto seguro mostra a mensagem de HTTPS e nem carrega a biblioteca', async () => {
    setSecure(false);
    await renderScanner();

    expect(await screen.findByText(/A câmera só funciona em conexão segura \(HTTPS\)\. Peça ao administrador para acessar o sistema por https:\/\//)).toBeInTheDocument();
    expect(h.getCameras).not.toHaveBeenCalled();
    expect(h.start).not.toHaveBeenCalled();
  });

  test('permissão negada explica como liberar e "Tentar de novo" tenta outra vez', async () => {
    h.getCameras.mockRejectedValueOnce(cameraError('NotAllowedError'));
    const user = userEvent.setup();
    await renderScanner();

    expect(await screen.findByText(/liberar a câmera/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await vi.waitFor(() => expect(h.start).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/liberar a câmera/i)).not.toBeInTheDocument();
    expect(h.getCameras).toHaveBeenCalledTimes(2);
  });

  test('permissão negada ao iniciar também vira a mensagem de permissão', async () => {
    h.start.mockRejectedValueOnce(cameraError('NotAllowedError'));
    await renderScanner();

    expect(await screen.findByText(/liberar a câmera/i)).toBeInTheDocument();
  });

  test('sem câmera mostra "Nenhuma câmera encontrada"', async () => {
    h.getCameras.mockResolvedValue([]);
    await renderScanner();

    expect(await screen.findByText('Nenhuma câmera encontrada')).toBeInTheDocument();
  });

  test('inicia com a câmera traseira (facingMode environment)', async () => {
    await renderScanner();

    await vi.waitFor(() => expect(h.start).toHaveBeenCalledTimes(1));
    expect(h.start.mock.calls[0][0]).toEqual({ facingMode: 'environment' });
    expect(typeof h.start.mock.calls[0][1].qrbox).toBe('function');
  });

  test('qrbox é proporcional ao visor', async () => {
    await renderScanner();
    await vi.waitFor(() => expect(h.start).toHaveBeenCalled());

    const { qrbox } = h.start.mock.calls[0][1];
    expect(qrbox(1000, 500)).toEqual({ width: 800, height: 175 });
    expect(qrbox(300, 100)).toEqual({ width: 240, height: 50 });
  });

  test('escolher outra câmera reinicia com o id dela', async () => {
    h.getCameras.mockResolvedValue([
      { id: 'cam-a', label: 'Ultra-wide' },
      { id: 'cam-b', label: 'Principal' },
    ]);
    const user = userEvent.setup();
    await renderScanner();
    await vi.waitFor(() => expect(h.start).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByLabelText('Câmera'), 'cam-b');

    await vi.waitFor(() => expect(h.start).toHaveBeenCalledTimes(2));
    expect(h.start.mock.calls[1][0]).toBe('cam-b');
  });

  test('lanterna: botão aparece quando suportada e liga/desliga', async () => {
    const user = userEvent.setup();
    await renderScanner();

    const button = await screen.findByRole('button', { name: 'Lanterna' });
    await user.click(button);
    expect(h.torchApply).toHaveBeenLastCalledWith(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);
    expect(h.torchApply).toHaveBeenLastCalledWith(false);
  });

  test('lanterna: botão some quando o aparelho não suporta', async () => {
    h.torchSupported = false;
    await renderScanner();
    await vi.waitFor(() => expect(h.start).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.queryByText('Carregando câmeras...')).not.toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Lanterna' })).not.toBeInTheDocument();
  });

  test('modo padrão entrega só a primeira leitura e vibra', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const onDetected = await renderScanner();
    await vi.waitFor(() => expect(h.onSuccess).not.toBeNull());

    h.onSuccess!('111');
    h.onSuccess!('222');

    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith('111');
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  test('leitura contínua ignora a mesma leitura por 1,5 s e aceita outro código', async () => {
    const onDetected = await renderScanner({ continuous: true });
    await vi.waitFor(() => expect(h.onSuccess).not.toBeNull());

    vi.useFakeTimers();
    h.onSuccess!('111');
    vi.advanceTimersByTime(1000);
    h.onSuccess!('111');
    expect(onDetected).toHaveBeenCalledTimes(1);

    h.onSuccess!('222');
    expect(onDetected).toHaveBeenCalledTimes(2);
    expect(onDetected).toHaveBeenLastCalledWith('222');

    vi.advanceTimersByTime(1600);
    h.onSuccess!('222');
    expect(onDetected).toHaveBeenCalledTimes(3);
  });

  test('leitura contínua mantém a câmera aberta e mostra o último código', async () => {
    await renderScanner({ continuous: true });
    await vi.waitFor(() => expect(h.onSuccess).not.toBeNull());

    await act(async () => {
      h.onSuccess!('111');
    });

    expect(screen.getByText(/111/)).toBeInTheDocument();
  });
});
