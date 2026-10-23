import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";

import { useAuthStore } from "@/shared/store/auth";
import { useLogout } from "@/shared/auth/useLogout";
import { can } from "@/shared/auth/permissions";
import { allRoutes } from "@/routes/routes";
import type { AppRoute } from "@/routes/types";

function renderItem(item: AppRoute) {
  const Icon = item.icon;
  if (!Icon) return null;

  return (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === "/"}
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
  const logout = useLogout();
  const role = useAuthStore((state) => state.user?.role);

  const items = allRoutes.filter((route) => route.showInMenu && (!route.permission || can(role, route.permission)));
  const ungrouped = items.filter((item) => !item.group);
  const groups = [...new Set(items.flatMap((item) => (item.group ? [item.group] : [])))];

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
        {ungrouped.map(renderItem)}

        {groups.map((group) => (
          <div key={group}>
            <div className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</div>
            {items.filter((item) => item.group === group).map(renderItem)}
          </div>
        ))}
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
