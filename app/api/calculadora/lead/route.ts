import { NextRequest, NextResponse } from 'next/server';
import { calcularInversa } from '@/lib/calculadora-inversa';
import { ipDe } from '@/lib/limite-uso';

export const runtime = 'nodejs';

const NOTIFY_TO = 'precalificaterd@gmail.com';
const NOTIFY_FROM = 'PrecalificateRD <onboarding@resend.dev>';

const VENTANA_MS = 60 * 60 * 1000;
const MAX_POR_VENTANA = 4;
const envios = new Map<string, number[]>();

function limitado(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (envios.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  envios.set(ip, recientes);
  if (envios.size > 5000) {
    for (const [k, v] of envios) if (v.every((t) => ahora - t >= VENTANA_MS)) envios.delete(k);
  }
  return recientes.length > MAX_POR_VENTANA;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const limpio = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export async function POST(req: NextRequest) {
  try {
    const ip = ipDe(req);
    if (limitado(ip)) return NextResponse.json({ error: 'limite' }, { status: 429 });

    const body = await req.json();
    const nombre = limpio(body?.nombre, 60);
    const apellido = limpio(body?.apellido, 60);
    const email = limpio(body?.email, 100);
    const tel = limpio(body?.tel, 25).replace(/[^\d+ ()-]/g, '');
    const digitos = tel.replace(/\D/g, '');
    const fuente = limpio(body?.fuente, 30).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const sessionId = limpio(body?.sessionId, 80) || null;
    const moneda = body?.moneda === 'USD' ? 'USD' : 'DOP';
    const pct = [70, 80, 90].includes(Number(body?.pct)) ? Number(body.pct) : null;

    if (!nombre || !apellido) return NextResponse.json({ error: 'nombre' }, { status: 400 });
    if (digitos.length < 10 || digitos.length > 15) return NextResponse.json({ error: 'telefono' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'email' }, { status: 400 });
    if (body?.consentimiento !== true) return NextResponse.json({ error: 'consentimiento' }, { status: 400 });

    const calc = await calcularInversa(Number(body?.valor), moneda);
    if (!calc.ok) return NextResponse.json({ error: 'valor' }, { status: 400 });

    const sym = moneda === 'USD' ? 'US$' : 'RD$';
    const op = calc.opciones.find((o) => o.pct === pct) || null;
    const partes = [`Calculadora${fuente ? ` (${fuente})` : ''}: solicita opciones de propiedades en su rango.`, `Vivienda de interés: ${sym} ${fmt(calc.valor)}.`];
    if (op) {
      partes.push(`Financiaría ${op.pct}% (inicial ${sym} ${fmt(op.inicial)}, cuota aprox. ${sym} ${fmt(op.cuota)}).`);
      if (op.ingresoMin != null) {
        partes.push(op.ingresoMax != null
          ? `Ingreso mensual aprox. requerido: RD$ ${fmt(op.ingresoMin)} – ${fmt(op.ingresoMax)}.`
          : `Ingreso mensual aprox. requerido: desde RD$ ${fmt(op.ingresoMin)}.`);
      }
    }
    const notas = partes.join(' ');

    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supaUrl || !supaKey) return NextResponse.json({ error: 'interno' }, { status: 500 });

    const ins = await fetch(`${supaUrl}/rest/v1/precalifica_leads`, {
      method: 'POST',
      headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        session_id: sessionId,
        nombre,
        apellido,
        telefono: tel,
        email: email || null,
        quiere_ofertas: true,
        tipo: 'propiedades',
        origen: 'calculadora',
        fuente: fuente || null,
        notas,
      }),
    });
    if (!ins.ok) {
      console.error('Error guardando lead de propiedades:', ins.status, await ins.text());
      return NextResponse.json({ error: 'interno' }, { status: 500 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const row = (l: string, v: string) =>
        `<tr><td style="padding:4px 10px;color:#666;font-size:13px;">${l}</td><td style="padding:4px 10px;font-size:13px;"><b>${esc(v)}</b></td></tr>`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0D0D0D;padding:16px 20px;border-radius:10px 10px 0 0;">
            <span style="color:#fff;font-size:18px;font-weight:bold;">🏠 Nuevo lead (propiedades) — PrecalificateRD</span>
          </div>
          <div style="border:1px solid #eee;border-radius:0 0 10px 10px;padding:16px 20px;">
            <table style="width:100%;border-collapse:collapse;">
              ${row('Nombre', `${nombre} ${apellido}`)}
              ${row('WhatsApp', tel)}
              ${row('Email', email || '-')}
              ${row('Origen', fuente ? `Calculadora (${fuente})` : 'Calculadora')}
            </table>
            <p style="font-size:13px;color:#333;line-height:1.5;margin-top:14px;">${esc(notas)}</p>
            <p style="font-size:12px;color:#6B7280;">No se solicitó cédula en este flujo.</p>
          </div>
        </div>`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: NOTIFY_FROM, to: [NOTIFY_TO], subject: `🏠 Nuevo lead (propiedades): ${nombre}`, html }),
        });
      } catch (err) {
        console.error('Error enviando correo de lead de propiedades:', err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error en /api/calculadora/lead:', err);
    return NextResponse.json({ error: 'interno' }, { status: 500 });
  }
}
