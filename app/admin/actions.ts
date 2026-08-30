'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updateParametro(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const clave = String(formData.get('clave'));
  const valor = Number(formData.get('valor'));
  const password = String(formData.get('adminPassword') || '');

  const expected = process.env.ADMIN_PARAMS_PASSWORD;
  if (!expected) {
    return { ok: false, error: 'ADMIN_PARAMS_PASSWORD no configurada en el servidor' };
  }
  if (password !== expected) {
    return { ok: false, error: 'Contraseña incorrecta' };
  }
  if (!clave || Number.isNaN(valor)) {
    return { ok: false, error: 'Valor inválido' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('precalifica_parametros')
    .update({ valor, updated_at: new Date().toISOString() })
    .eq('clave', clave);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function updateLead(formData: FormData) {
  const id = String(formData.get('id'));

  const supabase = await createClient();
  await supabase
    .from('precalifica_leads')
    .update({
      contactado: formData.get('contactado') === 'on',
      asesor_asignado: String(formData.get('asesor_asignado') || ''),
      resultado_banco: String(formData.get('resultado_banco') || ''),
      notas: String(formData.get('notas') || ''),
    })
    .eq('id', id);

  revalidatePath('/admin');
}

function checkAdminPassword(formData: FormData): string | null {
  const password = String(formData.get('adminPassword') || '');
  const expected = process.env.ADMIN_PARAMS_PASSWORD;
  if (!expected) return 'ADMIN_PARAMS_PASSWORD no configurada en el servidor';
  if (password !== expected) return 'Contraseña incorrecta';
  return null;
}

export async function deleteLead(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get('id'));
  const passErr = checkAdminPassword(formData);
  if (passErr) return { ok: false, error: passErr };
  if (!id) return { ok: false, error: 'ID inválido' };

  const supabase = await createClient();
  const { error } = await supabase.from('precalifica_leads').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteCalculo(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get('id'));
  const passErr = checkAdminPassword(formData);
  if (passErr) return { ok: false, error: passErr };
  if (!id) return { ok: false, error: 'ID inválido' };

  const supabase = await createClient();
  const { error } = await supabase.from('precalifica_calculos').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

export async function saveAnuncio(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const posicion = Number(formData.get('posicion'));
  const file = formData.get('imagen') as File | null;

  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    titulo: String(formData.get('titulo') || ''),
    descripcion: String(formData.get('descripcion') || ''),
    referencia: String(formData.get('referencia') || ''),
    score_minimo: Number(formData.get('score_minimo') || 70),
    monto_minimo: Number(String(formData.get('monto_minimo') || '0').replace(/,/g, '')),
    descuento_activo: formData.get('descuento_activo') === 'true',
    descuento_monto: Number(String(formData.get('descuento_monto') || '0').replace(/,/g, '')) || null,
    descuento_moneda: String(formData.get('descuento_moneda') || 'DOP'),
    descuento_codigo: String(formData.get('descuento_codigo') || ''),
    descuento_texto: String(formData.get('descuento_texto') || ''),
    updated_at: new Date().toISOString(),
  };

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop();
    const path = `anuncio-${posicion}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage.from('anuncios').upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });
    if (upErr) return { ok: false, error: upErr.message };
    const { data: urlData } = supabase.storage.from('anuncios').getPublicUrl(path);
    updates.imagen_url = urlData.publicUrl + '?t=' + Date.now();
  }

  const { error } = await supabase.from('precalifica_anuncios').update(updates).eq('posicion', posicion);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function toggleAnuncio(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const posicion = Number(formData.get('posicion'));
  const activo = formData.get('activo') === 'true';

  const supabase = await createClient();
  const { error } = await supabase
    .from('precalifica_anuncios')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('posicion', posicion);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function reorderAnuncio(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const posicion = Number(formData.get('posicion'));
  const direccion = String(formData.get('direccion'));

  const supabase = await createClient();
  const { data: todos } = await supabase
    .from('precalifica_anuncios')
    .select('posicion, orden')
    .order('orden');

  if (!todos) return { ok: false, error: 'No se pudieron cargar los anuncios' };

  const idx = todos.findIndex((a) => a.posicion === posicion);
  const swapIdx = direccion === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= todos.length) return { ok: true };

  const ordenA = todos[idx].orden;
  const ordenB = todos[swapIdx].orden;

  await supabase.from('precalifica_anuncios').update({ orden: ordenB }).eq('posicion', todos[idx].posicion);
  await supabase.from('precalifica_anuncios').update({ orden: ordenA }).eq('posicion', todos[swapIdx].posicion);

  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteAnuncioImagen(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const posicion = Number(formData.get('posicion'));

  const supabase = await createClient();
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of exts) {
    await supabase.storage.from('anuncios').remove([`anuncio-${posicion}.${ext}`]);
  }
  const { error } = await supabase
    .from('precalifica_anuncios')
    .update({ imagen_url: null, activo: false, updated_at: new Date().toISOString() })
    .eq('posicion', posicion);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

// ── Bancos (multi-banco — ver nota en app/api/calcular/route.ts) ───────────

export async function saveBanco(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get('id'));
  const file = formData.get('logo') as File | null;

  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    nombre: String(formData.get('nombre') || ''),
    color: String(formData.get('color') || '#1D3A8A'),
    iniciales: String(formData.get('iniciales') || '').slice(0, 3).toUpperCase(),
    tasa_interes: Number(formData.get('tasa_interes') || 0),
    updated_at: new Date().toISOString(),
  };

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop();
    const path = `banco-${id}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage.from('bancos-logos').upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });
    if (upErr) return { ok: false, error: upErr.message };
    const { data: urlData } = supabase.storage.from('bancos-logos').getPublicUrl(path);
    updates.logo_url = urlData.publicUrl + '?t=' + Date.now();
  }

  const { error } = await supabase.from('precalifica_bancos').update(updates).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function toggleBanco(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = await createClient();
  const { error } = await supabase
    .from('precalifica_bancos')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function reorderBanco(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get('id'));
  const direccion = String(formData.get('direccion'));

  const supabase = await createClient();
  const { data: todos } = await supabase
    .from('precalifica_bancos')
    .select('id, orden')
    .order('orden');

  if (!todos) return { ok: false, error: 'No se pudieron cargar los bancos' };

  const idx = todos.findIndex((b) => b.id === id);
  const swapIdx = direccion === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= todos.length) return { ok: true };

  const ordenA = todos[idx].orden;
  const ordenB = todos[swapIdx].orden;

  await supabase.from('precalifica_bancos').update({ orden: ordenB }).eq('id', todos[idx].id);
  await supabase.from('precalifica_bancos').update({ orden: ordenA }).eq('id', todos[swapIdx].id);

  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteBancoLogo(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get('id'));

  const supabase = await createClient();
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
  for (const ext of exts) {
    await supabase.storage.from('bancos-logos').remove([`banco-${id}.${ext}`]);
  }
  const { error } = await supabase
    .from('precalifica_bancos')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function saveBancoParametro(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const bancoId = String(formData.get('banco_id'));
  const clave = String(formData.get('clave'));
  const categoria = String(formData.get('categoria') || '');
  const valor = Number(formData.get('valor'));
  const passErr = checkAdminPassword(formData);
  if (passErr) return { ok: false, error: passErr };
  if (!bancoId || !clave || Number.isNaN(valor)) return { ok: false, error: 'Valor inválido' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('precalifica_bancos_parametros')
    .upsert(
      { banco_id: bancoId, clave, categoria, valor, updated_at: new Date().toISOString() },
      { onConflict: 'banco_id,clave' },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

export async function addBanco(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const nombre = String(formData.get('nombre') || '').trim();
  if (!nombre) return { ok: false, error: 'El nombre es obligatorio' };

  const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `banco-${Date.now()}`;

  const supabase = await createClient();
  const { data: existentes } = await supabase.from('precalifica_bancos').select('orden').order('orden', { ascending: false }).limit(1);
  const orden = (existentes?.[0]?.orden || 0) + 1;

  const { error } = await supabase.from('precalifica_bancos').insert({
    slug, nombre, activo: false, orden,
    iniciales: nombre.slice(0, 3).toUpperCase(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}
