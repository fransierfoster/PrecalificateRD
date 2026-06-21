'use client';

import { useState } from 'react';
import { updateParametro } from './actions';

export default function ParamForm({
  clave,
  valor,
  descripcion,
  compact,
}: {
  clave: string;
  valor: number;
  descripcion: string | null;
  compact?: boolean;
}) {
  const [value, setValue] = useState(valor);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave() {
    const password = window.prompt('Confirma la contraseña de administrador para guardar este cambio:');
    if (password == null) return; // cancelado

    setSaving(true);
    setMsg(null);

    const fd = new FormData();
    fd.set('clave', clave);
    fd.set('valor', String(value));
    fd.set('adminPassword', password);

    const res = await updateParametro(fd);
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: 'Guardado ✓' } : { ok: false, text: res.error || 'Error al guardar' });
  }

  return (
    <div className="adm-param">
      {!compact && <label htmlFor={clave}>{descripcion || clave}</label>}
      <div className="adm-param-row">
        <input
          id={clave}
          type="number"
          step="any"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className={compact ? 'adm-input adm-input-sm' : 'adm-input'}
        />
        {compact && <span className="adm-factor-pct">%</span>}
        <button type="button" disabled={saving} onClick={handleSave} className="adm-btn adm-btn-primary">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {msg && <span className={msg.ok ? 'adm-save-ok' : 'adm-save-err'}>{msg.text}</span>}
    </div>
  );
}
