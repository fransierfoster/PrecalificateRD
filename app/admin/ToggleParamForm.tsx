'use client';

import { useState } from 'react';
import { updateParametro } from './actions';

export default function ToggleParamForm({
  clave,
  valor,
  label,
  description,
}: {
  clave: string;
  valor: number;
  label: string;
  description?: string;
}) {
  const [active, setActive] = useState(valor === 1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleToggle() {
    const newVal = active ? 0 : 1;
    const password = window.prompt('Confirma la contraseña de administrador:');
    if (password == null) return;

    setSaving(true);
    setMsg(null);

    const fd = new FormData();
    fd.set('clave', clave);
    fd.set('valor', String(newVal));
    fd.set('adminPassword', password);

    const res = await updateParametro(fd);
    setSaving(false);
    if (res.ok) {
      setActive(newVal === 1);
      setMsg({ ok: true, text: newVal === 1 ? 'Activado ✓' : 'Desactivado ✓' });
    } else {
      setMsg({ ok: false, text: res.error || 'Error al guardar' });
    }
  }

  return (
    <div className="adm-toggle-row">
      <div className="adm-toggle-info">
        <span className="adm-toggle-label">{label}</span>
        {description && <span className="adm-toggle-desc">{description}</span>}
      </div>
      <div className="adm-toggle-right">
        <button
          type="button"
          disabled={saving}
          onClick={handleToggle}
          className={`adm-toggle-btn ${active ? 'adm-toggle-on' : 'adm-toggle-off'}`}
        >
          {saving ? '…' : active ? 'Activo' : 'Inactivo'}
        </button>
        {msg && <span className={msg.ok ? 'adm-save-ok' : 'adm-save-err'}>{msg.text}</span>}
      </div>
    </div>
  );
}
