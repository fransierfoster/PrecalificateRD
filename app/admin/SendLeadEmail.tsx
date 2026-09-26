'use client';

import { useState } from 'react';
import { sendLeadEmailTo } from './actions';

export default function SendLeadEmail({ leadId }: { leadId: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSend() {
    if (!email.trim()) return;
    setBusy(true);
    setMsg('');

    const fd = new FormData();
    fd.set('lead_id', leadId);
    fd.set('to_email', email.trim());

    const res = await sendLeadEmailTo(fd);
    setBusy(false);
    setMsg(res.ok ? '✅ Enviado' : '❌ ' + (res.error || 'Error al enviar'));
    setTimeout(() => setMsg(''), 4000);
  }

  return (
    <div className="adm-lead-detail-col" style={{ gridColumn: '1 / -1' }}>
      <h4>📤 Reenviar por correo</h4>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="email"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, maxWidth: 280, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13 }}
        />
        <button type="button" className="adm-btn adm-btn-primary" disabled={busy || !email.trim()} onClick={handleSend}>
          {busy ? 'Enviando…' : 'Enviar'}
        </button>
        {msg && <span style={{ fontSize: 12 }}>{msg}</span>}
      </div>
      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>
        Recalculado con los parámetros actuales del motor.
      </p>
    </div>
  );
}
