interface IInitialInventoryHeaderProps {
  title: string;
  description: string;
}

export function InitialInventoryHeader({ title, description }: IInitialInventoryHeaderProps) {
  return (
    <div>
      <h1 className="text-3xl font-bold">{title}</h1>

      <p className="text-gray-500">{description}</p>
    </div>
  );
}
