import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ChunkErrorBoundary } from "@/shared/components/ChunkErrorBoundary";

export function DashboardLayout() {
  const { pathname } = useLocation();

  return (
    <div
      className="
        flex
        h-screen
        overflow-hidden
      "
    >
      <Sidebar />

      <main
        className="
    flex-1
    bg-slate-100
    p-6
    overflow-y-auto
    min-h-0
  "
      >
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
