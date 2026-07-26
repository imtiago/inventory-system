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
            text-gray-600
            hover:text-black
            w-fit
          "
        >
          <ArrowLeft size={18} />
          Voltar
        </Link>
      )}

      {/* <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>

          {description && <p className="text-gray-500 mt-1">{description}</p>}
        </div>

        {actions}
      </div> */}
    </div>
  );
}
