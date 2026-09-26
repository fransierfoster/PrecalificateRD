'use client';

import { Fragment, useMemo, useState } from 'react';
import { type Lead, LeadDetail } from './LeadsTable';
import LeadComments, { type Comentario } from './LeadComments';

function refNum(lead: Lead): string {
  if (!lead.calculo_id) return '—';
  const year = new Date(lead.created_at).getFullYear();
  const hex = lead.calculo_id.replace(/-/g, '').substring(0, 8).toUpperCase();
  return `PRC-${year}-${hex}`;
}

// Vista para el acceso restringido "leads": solo lectura de los datos del
// lead + agregar comentarios. Sin campos de seguimiento (Contactado/Asesor/
// Resultado/Notas), sin botón de eliminar, sin reenvío de correo -- esas
// acciones no existen en este componente a propósito.
export default function LeadsRestrictedView({ leads, comentariosByLead }: { leads: Lead[]; comentariosByLead: Record<string, Comentario[]> }) {
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const score = lead.precalifica_calculos?.score_e1;
      if (scoreMin !== '' && (score == null || score < Number(scoreMin))) return false;
      if (scoreMax !== '' && (score == null || score > Number(scoreMax))) return false;
      return true;
    });
  }, [leads, scoreMin, scoreMax]);

  if (leads.length === 0) {
    return <p className="adm-empty">Aún no hay leads.</p>;
  }

  return (
    <div>
      <div className="adm-filters">
        <label className="adm-filter">
          Score mín. (%)
          <input type="number" className="adm-input" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} min={0} max={100} />
        </label>
        <label className="adm-filter">
          Score máx. (%)
          <input type="number" className="adm-input" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} min={0} max={100} />
        </label>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Contacto</th>
              <th>Documento</th>
              <th>Referencia / Tipo</th>
              <th>Resultado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const c = lead.precalifica_calculos;
              const isOpen = expanded.has(lead.id);
              return (
                <Fragment key={lead.id}>
                  <tr>
                    <td>{new Date(lead.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      <strong>{lead.nombre} {lead.apellido}</strong><br />
                      {lead.telefono}<br />
                      {lead.email}
                    </td>
                    <td>{lead.doc_tipo} {lead.doc_numero}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', display: 'block', marginBottom: 4 }}>
                        {refNum(lead)}
                      </span>
                      <span className={`adm-pill ${lead.tipo === 'pdf' ? 'adm-pill-red' : 'adm-pill-gray'}`}>
                        {lead.tipo === 'pdf' ? '📄 PDF' : '💬 Asesoría'}
                      </span>
                    </td>
                    <td>
                      {c ? (
                        <>
                          E1: {c.score_e1}% {c.score_e2 != null ? `/ E2: ${c.score_e2}%` : ''}
                        </>
                      ) : <span className="adm-empty">sin datos</span>}
                    </td>
                    <td>
                      {c && (
                        <button type="button" className="adm-btn" onClick={() => toggleExpanded(lead.id)}>
                          {isOpen ? '▾ Ocultar' : '▸ Ver perfil'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && c && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <LeadDetail c={c} />
                        <div className="adm-lead-detail">
                          <LeadComments leadId={lead.id} comentarios={comentariosByLead[lead.id] || []} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="adm-empty">Ningún lead coincide con los filtros.</p>}
      </div>
    </div>
  );
}
