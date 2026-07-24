import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main
        className="
          flex-1
          bg-slate-100
          p-6
          overflow-hidden
        "
      >
        <Outlet />
      </main>
    </div>
  );
}
