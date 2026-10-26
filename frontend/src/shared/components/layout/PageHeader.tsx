// shared/components/layout/PageHeader.tsx

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;

  description?: string;

  backPath?: string;

  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  backPath,
  actions,
}: PageHeaderProps) {
  return (
    <div className="space-y-4">
      {backPath && (
        <Link
          to={backPath}
          className="
            flex
            items-center
            gap-2
            text-muted
            hover:text-foreground
            w-fit
          "
        >
          <ArrowLeft size={18} />
          Voltar
        </Link>
      )}

      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>

          {description && <p className="mt-1 text-muted">{description}</p>}
        </div>

        {actions}
      </div>
    </div>
  );
}
