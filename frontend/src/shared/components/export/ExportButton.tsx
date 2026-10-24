import { useState } from 'react';
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

  async function handleClick() {
    setBusy(true);
    setError(null);

    try {
      await downloadFile(url, params, fallbackName);
    } catch (err) {
      setError((await parseApiError(err)).message);
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
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? 'Exportando...' : label}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Can>
  );
}
