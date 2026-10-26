import { Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import { ChunkErrorBoundary } from "@/shared/components/ChunkErrorBoundary";
import { MobileDrawer } from "@/shared/components/layout/MobileDrawer";
import { useBreakpoint } from "@/shared/hooks/useMediaQuery";
import { allRoutes } from "@/routes/routes";

/** Nome da tela para a barra superior: rota que casa com o caminho atual (`:param` vira qualquer segmento). */
function screenTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const match = allRoutes.find((route) => {
    const parts = route.path.split("/").filter(Boolean);
    return parts.length === segments.length && parts.every((part, i) => part.startsWith(":") || part === segments[i]);
  });
  return match?.label ?? "Estoque";
}

export function DashboardLayout() {
  const { pathname } = useLocation();
  const isDesktop = useBreakpoint("lg");
  // A gaveta fica aberta para uma tela/largura específica: navegar (inclusive voltar/avançar) ou
  // crescer para o menu fixo muda a chave e a fecha, sem efeito colateral.
  const stateKey = `${pathname}|${isDesktop}`;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const menuOpen = openKey === stateKey;
  const setMenuOpen = (open: boolean) => setOpenKey(open ? stateKey : null);

  return (
    <div className="flex h-screen supports-[height:100dvh]:h-dvh flex-col overflow-hidden lg:flex-row">
      {isDesktop ? (
        <div className="h-full shrink-0">
          <Sidebar />
        </div>
      ) : (
        <>
          <header className="flex min-h-14 shrink-0 items-center gap-2 bg-slate-900 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] text-white">
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-800">
              <Menu size={24} />
            </button>
            <span className="truncate text-lg font-semibold">{screenTitle(pathname)}</span>
          </header>

          <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </MobileDrawer>
        </>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))] lg:p-6">
        {/* The menu stays mounted while a page chunk loads or fails to load. */}
        <ChunkErrorBoundary resetKey={pathname}>
          <Suspense fallback={<p role="status" className="p-4 text-sm text-gray-500">Carregando...</p>}>
            <Outlet />
          </Suspense>
        </ChunkErrorBoundary>
      </main>
    </div>
  );
}
