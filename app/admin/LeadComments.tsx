'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addLeadComentario } from './actions';

export type Comentario = {
  id: string;
  lead_id: string;
  autor: string;
  comentario: string;
  created_at: string;
};

export default function LeadComments({ leadId, comentarios }: { leadId: string; comentarios: Comentario[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const texto = String(fd.get('comentario') || '').trim();
    if (!texto) return;

    setBusy(true);
    setErr(null);
    const res = await addLeadComentario(fd);
    setBusy(false);

    if (!res.ok) {
      setErr(res.error || 'No se pudo guardar el comentario');
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  const ordenados = [...comentarios].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="adm-lead-detail-col" style={{ gridColumn: '1 / -1' }}>
      <h4>💬 Comentarios de seguimiento</h4>
      {ordenados.length === 0 ? (
        <p className="adm-empty" style={{ margin: '4px 0 10px' }}>Aún no hay comentarios.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {ordenados.map((c) => (
            <div key={c.id} style={{ background: '#F9FAFB', border: '1px solid #e5e5e5', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
                <strong>{c.autor}</strong> · {new Date(c.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{c.comentario}</div>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input type="hidden" name="lead_id" value={leadId} />
        <textarea
          name="comentario"
          placeholder="Agregar un comentario…"
          rows={2}
          required
          style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, resize: 'vertical' }}
        />
        <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Comentar'}
        </button>
      </form>
      {err && <div className="adm-save-err" style={{ marginTop: 4 }}>{err}</div>}
    </div>
  );
}
