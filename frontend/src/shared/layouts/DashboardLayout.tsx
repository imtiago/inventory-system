import { Outlet, Link } from "react-router-dom";

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-4">
        <h2 className="text-lg font-semibold mb-4">Sistema</h2>

        <nav className="flex flex-col gap-2">
          <Link to="/products">Produtos</Link>
        </nav>
      </aside>

      <main className="flex-1 p-6 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
