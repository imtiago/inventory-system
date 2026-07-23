import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      <Sidebar />

      <main
        className="
          flex-1
          min-w-0
          overflow-y-auto
          bg-slate-100
          p-6
        "
      >
        <Outlet />
      </main>
    </div>
  );
}
