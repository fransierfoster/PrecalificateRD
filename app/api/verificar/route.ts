import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')?.toUpperCase().trim();

  if (!ref) {
    return NextResponse.json({ found: false, error: 'Referencia requerida' }, { status: 400 });
  }

  // Format: PRC-YYYY-XXXXXXXX  (8 hex chars = first 8 of UUID without dashes)
  const match = ref.match(/^PRC-\d{4}-([0-9A-F]{8})$/);
  if (!match) {
    return NextResponse.json({ found: false, error: 'Formato inválido. Usa: PRC-AAAA-XXXXXXXX' });
  }

  const prefix = match[1].toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('precalifica_leads')
    .select('nombre, apellido, created_at, tipo')
    .ilike('calculo_id', `${prefix}%`)
    .eq('tipo', 'pdf')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ found: false });
  }

  const fecha = new Date(data.created_at).toLocaleDateString('es-DO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return NextResponse.json({
    found: true,
    nombre: `${data.nombre || ''} ${data.apellido || ''}`.trim(),
    fecha,
  });
}
