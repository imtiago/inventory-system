import { useId } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useThemeStore } from "@/shared/store/theme";
import type { ThemePreference } from "@/shared/theme/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Seguir o sistema", icon: Monitor },
];

/**
 * Escolha do tema no rodapé do menu, numa linha só (o menu precisa da altura): rádios nativos, então as setas do
 * teclado funcionam; cada opção tem nome acessível e dica com o texto completo.
 */
export function ThemeSelector() {
  const id = useId();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-1 pl-4 pr-1">
      <span id={`${id}-label`} className="text-sm text-sidebar-foreground/90">
        Tema
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex gap-0.5 rounded-lg bg-sidebar-active p-0.5">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            title={label}
            className="flex h-10 w-11 cursor-pointer items-center justify-center rounded-md text-sidebar-muted transition hover:text-sidebar-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-sidebar"
          >
            <input type="radio" className="sr-only" name={`${id}-theme`} value={value} aria-label={label} checked={preference === value} onChange={() => setPreference(value)} />
            <Icon size={18} aria-hidden="true" />
          </label>
        ))}
      </div>
    </div>
  );
}
