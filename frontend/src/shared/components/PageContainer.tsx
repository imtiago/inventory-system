interface Props {
  children: React.ReactNode;
}

export function PageContainer({ children }: Props) {
  return <div className="mx-auto max-w-3xl px-6 py-4">{children}</div>;
}
