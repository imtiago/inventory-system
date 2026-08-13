import { useEffect, useId } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

type Props = {
  onDetected: (code: string) => void;
  stopAfterDetection?: boolean;
};

export const BarcodeScanner = ({
  onDetected,
  stopAfterDetection = true,
}: Props) => {
  const scannerId = useId().replace(/:/g, "");

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      scannerId,
      {
        fps: 10,
        qrbox: 250,
        // qrbox: {
        //   width: 300,
        //   height: 120,
        // },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      },
      false,
    );

    scanner.render(
      (decodedText) => {
        onDetected(decodedText);

        if (stopAfterDetection) {
          scanner.clear().catch(() => {});
        }
      },
      () => {
        // console.warn("Erro na leitura do código:", error);
      },
      // (error) => {
      //   console.warn("Erro na leitura do código:", error);
      // },
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scannerId, onDetected, stopAfterDetection]);

  return <div id={scannerId} />;
};
