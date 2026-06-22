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
