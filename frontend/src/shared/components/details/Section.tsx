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
        bg-white
        rounded-xl
        shadow
        flex
        flex-col
        min-h-0
        overflow-hidden
        ${className}
      `}
    >
      {(title || description || actions) && (
        <div
          className="
            p-6
            flex
            justify-between
            items-center
            border-b
            shrink-0
          "
        >
          <div>
            {title && (
              <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            )}

            {description && <p className="text-gray-500">{description}</p>}
          </div>

          {actions}
        </div>
      )}

      <div
        className="
   flex-1
   min-h-0
   overflow-hidden
   flex
   flex-col
 "
      >
        {children}
      </div>
    </section>
  );
}
