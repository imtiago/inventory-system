import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Boxes,
  Wallet,
  LogOut,
} from "lucide-react";

import { useAuthStore } from "@/shared/store/auth";

const menuItems = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Produtos",
    path: "/products",
    icon: Package,
  },
  {
    label: "Vendas",
    path: "/sales",
    icon: ShoppingCart,
  },
  {
    label: "Clientes",
    path: "/customers",
    icon: Users,
  },
  {
    label: "Estoque",
    path: "/inventory",
    icon: Boxes,
  },
];

const financeItems = [
  {
    label: "Contas a receber",
    path: "/receivables",
    icon: Wallet,
  },
];

function renderItem(item: { label: string; path: string; icon: typeof Wallet }) {
  const Icon = item.icon;

  return (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) =>
        `
        flex items-center gap-3
        px-4 py-3
        rounded-lg
        mb-1
        transition
        ${isActive ? "bg-slate-700" : "hover:bg-slate-800"}
        `
      }
    >
      <Icon size={20} />

      <span>{item.label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const logout = useAuthStore((state) => state.logout);

  return (
    <aside
      className="
        w-64
        h-screen
        bg-slate-900
        text-white
        flex
        flex-col
      "
    >
      <div className="p-6 text-xl font-bold">Inventory System</div>

      <nav className="flex-1 px-3">
        {menuItems.map(renderItem)}

        <div className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Financeiro</div>
        {financeItems.map(renderItem)}
      </nav>

      <button
        onClick={logout}
        className="
          flex items-center gap-3
          px-6 py-4
          hover:bg-slate-800
        "
      >
        <LogOut size={20} />
        Sair
      </button>
    </aside>
  );
}
