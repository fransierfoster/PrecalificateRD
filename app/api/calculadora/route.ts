import { NextRequest, NextResponse } from 'next/server';
import { calcularInversa } from '@/lib/calculadora-inversa';

export const runtime = 'nodejs';

const VENTANA_MS = 60 * 60 * 1000;
const MAX_POR_VENTANA = 10;
const hits = new Map<string, number[]>();

function limitado(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (hits.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  hits.set(ip, recientes);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => ahora - t >= VENTANA_MS)) hits.delete(k);
  }
  return recientes.length > MAX_POR_VENTANA;
}

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    if (limitado(ip)) {
      return NextResponse.json({ error: 'limite' }, { status: 429 });
    }

    const body = await req.json();
    const valor = Number(body?.valor);
    const moneda = body?.moneda === 'USD' ? 'USD' : 'DOP';

    const r = await calcularInversa(valor, moneda);
    if (!r.ok) {
      return NextResponse.json(r, { status: 400 });
    }
    return NextResponse.json(r);
  } catch (err) {
    console.error('Error en /api/calculadora:', err);
    return NextResponse.json({ error: 'interno' }, { status: 500 });
  }
}
