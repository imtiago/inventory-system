interface Props {
  children: React.ReactNode;
}

export function PageContainer({ children }: Props) {
  return <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>;
}
