'use client';

import { Fragment, useMemo, useState } from 'react';
import { updateLead, deleteLead } from './actions';
import DeleteButton from './DeleteButton';
import { type Calculo, EMP_LABELS, ANT_LABELS, ATRASO_LABELS } from './CalculosTable';

export type Lead = {
  id: string;
  created_at: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  doc_tipo: string | null;
  doc_numero: string | null;
  quiere_ofertas: boolean | null;
  contactado: boolean | null;
  asesor_asignado: string | null;
  resultado_banco: string | null;
  notas: string | null;
  precalifica_calculos: Calculo | null;
};

function fmtMoney(n: number | null, currency: string | null) {
  if (n == null) return '-';
  const symbol = currency === 'USD' ? 'US$' : 'RD$';
  return symbol + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

function LeadDetail({ c }: { c: Calculo }) {
  return (
    <div className="adm-lead-detail">
      <div className="adm-lead-detail-col">
        <h4>📋 Escenario 1 — La propiedad que pidió</h4>
        <p>Valor inmueble: <strong>{fmtMoney(c.vinm_dop, c.moneda_resultado)}</strong></p>
        <p>Monto a financiar: <strong>{fmtMoney(c.pr_dop, c.moneda_resultado)}</strong></p>
        <p>Inicial: <strong>{fmtMoney(c.ini_dop, c.moneda_resultado)}</strong></p>
        <p>Cuota mensual estimada: <strong>{fmtMoney(c.cuota_dop, c.moneda_resultado)}</strong></p>
        <p>Capacidad de endeudamiento: <strong>{c.dti != null ? (c.dti * 100).toFixed(0) + '%' : '-'}</strong></p>
        <p>Probabilidad (Score E1): <strong>{c.score_e1 ?? '-'}%</strong></p>
      </div>

      {c.score_e2 != null && (
        <div className="adm-lead-detail-col">
          <h4>✅ Escenario 2 — Mejor opción con su perfil</h4>
          <p>Valor inmueble sugerido: <strong>{fmtMoney(c.vir_dop, c.moneda_resultado)}</strong></p>
          <p>Monto a financiar: <strong>{fmtMoney(c.mr_dop, c.moneda_resultado)}</strong></p>
          <p>Probabilidad (Score E2): <strong>{c.score_e2}%</strong></p>
        </div>
      )}

      <div className="adm-lead-detail-col">
        <h4>💼 Perfil financiero</h4>
        <p>Ingreso mensual: <strong>{fmtMoney(c.ing_dop, c.moneda_resultado)}</strong></p>
        <p>Deudas mensuales: <strong>{fmtMoney(c.deu_dop, c.moneda_resultado)}</strong></p>
        <p>Ingresos adicionales: <strong>{fmtMoney(c.activos_dop, c.moneda_resultado)}</strong></p>
        <p>Empleo: <strong>{EMP_LABELS[c.empleo || ''] || c.empleo || '-'}</strong> · Antigüedad: <strong>{ANT_LABELS[c.antiguedad_laboral || ''] || c.antiguedad_laboral || '-'}</strong></p>
        <p>País de residencia: <strong>{c.pais || '-'}</strong> · Edad: <strong>{c.edad != null ? `${c.edad} años` : '-'}</strong></p>
      </div>

      <div className="adm-lead-detail-col">
        <h4>📊 Historial y experiencia crediticia</h4>
        <p>{c.tuvo_prestamos ? 'Con historial de préstamos previo' : 'Sin historial de préstamos previo'}</p>
        <p>Atrasos: <strong>{ATRASO_LABELS[c.atraso_dias ?? -1] || '-'}</strong> {c.atraso_patron === 'patron' ? '(recurrente)' : c.atraso_patron === 'unico' ? '(evento aislado)' : ''}</p>
        <p>Antigüedad de crédito: <strong>{c.antiguedad_credito || '-'}</strong></p>
        <p>Productos financieros usados: <strong>{(c.productos || []).join(', ') || 'Ninguno'}</strong></p>
        <p>Co-deudor: <strong>{c.tiene_codeudor ? `Sí — ingreso ${fmtMoney(c.ingreso_codeudor_dop, c.moneda_resultado)}` : 'No'}</strong></p>
      </div>
    </div>
  );
}

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [contactado, setContactado] = useState('todos');
  const [moneda, setMoneda] = useState('todas');
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
      if (contactado === 'si' && !lead.contactado) return false;
      if (contactado === 'no' && lead.contactado) return false;
      if (moneda !== 'todas' && lead.precalifica_calculos?.moneda_resultado !== moneda) return false;
      return true;
    });
  }, [leads, scoreMin, scoreMax, contactado, moneda]);

  function exportCSV() {
    const headers = ['Fecha', 'Nombre', 'Apellido', 'Telefono', 'Email', 'Documento', 'Moneda', 'Monto', 'Score E1', 'Score E2', 'Capacidad de endeudamiento', 'Quiere ofertas', 'Contactado', 'Asesor asignado', 'Resultado banco', 'Notas'];
    const rows = filtered.map((lead) => {
      const c = lead.precalifica_calculos;
      return [
        new Date(lead.created_at).toLocaleString('es-DO'),
        lead.nombre || '',
        lead.apellido || '',
        lead.telefono || '',
        lead.email || '',
        `${lead.doc_tipo || ''} ${lead.doc_numero || ''}`.trim(),
        c?.moneda_resultado || '',
        c?.vinm_dop != null ? String(c.vinm_dop) : '',
        c?.score_e1 != null ? String(c.score_e1) : '',
        c?.score_e2 != null ? String(c.score_e2) : '',
        c?.dti != null ? (c.dti * 100).toFixed(0) : '',
        lead.quiere_ofertas ? 'Si' : 'No',
        lead.contactado ? 'Si' : 'No',
        lead.asesor_asignado || '',
        lead.resultado_banco || '',
        lead.notas || '',
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-precalificaterd-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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
        <label className="adm-filter">
          Contactado
          <select className="adm-input" value={contactado} onChange={(e) => setContactado(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="adm-filter">
          Moneda
          <select className="adm-input" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="DOP">DOP</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <button type="button" className="adm-btn adm-btn-primary adm-export-btn" onClick={exportCSV}>
          Exportar a Excel ({filtered.length})
        </button>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Contacto</th>
              <th>Documento</th>
              <th>Resultado</th>
              <th>Ofertas</th>
              <th>Seguimiento</th>
              <th></th>
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
                      {c ? (
                        <>
                          {fmtMoney(c.vinm_dop, c.moneda_resultado)}<br />
                          E1: {c.score_e1}% {c.score_e2 != null ? `/ E2: ${c.score_e2}%` : ''}<br />
                          Capacidad de endeudamiento: {c.dti != null ? (c.dti * 100).toFixed(0) + '%' : '-'}
                        </>
                      ) : <span className="adm-empty">sin datos</span>}
                    </td>
                    <td>
                      <span className={`adm-pill ${lead.quiere_ofertas ? 'adm-pill-green' : 'adm-pill-gray'}`}>
                        {lead.quiere_ofertas ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td>
                      <form action={updateLead} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                        <input type="hidden" name="id" value={lead.id} />
                        <label style={{ fontSize: 12 }}>
                          <input type="checkbox" name="contactado" defaultChecked={!!lead.contactado} /> Contactado
                        </label>
                        <input type="text" name="asesor_asignado" placeholder="Asesor asignado" defaultValue={lead.asesor_asignado || ''} />
                        <input type="text" name="resultado_banco" placeholder="Resultado banco" defaultValue={lead.resultado_banco || ''} />
                        <textarea name="notas" placeholder="Notas" defaultValue={lead.notas || ''} />
                        <button type="submit" className="adm-btn adm-btn-primary">Guardar</button>
                      </form>
                    </td>
                    <td>
                      {c && (
                        <button type="button" className="adm-btn" onClick={() => toggleExpanded(lead.id)}>
                          {isOpen ? '▾ Ocultar' : '▸ Ver perfil'}
                        </button>
                      )}
                    </td>
                    <td>
                      <DeleteButton
                        id={lead.id}
                        action={deleteLead}
                        confirmText={`¿Eliminar el lead de ${lead.nombre || 'este contacto'}? Esta acción no se puede deshacer.`}
                      />
                    </td>
                  </tr>
                  {isOpen && c && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <LeadDetail c={c} />
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
