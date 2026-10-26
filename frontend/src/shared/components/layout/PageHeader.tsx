// shared/components/layout/PageHeader.tsx

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;

  description?: ReactNode;

  /** Selo/estado exibido logo abaixo do título (ex.: status da venda). */
  meta?: ReactNode;

  backPath?: string;

  /** Destino do "Voltar" para leitores de tela: "Voltar para vendas". */
  backLabel?: string;

  actions?: ReactNode;
}

/**
 * Cabeçalho padrão de toda tela: "Voltar" (quando há) sempre acima do título,
 * título e descrição à esquerda, ações à direita.
 */
export function PageHeader({
  title,
  description,
  meta,
  backPath,
  backLabel,
  actions,
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
      {backPath && (
        <Link
          to={backPath}
          className="
            flex
            items-center
            gap-2
            text-sm
            font-medium
            text-muted
            hover:text-foreground
            w-fit
          "
        >
          <ArrowLeft size={16} />
          <span>
            Voltar
            {backLabel && " "}
            {backLabel && <span className="sr-only">para {backLabel}</span>}
          </span>
        </Link>
      )}

      <div className="flex flex-wrap justify-between items-start gap-3">
        <div className="min-w-0">
          {title && <h1 className="break-words text-2xl font-semibold text-foreground">{title}</h1>}

          {description && <div className="mt-1 text-muted">{description}</div>}

          {meta && <div className="mt-2">{meta}</div>}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
