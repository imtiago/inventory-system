// shared/components/details/InfoItem.tsx

interface Props {
  label: string;

  value: React.ReactNode;
}

export function InfoItem({ label, value }: Props) {
  return (
    <div>
      <span
        className="
          text-sm
          text-gray-500
        "
      >
        {label}
      </span>

      <p className="font-medium">{value}</p>
    </div>
  );
}
