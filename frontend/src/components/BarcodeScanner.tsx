import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

type Camera = {
  id: string;
  label: string;
};

type Props = {
  onDetected: (code: string) => void;
  stopAfterDetection?: boolean;
};

export const BarcodeScanner = ({ onDetected, stopAfterDetection = true }: Props) => {
  const scannerId = useId().replace(/:/g, '');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDetectedRef = useRef(onDetected);
  const detectedRef = useRef(false);

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  /*
   * Obtém as câmeras disponíveis.
   */
  useEffect(() => {
    const loadCameras = async () => {
      try {
        setLoading(true);
        setError(null);

        const devices = await Html5Qrcode.getCameras();

        if (!devices || devices.length === 0) {
          setError('Nenhuma câmera foi encontrada.');
          return;
        }

        const cameraList = devices.map((device, index) => ({
          id: device.id,
          label: device.label || `Câmera ${index + 1}`,
        }));

        setCameras(cameraList);

        /*
         * Tenta selecionar automaticamente
         * a câmera traseira.
         */
        const rearCamera = cameraList.find((camera) => /back|rear|environment|traseira/i.test(camera.label));

        setSelectedCamera(rearCamera?.id ?? cameraList[0].id);
      } catch (err) {
        console.error('[BarcodeScanner] Erro ao listar câmeras:', err);

        setError('Não foi possível acessar as câmeras.');
      } finally {
        setLoading(false);
      }
    };

    loadCameras();
  }, []);

  /*
   * Inicializa o leitor.
   */
  useEffect(() => {
    if (!selectedCamera) {
      return;
    }

    const scanner = new Html5Qrcode(scannerId, {
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

    scannerRef.current = scanner;
    detectedRef.current = false;

    const startScanner = async () => {
      try {
        await scanner.start(
          selectedCamera,
          {
            fps: 10,

            qrbox: {
              width: 300,
              height: 120,
            },

            aspectRatio: 1.777778,
          },

          (decodedText) => {
            if (detectedRef.current) {
              return;
            }

            detectedRef.current = true;

            console.log('[BarcodeScanner] Código detectado:', decodedText);

            onDetectedRef.current(decodedText);

            if (stopAfterDetection) {
              scanner.stop().catch(() => {});
            }
          },

          () => {
            /*
             * Não fazemos log aqui.
             *
             * Essa função é chamada constantemente enquanto
             * a câmera tenta encontrar um código.
             */
          },
        );
      } catch (err) {
        console.error('[BarcodeScanner] Erro ao iniciar câmera:', err);

        setError('Não foi possível iniciar a câmera selecionada.');
      }
    };

    startScanner();

    return () => {
      const cleanup = async () => {
        try {
          await scanner.stop();
        } catch {
          // Scanner já pode estar parado.
        }

        try {
          await scanner.clear();
        } catch {
          // Elemento já pode ter sido removido.
        }

        scannerRef.current = null;
      };

      cleanup();
    };
  }, [scannerId, selectedCamera, stopAfterDetection]);

  if (loading) {
    return (
      <div>
        <p>Carregando câmeras...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
      }}
    >
      {cameras.length > 1 && (
        <div style={{ marginBottom: '12px' }}>
          <label
            htmlFor={`${scannerId}-camera`}
            style={{
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Câmera
          </label>

          <select
            id={`${scannerId}-camera`}
            value={selectedCamera}
            onChange={(event) => {
              setSelectedCamera(event.target.value);
            }}
            style={{
              width: '100%',
              padding: '8px',
            }}
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div id={scannerId} />
    </div>
  );
};
