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
          text-muted
        "
      >
        {label}
      </span>

      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
