import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { Can } from '@/shared/auth/Can';
import type { Permission } from '@/shared/auth/permissions';
import { parseApiError } from '@/shared/services/parseApiError';
import { downloadFile } from '@/shared/utils/download';

type Params = Record<string, string | number | boolean | undefined>;

interface ExportButtonProps {
  label?: string;
  permission: Permission;
  url: string;
  params: Params;
  fallbackName: string;
  disabled?: boolean;
}

/** Downloads a CSV report with the given filters; shows a busy state and the API error (once) inline. */
export function ExportButton({ label = 'Exportar CSV', permission, url, params, fallbackName, disabled }: ExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify([url, params]);

  // Um erro anterior não vale para filtros diferentes.
  useEffect(() => {
    setError(null);
  }, [paramsKey]);

  async function handleClick() {
    setBusy(true);
    setError(null);

    try {
      await downloadFile(url, params, fallbackName);
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(Object.values(parsed.fieldErrors)[0] ?? parsed.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Can permission={permission}>
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || disabled}
          className="flex min-h-10 items-center gap-2 rounded-lg border border-input bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? 'Exportando...' : label}
        </button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Can>
  );
}
