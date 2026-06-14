'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updateParametro(formData: FormData) {
  const clave = String(formData.get('clave'));
  const valor = Number(formData.get('valor'));

  const supabase = await createClient();
  await supabase
    .from('precalifica_parametros')
    .update({ valor, updated_at: new Date().toISOString() })
    .eq('clave', clave);

  revalidatePath('/admin');
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
