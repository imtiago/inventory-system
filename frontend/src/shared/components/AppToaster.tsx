import { Toaster } from "sonner";

import { useBreakpoint } from "@/shared/hooks/useMediaQuery";
import { useThemeStore } from "@/shared/store/theme";

/** Celular: no topo central e sem expandir (não cobre o cabeçalho). As cores seguem o tema do app. */
export function AppToaster() {
  const isSm = useBreakpoint("sm");
  const theme = useThemeStore((state) => state.resolved);
  return <Toaster theme={theme} position={isSm ? "top-right" : "top-center"} richColors closeButton expand={isSm} />;
}
