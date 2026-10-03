'use client';

import { Fragment, useMemo, useState } from 'react';
import { type Lead, LeadDetail } from './LeadsTable';
import LeadComments, { type Comentario } from './LeadComments';
import SendLeadEmail from './SendLeadEmail';

function refNum(lead: Lead): string {
  if (!lead.calculo_id) return '—';
  const year = new Date(lead.created_at).getFullYear();
  const hex = lead.calculo_id.replace(/-/g, '').substring(0, 8).toUpperCase();
  return `PRC-${year}-${hex}`;
}

// Vista para el acceso restringido "leads": solo lectura de los datos del
// lead + agregar comentarios + reenviar por correo. Sin campos de seguimiento
// (Contactado/Asesor/Resultado/Notas) ni botón de eliminar -- esas acciones
// no existen en este componente a propósito.
export default function LeadsRestrictedView({ leads, comentariosByLead }: { leads: Lead[]; comentariosByLead: Record<string, Comentario[]> }) {
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  // Solo un lead expandido a la vez -- al abrir uno se cierra el anterior,
  // para que la informacion se vea mas ordenada.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
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
              <th>Referido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const c = lead.precalifica_calculos;
              const isOpen = expandedId === lead.id;
              return (
                <Fragment key={lead.id}>
                  <tr>
                    <td data-label="Fecha">{new Date(lead.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td data-label="Contacto">
                      <strong>{lead.nombre} {lead.apellido}</strong><br />
                      {lead.telefono}<br />
                      {lead.email}
                    </td>
                    <td data-label="Documento">{lead.doc_tipo} {lead.doc_numero}</td>
                    <td data-label="Referencia / Tipo">
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', display: 'block', marginBottom: 4 }}>
                        {refNum(lead)}
                      </span>
                      <span className={`adm-pill ${lead.tipo === 'pdf' ? 'adm-pill-red' : 'adm-pill-gray'}`}>
                        {lead.tipo === 'pdf' ? '📄 PDF' : lead.tipo === 'propiedades' ? '🏠 Propiedades' : '💬 Asesoría'}
                      </span>
                      {lead.origen === 'calculadora' && (
                        <span className="adm-pill adm-pill-green" style={{ display: 'inline-block', marginTop: 4 }}>
                          🧮 Calculadora{lead.fuente ? ` · ${lead.fuente}` : ''}
                        </span>
                      )}
                      {lead.tipo === 'propiedades' && lead.notas && (
                        <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: '#374151', lineHeight: 1.45, maxWidth: 360 }}>{lead.notas}</span>
                      )}
                    </td>
                    <td data-label="Resultado">
                      {c ? (
                        <>
                          E1: {c.score_e1}% {c.score_e2 != null ? `/ E2: ${c.score_e2}%` : ''}
                        </>
                      ) : <span className="adm-empty">sin datos</span>}
                    </td>
                    <td data-label="Referido">
                      <span className={`adm-pill ${lead.referido_asesor ? 'adm-pill-green' : 'adm-pill-gray'}`}>
                        {lead.referido_asesor ? '🎯 Sí' : 'No'}
                      </span>
                    </td>
                    <td data-label="">
                      {c && (
                        <button type="button" className="adm-btn" onClick={() => toggleExpanded(lead.id)}>
                          {isOpen ? '▾ Ocultar' : '▸ Ver perfil'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && c && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <LeadDetail c={c} />
                        <div className="adm-lead-detail">
                          <SendLeadEmail leadId={lead.id} />
                        </div>
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
