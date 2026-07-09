'use client';

import { useMemo, useState } from 'react';
import { deleteCalculo } from './actions';
import DeleteButton from './DeleteButton';

export type Calculo = {
  id: string;
  created_at: string;
  session_id: string | null;
  tipo: string | null;
  moneda_resultado: string | null;
  vinm_dop: number | null;
  pr_dop: number | null;
  ini_dop: number | null;
  cuota_dop: number | null;
  dti: number | null;
  score_e1: number | null;
  score_e2: number | null;
  vir_dop: number | null;
  mr_dop: number | null;
  ing_dop: number | null;
  deu_dop: number | null;
  empleo: string | null;
  antiguedad_laboral: string | null;
  pais: string | null;
  edad: number | null;
  tuvo_prestamos: boolean | null;
  atraso_dias: number | null;
  atraso_patron: string | null;
  exp_monto: number | null;
  antiguedad_credito: string | null;
  productos: string[] | null;
  activos_dop: number | null;
  tiene_codeudor: boolean | null;
  ingreso_codeudor_dop: number | null;
};

export const EMP_LABELS: Record<string, string> = {
  formal: 'Formal', independiente: 'Independiente', empresario: 'Empresario',
  remesa: 'Diáspora', pension: 'Pensionado',
};
export const ANT_LABELS: Record<string, string> = {
  menos1: '<1 año', '1a2': '1-2 años', '2a5': '2-5 años', mas5: '>5 años',
};
export const ATRASO_LABELS: Record<number, string> = {
  0: 'Sin atrasos', 30: 'Hasta 30 días', 45: '31-60 días', 90: '+60 días',
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

export default function CalculosTable({ calculos }: { calculos: Calculo[] }) {
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [e2Min, setE2Min] = useState('');
  const [e2Max, setE2Max] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const filtered = useMemo(() => {
    return calculos.filter((c) => {
      if (scoreMin !== '' && (c.score_e1 == null || c.score_e1 < Number(scoreMin))) return false;
      if (scoreMax !== '' && (c.score_e1 == null || c.score_e1 > Number(scoreMax))) return false;
      if (e2Min !== '' && (c.score_e2 == null || c.score_e2 < Number(e2Min))) return false;
      if (e2Max !== '' && (c.score_e2 == null || c.score_e2 > Number(e2Max))) return false;
      if (tipo !== 'todos' && c.tipo !== tipo) return false;
      if (fechaDesde !== '') {
        const desde = new Date(fechaDesde);
        if (new Date(c.created_at) < desde) return false;
      }
      if (fechaHasta !== '') {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        if (new Date(c.created_at) > hasta) return false;
      }
      return true;
    });
  }, [calculos, scoreMin, scoreMax, e2Min, e2Max, tipo, fechaDesde, fechaHasta]);

  function clearFilters() {
    setScoreMin(''); setScoreMax(''); setE2Min(''); setE2Max('');
    setTipo('todos'); setFechaDesde(''); setFechaHasta('');
  }

  function exportCSV() {
    const headers = [
      'Fecha', 'Tipo', 'Moneda', 'Score E1', 'Score E2', 'Valor inmueble', 'Monto a financiar', 'Inicial',
      'Cuota mensual', 'Capacidad de endeudamiento', 'Ingreso', 'Deuda', 'Empleo', 'Antigüedad laboral',
      'País', 'Edad', 'Tuvo préstamos', 'Atraso (días)', 'Patrón atraso', 'Monto experiencia previa',
      'Antigüedad crédito', 'Productos', 'Ingresos adicionales', 'Tiene co-deudor', 'Ingreso co-deudor',
    ];
    const rows = filtered.map((c) => [
      new Date(c.created_at).toLocaleString('es-DO'),
      c.tipo || '',
      c.moneda_resultado || '',
      c.score_e1 != null ? String(c.score_e1) : '',
      c.score_e2 != null ? String(c.score_e2) : '',
      c.vinm_dop != null ? String(c.vinm_dop) : '',
      c.pr_dop != null ? String(c.pr_dop) : '',
      c.ini_dop != null ? String(c.ini_dop) : '',
      c.cuota_dop != null ? String(c.cuota_dop) : '',
      c.dti != null ? (c.dti * 100).toFixed(0) + '%' : '',
      c.ing_dop != null ? String(c.ing_dop) : '',
      c.deu_dop != null ? String(c.deu_dop) : '',
      c.empleo || '',
      c.antiguedad_laboral || '',
      c.pais || '',
      c.edad != null ? String(c.edad) : '',
      c.tuvo_prestamos ? 'Sí' : 'No',
      c.atraso_dias != null ? String(c.atraso_dias) : '',
      c.atraso_patron || '',
      c.exp_monto != null ? String(c.exp_monto) : '',
      c.antiguedad_credito || '',
      (c.productos || []).join(' / '),
      c.activos_dop != null ? String(c.activos_dop) : '',
      c.tiene_codeudor ? 'Sí' : 'No',
      c.ingreso_codeudor_dop != null ? String(c.ingreso_codeudor_dop) : '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calculos-precalificaterd-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (calculos.length === 0) {
    return <p className="adm-empty">Aún no hay cálculos registrados.</p>;
  }

  return (
    <div>
      <div className="adm-filters">
        <div className="adm-filter-group">
          <span className="adm-filter-group-label">Fecha</span>
          <label className="adm-filter">
            Desde
            <input type="date" className="adm-input" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </label>
          <label className="adm-filter">
            Hasta
            <input type="date" className="adm-input" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </label>
        </div>
        <div className="adm-filter-group">
          <span className="adm-filter-group-label">Score E1 (%)</span>
          <label className="adm-filter">
            Mín.
            <input type="number" className="adm-input adm-input-sm" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} min={0} max={100} placeholder="0" />
          </label>
          <label className="adm-filter">
            Máx.
            <input type="number" className="adm-input adm-input-sm" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} min={0} max={100} placeholder="100" />
          </label>
        </div>
        <div className="adm-filter-group">
          <span className="adm-filter-group-label">Score E2 (%)</span>
          <label className="adm-filter">
            Mín.
            <input type="number" className="adm-input adm-input-sm" value={e2Min} onChange={(e) => setE2Min(e.target.value)} min={0} max={100} placeholder="0" />
          </label>
          <label className="adm-filter">
            Máx.
            <input type="number" className="adm-input adm-input-sm" value={e2Max} onChange={(e) => setE2Max(e.target.value)} min={0} max={100} placeholder="100" />
          </label>
        </div>
        <div className="adm-filter-group">
          <span className="adm-filter-group-label">Tipo</span>
          <label className="adm-filter">
            &nbsp;
            <select className="adm-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="e1">Solo E1</option>
              <option value="e2">Con E2</option>
            </select>
          </label>
        </div>
        <div className="adm-filter-actions">
          <button type="button" className="adm-btn adm-btn-secondary" onClick={clearFilters}>
            Limpiar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={exportCSV}>
            Exportar CSV ({filtered.length})
          </button>
        </div>
      </div>

      <div className="adm-filter-count">
        Mostrando <strong>{filtered.length}</strong> de {calculos.length} cálculos
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Resultado</th>
              <th>Perfil</th>
              <th>Crédito</th>
              <th>Ingresos</th>
              <th>Co-deudor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>
                  {fmtMoney(c.vinm_dop, c.moneda_resultado)}<br />
                  E1: {c.score_e1}% {c.score_e2 != null ? `/ E2: ${c.score_e2}%` : ''}<br />
                  Financia: {fmtMoney(c.pr_dop, c.moneda_resultado)} · Inicial: {fmtMoney(c.ini_dop, c.moneda_resultado)}<br />
                  Cuota: {fmtMoney(c.cuota_dop, c.moneda_resultado)} · Endeudamiento: {c.dti != null ? (c.dti * 100).toFixed(0) + '%' : '-'}
                </td>
                <td>
                  {EMP_LABELS[c.empleo || ''] || c.empleo || '-'}<br />
                  Antigüedad: {ANT_LABELS[c.antiguedad_laboral || ''] || c.antiguedad_laboral || '-'}<br />
                  {c.pais || '-'} · {c.edad != null ? `${c.edad} años` : '-'}
                </td>
                <td>
                  {c.tuvo_prestamos ? 'Con historial' : 'Sin historial previo'}<br />
                  Atraso: {ATRASO_LABELS[c.atraso_dias ?? -1] || '-'} {c.atraso_patron === 'patron' ? '(recurrente)' : c.atraso_patron === 'unico' ? '(aislado)' : ''}<br />
                  Antigüedad crédito: {c.antiguedad_credito || '-'}<br />
                  Productos: {(c.productos || []).join(', ') || '-'}
                </td>
                <td>
                  Ingreso: {fmtMoney(c.ing_dop, c.moneda_resultado)}<br />
                  Deuda: {fmtMoney(c.deu_dop, c.moneda_resultado)}<br />
                  Adicionales: {fmtMoney(c.activos_dop, c.moneda_resultado)}
                </td>
                <td>
                  {c.tiene_codeudor ? (
                    <span className="adm-pill adm-pill-green">Sí — {fmtMoney(c.ingreso_codeudor_dop, c.moneda_resultado)}</span>
                  ) : (
                    <span className="adm-pill adm-pill-gray">No</span>
                  )}
                </td>
                <td>
                  <DeleteButton
                    id={c.id}
                    action={deleteCalculo}
                    confirmText="¿Eliminar este cálculo? Esta acción no se puede deshacer."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="adm-empty">Ningún cálculo coincide con los filtros.</p>}
      </div>
    </div>
  );
}
