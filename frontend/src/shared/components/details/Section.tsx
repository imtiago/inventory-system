import type { ReactNode } from "react";

interface Props {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({
  title,
  description,
  actions,
  children,
  className = "",
}: Props) {
  return (
    <section
      className={`
        bg-surface
        text-foreground
        rounded-xl
        shadow
        flex
        flex-col
        min-h-0
        lg:overflow-hidden
        ${className}
      `}
    >
      {(title || description || actions) && (
        <div
          className="
            p-4
            sm:p-6
            flex
            flex-wrap
            gap-3
            justify-between
            items-center
            border-b
            border-border
            shrink-0
          "
        >
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            )}

            {description && <p className="text-sm text-muted">{description}</p>}
          </div>

          {actions}
        </div>
      )}

      <div
        className="
   flex-1
   min-h-0
   lg:overflow-hidden
   flex
   flex-col
 "
      >
        {children}
      </div>
    </section>
  );
}
