import { MessageCircle } from 'lucide-react';

import { Section } from '@/shared/components/details/Section';
import { useCustomer } from '@/modules/customers/hooks/useCustomer';
import type { ISaleDetail } from '@/modules/sales/types';

import { buildCarneMessage, buildWhatsAppLink } from '../utils/whatsapp';
import { PdfDocumentButton } from './PdfDocumentButton';

const linkClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-input bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted';

/** Carnê em PDF e envio pelo WhatsApp (link `wa.me`, sem API) da venda no crediário. Nada em outras vendas. */
export function CreditDocumentsActions({ sale }: { sale: ISaleDetail }) {
  const enabled = Boolean(sale.financing) && sale.status !== 'CANCELED';
  const customer = useCustomer(enabled ? sale.customer.id : '');
  const link = enabled && customer.data ? buildWhatsAppLink(customer.data.phone, buildCarneMessage(sale)) : null;
  const code = sale.id.slice(0, 8).toUpperCase();

  if (!enabled) return null;

  return (
    <Section title="Carnê" description="Resumo do financiamento e um canhoto por parcela.">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:p-6">
        <PdfDocumentButton label="Carnê (PDF)" url={`/sales/${sale.id}/carne.pdf`} fileName={`carne-${code}.pdf`} variant="primary" />

        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <MessageCircle size={18} aria-hidden="true" />
            Enviar pelo WhatsApp
          </a>
        ) : (
          <button type="button" disabled aria-describedby="whatsapp-hint" className={`${linkClass} cursor-not-allowed opacity-50 hover:bg-surface`}>
            <MessageCircle size={18} aria-hidden="true" />
            Enviar pelo WhatsApp
          </button>
        )}

        {!link && !customer.isLoading && (
          <p id="whatsapp-hint" className="basis-full text-sm text-muted">
            Cliente sem celular
          </p>
        )}
      </div>
    </Section>
  );
}
