// shared/components/cards/SummaryCard.tsx

import type { ReactNode } from "react";

interface Props {
  title: string;

  value: ReactNode;

  icon: ReactNode;
}

export function SummaryCard({ title, value, icon }: Props) {
  return (
    <div
      className="
        bg-white
        rounded-xl
        shadow
        p-5
        flex
        items-center
        gap-4
      "
    >
      {icon}

      <div>
        <p
          className="
            text-sm
            text-gray-500
          "
        >
          {title}
        </p>

        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
