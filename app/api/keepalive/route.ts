import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'missing env' }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/contar_precalificaciones`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });

    const total = await res.json();
    return NextResponse.json({ ok: true, calculos: total, ts: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
