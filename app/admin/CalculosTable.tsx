'use client';

import { useMemo, useState } from 'react';

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

const EMP_LABELS: Record<string, string> = {
  formal: 'Formal', independiente: 'Independiente', empresario: 'Empresario',
  remesa: 'Diáspora', pension: 'Pensionado',
};
const ANT_LABELS: Record<string, string> = {
  menos1: '<1 año', '1a2': '1-2 años', '2a5': '2-5 años', mas5: '>5 años',
};
const ATRASO_LABELS: Record<number, string> = {
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
  const [tipo, setTipo] = useState('todos');

  const filtered = useMemo(() => {
    return calculos.filter((c) => {
      if (scoreMin !== '' && (c.score_e1 == null || c.score_e1 < Number(scoreMin))) return false;
      if (tipo !== 'todos' && c.tipo !== tipo) return false;
      return true;
    });
  }, [calculos, scoreMin, tipo]);

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
        <label className="adm-filter">
          Score E1 mín. (%)
          <input type="number" className="adm-input" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} min={0} max={100} />
        </label>
        <label className="adm-filter">
          Tipo
          <select className="adm-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="e1">Escenario 1</option>
            <option value="e2">Escenario 2</option>
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
              <th>Resultado</th>
              <th>Perfil</th>
              <th>Crédito</th>
              <th>Ingresos</th>
              <th>Co-deudor</th>
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
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="adm-empty">Ningún cálculo coincide con los filtros.</p>}
      </div>
    </div>
  );
}
