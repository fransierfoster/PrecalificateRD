'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({
  id,
  action,
  confirmText,
}: {
  id: string;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  confirmText: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(confirmText)) return;

    const password = window.prompt('Confirma la contraseña de administrador para eliminar:');
    if (password == null) return;

    setBusy(true);
    setErr(null);

    const fd = new FormData();
    fd.set('id', id);
    fd.set('adminPassword', password);

    const res = await action(fd);
    setBusy(false);

    if (!res.ok) {
      setErr(res.error || 'Error al eliminar');
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button type="button" className="adm-btn adm-btn-delete" disabled={busy} onClick={handleDelete}>
        {busy ? 'Eliminando…' : '🗑 Eliminar'}
      </button>
      {err && <div className="adm-save-err" style={{ marginTop: 4 }}>{err}</div>}
    </div>
  );
}
