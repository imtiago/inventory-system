import { PageHeader } from '@/shared/components/layout/PageHeader';

interface IInitialInventoryHeaderProps {
  title: string;
  description: string;
}

export function InitialInventoryHeader({ title, description }: IInitialInventoryHeaderProps) {
  return <PageHeader title={title} description={description} backPath="/inventory" backLabel="estoque" />;
}
