import { useEffect, useId, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';

/** html5-qrcode is heavy (~340 kB): it is only downloaded when a scanner is actually opened. */
const loadScannerLib = () => import('html5-qrcode');

/** Same code read again inside this window is ignored (the camera sees the same label on every frame). */
export const REPEAT_WINDOW_MS = 1500;

type Camera = {
  id: string;
  label: string;
};

type Status = 'loading' | 'ready' | 'insecure' | 'denied' | 'no-camera' | 'error';

type Props = {
  onDetected: (code: string) => void;
  stopAfterDetection?: boolean;
  /** Keeps the camera open and reports every distinct reading (sale/purchase item entry). */
  continuous?: boolean;
};

type TorchControl = { apply: (on: boolean) => Promise<void> };

const MESSAGES: Record<Exclude<Status, 'loading' | 'ready'>, string> = {
  insecure: 'A câmera só funciona em conexão segura (HTTPS). Peça ao administrador para acessar o sistema por https://… Enquanto isso, digite o código no campo.',
  denied: 'O acesso à câmera foi negado. Para liberar a câmera, toque no cadeado ou no ícone de configurações ao lado do endereço do site, permita o uso da câmera e tente de novo.',
  'no-camera': 'Nenhuma câmera encontrada',
  error: 'Não foi possível iniciar a câmera. Ela pode estar em uso por outro aplicativo.',
};

function errorText(err: unknown) {
  return typeof err === 'string' ? err : `${(err as Error)?.name ?? ''} ${(err as Error)?.message ?? ''}`;
}

function statusForError(err: unknown): Status {
  const text = errorText(err);
  if (/NotAllowed|Permission|denied/i.test(text)) return 'denied';
  if (/NotFound|DevicesNotFound/i.test(text)) return 'no-camera';
  return 'error';
}

function isSecure() {
  return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

export const BarcodeScanner = ({ onDetected, stopAfterDetection = true, continuous = false }: Props) => {
  const scannerId = useId().replace(/:/g, '');

  const onDetectedRef = useRef(onDetected);
  const detectedRef = useRef(false);
  const lastReadRef = useRef<{ code: string; at: number } | null>(null);
  const torchRef = useRef<TorchControl | null>(null);

  const [cameras, setCameras] = useState<Camera[]>([]);
  /** '' = let the browser pick the rear camera (facingMode: environment). */
  const [selectedCamera, setSelectedCamera] = useState('');
  const [status, setStatus] = useState<Status>(isSecure() ? 'loading' : 'insecure');
  const [attempt, setAttempt] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  /*
   * Lists the cameras (this is also what triggers the permission prompt).
   */
  useEffect(() => {
    if (!isSecure()) return;

    let disposed = false;

    const loadCameras = async () => {
      try {
        const { Html5Qrcode } = await loadScannerLib();
        const devices = await Html5Qrcode.getCameras();
        if (disposed) return;

        if (!devices || devices.length === 0) {
          setStatus('no-camera');
          return;
        }

        setCameras(devices.map((device, index) => ({ id: device.id, label: device.label || `Câmera ${index + 1}` })));
        setStatus('ready');
      } catch (err) {
        if (disposed) return;
        console.error('[BarcodeScanner] Erro ao listar câmeras:', err);
        setStatus(statusForError(err));
      }
    };

    void loadCameras();

    return () => {
      disposed = true;
    };
  }, [attempt]);

  /*
   * Starts the reader.
   */
  useEffect(() => {
    if (status !== 'ready') return;

    let disposed = false;
    let scanner: Html5Qrcode | null = null;
    detectedRef.current = false;
    lastReadRef.current = null;
    torchRef.current = null;

    const keepOpen = continuous || !stopAfterDetection;

    const handleDecoded = (decodedText: string) => {
      const now = Date.now();

      if (continuous) {
        const last = lastReadRef.current;
        // Refreshing the timestamp on repeats keeps a code held in front of the camera from being added again.
        lastReadRef.current = { code: decodedText, at: now };
        if (last && last.code === decodedText && now - last.at < REPEAT_WINDOW_MS) return;
      } else {
        if (detectedRef.current) return;
        detectedRef.current = true;
      }

      navigator.vibrate?.(80);
      setLastCode(decodedText);
      onDetectedRef.current(decodedText);

      if (!keepOpen) {
        scanner?.stop().catch(() => {});
      }
    };

    const startScanner = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await loadScannerLib();
        if (disposed) return;

        const instance = new Html5Qrcode(scannerId, {
          verbose: false,

          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
          ],
        });

        scanner = instance;

        await instance.start(
          selectedCamera ? selectedCamera : { facingMode: 'environment' },
          {
            fps: 10,

            // Proportional to the viewfinder: 80% of the width, 35% of the height (never below 50 px).
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
              width: Math.floor(viewfinderWidth * 0.8),
              height: Math.max(50, Math.floor(viewfinderHeight * 0.35)),
            }),

            aspectRatio: 1.777778,
          },
          handleDecoded,
          () => {
            /* Called on every frame without a code; intentionally silent. */
          },
        );

        if (disposed) return;

        try {
          const torch = instance.getRunningTrackCameraCapabilities?.()?.torchFeature?.();
          if (torch?.isSupported()) {
            torchRef.current = torch;
            setTorchSupported(true);
          }
        } catch {
          // Torch is optional: any failure just leaves the button hidden.
        }
      } catch (err) {
        if (disposed) return;
        console.error('[BarcodeScanner] Erro ao iniciar câmera:', err);
        setStatus(statusForError(err));
      }
    };

    void startScanner();

    return () => {
      disposed = true;
      torchRef.current = null;
      setTorchSupported(false);
      setTorchOn(false);
      const current = scanner;

      const cleanup = async () => {
        if (!current) return;

        try {
          await current.stop();
        } catch {
          // Scanner já pode estar parado.
        }

        try {
          current.clear();
        } catch {
          // Elemento já pode ter sido removido.
        }
      };

      void cleanup();
    };
  }, [scannerId, status, selectedCamera, stopAfterDetection, continuous]);

  async function toggleTorch() {
    const torch = torchRef.current;
    if (!torch) return;

    const next = !torchOn;

    try {
      await torch.apply(next);
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }

  function retry() {
    setStatus('loading');
    setAttempt((value) => value + 1);
  }

  if (status === 'loading') {
    return (
      <div>
        <p>Carregando câmeras...</p>
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <div role="alert" className="space-y-3">
        <p>{MESSAGES[status]}</p>

        {status !== 'insecure' && (
          <button type="button" onClick={retry} className="min-h-11 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Tentar de novo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[500px]">
      {cameras.length > 1 && (
        <div className="mb-3">
          <label htmlFor={`${scannerId}-camera`} className="mb-1.5 block">
            Câmera
          </label>

          <select id={`${scannerId}-camera`} value={selectedCamera} onChange={(event) => setSelectedCamera(event.target.value)} className="w-full rounded-lg border p-2">
            <option value="">Automática (traseira)</option>
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div id={scannerId} />

      {torchSupported && (
        <button
          type="button"
          aria-pressed={torchOn}
          onClick={() => void toggleTorch()}
          className={`mt-3 min-h-11 rounded-lg border px-4 py-2 text-sm font-medium ${torchOn ? 'bg-yellow-100' : 'hover:bg-gray-50'}`}
        >
          Lanterna
        </button>
      )}

      {continuous && lastCode && (
        <p role="status" className="mt-3 text-sm text-gray-600">
          Último código lido: <strong>{lastCode}</strong>
        </p>
      )}
    </div>
  );
};
