import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const NOTIFY_TO = 'precalificaterd@gmail.com';
const NOTIFY_FROM = 'PrecalificateRD <onboarding@resend.dev>';

const EMP_LABELS: Record<string, string> = {
  formal: 'Empleado formal', independiente: 'Independiente', empresario: 'Empresario',
  remesa: 'Diáspora / ingresos en el exterior', pension: 'Pensionado',
};
const ANT_LABELS: Record<string, string> = {
  menos1: 'Menos de 1 año', '1a2': '1-2 años', '2a5': '2-5 años', mas5: 'Más de 5 años',
};
const ATRASO_LABELS: Record<number, string> = {
  0: 'Sin atrasos', 30: 'Hasta 30 días', 45: '31-60 días', 90: 'Más de 60 días',
};

function fmtMoney(n: number | null | undefined, currency: string) {
  if (n == null) return '-';
  const symbol = currency === 'USD' ? 'US$' : 'RD$';
  return symbol + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY no configurada en el servidor' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const lead = body.lead || {};
    const sd = body.sd || {};
    const e1 = sd.e1 || {};
    const e2 = sd.e2 || {};
    const currency = sd.mp === 'USD' ? 'USD' : 'DOP';

    const rows: string[] = [];
    const row = (label: string, value: string) =>
      `<tr><td style="padding:4px 10px;color:#666;font-size:13px;">${label}</td><td style="padding:4px 10px;font-size:13px;"><b>${value}</b></td></tr>`;

    rows.push(row('Nombre', `${lead.nombre || ''} ${lead.apellido || ''}`.trim() || '-'));
    rows.push(row('WhatsApp', lead.tel || '-'));
    rows.push(row('Email', lead.email || '-'));
    rows.push(row('Documento', `${lead.docTipo || ''} ${lead.docNum || ''}`.trim() || '-'));
    rows.push(row('Desea ofertas', body.quiereOfertas ? 'Sí' : 'No'));

    const e1Rows: string[] = [];
    e1Rows.push(row('Valor inmueble', fmtMoney(sd.vinmDOP, currency)));
    e1Rows.push(row('Monto a financiar', fmtMoney(sd.prDOP, currency)));
    e1Rows.push(row('Inicial', fmtMoney(sd.iniDOP, currency)));
    e1Rows.push(row('Cuota mensual', fmtMoney(e1.cDOP, currency)));
    e1Rows.push(row('Capacidad de endeudamiento', e1.dti != null ? Math.round(e1.dti * 100) + '%' : '-'));
    e1Rows.push(row('Probabilidad (Score E1)', (e1.sc != null ? e1.sc : '-') + '%'));

    const e2Rows: string[] = [];
    if (e2.sc != null) {
      e2Rows.push(row('Valor inmueble sugerido', fmtMoney(sd.virDOP, currency)));
      e2Rows.push(row('Monto a financiar', fmtMoney(sd.mrDOP, currency)));
      e2Rows.push(row('Probabilidad (Score E2)', e2.sc + '%'));
    }

    const perfilRows: string[] = [];
    perfilRows.push(row('Ingreso mensual', fmtMoney(sd.ingDOP, currency)));
    perfilRows.push(row('Deudas mensuales', fmtMoney(sd.deuDOP, currency)));
    perfilRows.push(row('Ingresos adicionales', fmtMoney(sd.activos, currency)));
    perfilRows.push(row('Empleo', `${EMP_LABELS[sd.emp] || sd.emp || '-'} · ${ANT_LABELS[sd.ant] || sd.ant || '-'}`));
    perfilRows.push(row('País de residencia', sd.pais || '-'));
    perfilRows.push(row('Edad', sd.edad != null ? `${sd.edad} años` : '-'));

    const histRows: string[] = [];
    histRows.push(row('Historial previo', sd.tuvoPres ? 'Con préstamos previos' : 'Sin préstamos previos'));
    histRows.push(row('Atrasos', `${ATRASO_LABELS[sd.atraw] || '-'} ${sd.atpat === 'patron' ? '(recurrente)' : sd.atpat === 'unico' ? '(aislado)' : ''}`));
    histRows.push(row('Antigüedad de crédito', sd.antCred || '-'));
    histRows.push(row('Productos financieros', (sd.prods || []).join(', ') || 'Ninguno'));
    histRows.push(row('Co-deudor', sd.tieneCD ? `Sí — ingreso ${fmtMoney(sd.ingCDDOP, currency)}` : 'No'));

    const WHY_ICON: Record<string, string> = { ok: '✅', w: '⚠️', b: '❌' };
    const WHY_COLOR: Record<string, string> = { ok: '#065F46', w: '#92400E', b: '#991B1B' };
    const whyHtml = Array.isArray(sd.why) && sd.why.length
      ? sd.why.map((w: { t: string; x: string; s: string }) =>
          `<div style="margin-bottom:10px;padding:8px 12px;border-radius:6px;background:${w.t === 'ok' ? '#F0FDF4' : w.t === 'w' ? '#FFFBEB' : '#FEF2F2'};">
            <div style="font-size:13px;font-weight:bold;color:${WHY_COLOR[w.t] || '#333'};">${WHY_ICON[w.t] || '•'} ${w.x}</div>
            <div style="font-size:12px;color:#555;margin-top:3px;">${w.s}</div>
          </div>`).join('')
      : '';

    const simsHtml = Array.isArray(sd.sims) && sd.sims.filter((s: { d: number }) => s.d > 0).length
      ? sd.sims.filter((s: { d: number }) => s.d > 0).map((s: { l: string; d: number; b: number }) =>
          `<div style="margin-bottom:6px;padding:7px 12px;border-radius:6px;background:#EFF6FF;font-size:12px;">
            <span style="font-weight:bold;color:#1D4ED8;">+${s.d}%</span>
            <span style="color:#333;margin-left:6px;">${s.l}</span>
            <span style="color:#6B7280;margin-left:6px;">→ llegaría a ${s.b}%</span>
          </div>`).join('')
      : '';

    const section = (title: string, htmlRows: string[]) =>
      htmlRows.length ? `<h3 style="margin:18px 0 6px;font-size:14px;color:#C0161C;">${title}</h3><table style="width:100%;border-collapse:collapse;">${htmlRows.join('')}</table>` : '';
    const sectionHtml = (title: string, content: string) =>
      content ? `<h3 style="margin:18px 0 6px;font-size:14px;color:#C0161C;">${title}</h3>${content}` : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#0D0D0D;padding:16px 20px;border-radius:10px 10px 0 0;">
          <span style="color:#fff;font-size:18px;font-weight:bold;">🎯 Nuevo lead — PrecalificateRD</span>
        </div>
        <div style="border:1px solid #eee;border-radius:0 0 10px 10px;padding:16px 20px;">
          ${section('📋 Datos de contacto', rows)}
          ${section('🏠 Escenario 1 — Propiedad solicitada', e1Rows)}
          ${section('✅ Escenario 2 — Mejor opción', e2Rows)}
          ${section('💼 Perfil financiero', perfilRows)}
          ${section('📊 Historial y experiencia crediticia', histRows)}
          ${sectionHtml('🔍 ¿Por qué este resultado?', whyHtml)}
          ${sectionHtml('📈 Acciones para mejorar la probabilidad', simsHtml)}
        </div>
      </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        subject: `🎯 Nuevo lead: ${lead.nombre || 'Sin nombre'} — ${e1.sc != null ? e1.sc + '%' : '-'}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      return NextResponse.json({ ok: false, error: errText }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
