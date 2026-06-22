'use client';

import { useMemo, useState } from 'react';
import { updateLead, deleteLead } from './actions';
import DeleteButton from './DeleteButton';

type Calculo = {
  score_e1: number | null;
  score_e2: number | null;
  moneda_resultado: string | null;
  vinm_dop: number | null;
  dti: number | null;
};

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

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [contactado, setContactado] = useState('todos');
  const [moneda, setMoneda] = useState('todas');

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
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const c = lead.precalifica_calculos;
              return (
                <tr key={lead.id}>
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
                    <DeleteButton
                      id={lead.id}
                      action={deleteLead}
                      confirmText={`¿Eliminar el lead de ${lead.nombre || 'este contacto'}? Esta acción no se puede deshacer.`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="adm-empty">Ningún lead coincide con los filtros.</p>}
      </div>
    </div>
  );
}
