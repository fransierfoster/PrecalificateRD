import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase
      .from('precalifica_parametros')
      .select('clave, valor')
      .in('clave', ['ui_popup_activo', 'ui_contador_visible']);

    const map: Record<string, number> = {};
    (data || []).forEach((r: { clave: string; valor: number }) => {
      map[r.clave] = Number(r.valor);
    });

    return NextResponse.json({
      popupActivo: map['ui_popup_activo'] !== 0,
      contadorVisible: map['ui_contador_visible'] !== 0,
    });
  } catch {
    return NextResponse.json({ popupActivo: true, contadorVisible: true });
  }
}
