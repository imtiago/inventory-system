import { Toaster } from "sonner";

import { useBreakpoint } from "@/shared/hooks/useMediaQuery";

/** Celular: no topo central e sem expandir (não cobre o cabeçalho). */
export function AppToaster() {
  const isSm = useBreakpoint("sm");
  return <Toaster position={isSm ? "top-right" : "top-center"} richColors closeButton expand={isSm} />;
}
