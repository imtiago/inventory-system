import { useState } from "react";
import { NavLink } from "react-router-dom";
import { KeyRound, LogOut } from "lucide-react";

import { useAuthStore } from "@/shared/store/auth";
import { useLogout } from "@/shared/auth/useLogout";
import { can } from "@/shared/auth/permissions";
import { ChangePasswordModal } from "@/modules/auth/components/ChangePasswordModal";
import { ThemeSelector } from "@/components/ThemeSelector";
import { allRoutes } from "@/routes/routes";
import type { AppRoute } from "@/routes/types";
import { usePriceReviewCount } from "@/modules/pricing/hooks/usePriceReviews";

const PRICE_REVIEWS_PATH = "/catalog/price-reviews";

/** Pendentes de revisão de preço; o hook só consulta quem tem `catalog.price`. */
function PriceReviewBadge() {
  const { data } = usePriceReviewCount();
  if (!data) return null;

  return (
    <span aria-label={`${data} ${data === 1 ? "pendente" : "pendentes"}`} className="ml-auto min-w-6 rounded-full bg-warning-soft px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-warning">
      {data > 99 ? "99+" : data}
    </span>
  );
}

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
        min-h-11 px-4 py-3 lg:min-h-8 lg:py-1.5
        rounded-lg
        mb-0.5
        transition
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${isActive ? "bg-sidebar-active font-medium text-sidebar-foreground shadow-[inset_3px_0_0_rgb(var(--primary))]" : "text-sidebar-foreground/90 hover:bg-sidebar-active/60 hover:text-sidebar-foreground"}
        `
      }
    >
      <Icon size={20} />

      <span>{item.label}</span>

      {item.path === PRICE_REVIEWS_PATH && <PriceReviewBadge />}
    </NavLink>
  );
}

const footerButton =
  "flex w-full items-center gap-3 min-h-11 rounded-lg px-4 py-3 lg:min-h-8 lg:py-1.5 text-sidebar-foreground/90 transition hover:bg-sidebar-active/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
        bg-sidebar
        text-sidebar-foreground
        flex
        flex-col
        pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)]
      "
    >
      <div className="shrink-0 p-6 pr-14 text-xl font-bold lg:px-6 lg:pb-3 lg:pt-5">Estoque</div>

      <nav aria-label="Menu principal" className="scroll-shadow min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">
        {ungrouped.map((item) => renderItem(item, onNavigate))}

        {groups.map((group) => (
          <div key={group}>
            <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">{group}</div>
            {items.filter((item) => item.group === group).map((item) => renderItem(item, onNavigate))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-active px-3 pb-2 pt-3">
        <ThemeSelector />

        <button onClick={() => setChangingPassword(true)} className={footerButton}>
          <KeyRound size={20} />
          Alterar senha
        </button>

        <button onClick={logout} className={footerButton}>
          <LogOut size={20} />
          Sair
        </button>
      </div>

      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </aside>
  );
}
