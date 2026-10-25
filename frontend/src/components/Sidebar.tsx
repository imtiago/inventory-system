import { useState } from "react";
import { NavLink } from "react-router-dom";
import { KeyRound, LogOut } from "lucide-react";

import { useAuthStore } from "@/shared/store/auth";
import { useLogout } from "@/shared/auth/useLogout";
import { can } from "@/shared/auth/permissions";
import { ChangePasswordModal } from "@/modules/auth/components/ChangePasswordModal";
import { allRoutes } from "@/routes/routes";
import type { AppRoute } from "@/routes/types";

function renderItem(item: AppRoute, onNavigate?: () => void) {
  const Icon = item.icon;
  if (!Icon) return null;

  return (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        `
        flex items-center gap-3
        min-h-11 px-4 py-3
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

interface SidebarProps {
  /** Chamado ao escolher um item do menu (a gaveta usa para fechar). */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const logout = useLogout();
  const [changingPassword, setChangingPassword] = useState(false);
  const role = useAuthStore((state) => state.user?.role);

  const items = allRoutes.filter((route) => route.showInMenu && (!route.permission || can(role, route.permission)));
  const ungrouped = items.filter((item) => !item.group);
  const groups = [...new Set(items.flatMap((item) => (item.group ? [item.group] : [])))];

  return (
    <aside
      className="
        w-64
        h-full
        bg-slate-900
        text-white
        flex
        flex-col
      "
    >
      <div className="shrink-0 p-6 pr-14 text-xl font-bold lg:pr-6">Inventory System</div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3">
        {ungrouped.map((item) => renderItem(item, onNavigate))}

        {groups.map((group) => (
          <div key={group}>
            <div className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</div>
            {items.filter((item) => item.group === group).map((item) => renderItem(item, onNavigate))}
          </div>
        ))}
      </nav>

      <button
        onClick={() => setChangingPassword(true)}
        className="
          flex items-center gap-3
          shrink-0 min-h-11 px-6 py-4
          hover:bg-slate-800
        "
      >
        <KeyRound size={20} />
        Alterar senha
      </button>

      <button
        onClick={logout}
        className="
          flex items-center gap-3
          shrink-0 min-h-11 px-6 py-4
          hover:bg-slate-800
        "
      >
        <LogOut size={20} />
        Sair
      </button>

      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </aside>
  );
}
