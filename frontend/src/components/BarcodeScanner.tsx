// src/components/BarcodeScanner.tsx
import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

type Props = {
  onDetected: (code: string) => void;
  stopAfterDetection?: boolean; // se true, para a câmera após ler
};

export const BarcodeScanner = ({
  onDetected,
  stopAfterDetection = true,
}: Props) => {
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scannerRef.current) return;

    const config = {
      fps: 10,
      qrbox: 250,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    };
    const scanner = new Html5QrcodeScanner(
      scannerRef.current.id,
      config,
      false,
    );

    scanner.render(
      (decodedText) => {
        onDetected(decodedText);
        if (stopAfterDetection) {
          scanner.clear();
        }
      },
      (error) => console.warn("Erro na leitura do código:", error),
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [onDetected, stopAfterDetection]);

  return <div id="barcode-scanner" ref={scannerRef}></div>;
};
