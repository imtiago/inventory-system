interface Props {
  boxCode: string;
  canShare: boolean;
  error: string | null;
  onDownload(): void;
  onShare(): void;
  onRegenerate(): void;
  onContinue(): void;
}

const primary = 'min-h-11 rounded-lg bg-primary px-6 py-3 text-primary-foreground';
const secondary = 'min-h-11 rounded-lg border border-input px-6 py-3';

/** O PDF já está gerado; cada ação parte de um clique do usuário (exigência do Safari no iPhone/iPad). */
export function InitialInventoryLabelsReady({ boxCode, canShare, error, onDownload, onShare, onRegenerate, onContinue }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface p-6 shadow">
        <h2 className="text-xl font-semibold">Etiquetas prontas</h2>

        <p className="mt-2 text-sm text-muted">As etiquetas da caixa {boxCode} foram geradas. Baixe o PDF ou envie direto para a impressora.</p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={onDownload} className={primary}>
            Baixar PDF
          </button>

          {canShare && (
            <button type="button" onClick={onShare} className={secondary}>
              Compartilhar
            </button>
          )}

          <button type="button" onClick={onRegenerate} className={secondary}>
            Gerar de novo
          </button>

          <button type="button" onClick={onContinue} className={secondary}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
