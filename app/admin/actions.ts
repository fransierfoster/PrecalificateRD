'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadFlatParams, buildParamsFromMap, defaultParams, computeFull,
  DEF_TC, DEF_TDOP, DEF_TUSD, type CalcInput,
} from '../api/calcular/route';

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

// Chequeo de rol adicional (defensa en profundidad) para acciones que no
// tienen su propia policy de RLS que ya bloquee al rol "leads" -- por ejemplo
// reenviar un correo no modifica ni borra el lead, asi que RLS por si sola no
// lo impediria para ese rol.
async function requireFullAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.email) return 'No autenticado';

  const { data: admin } = await supabase
    .from('admins')
    .select('role')
    .eq('email', userData.user.email)
    .maybeSingle();

  if (!admin || admin.role !== 'full') return 'No autorizado';
  return null;
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
    popup_prioritario: formData.get('popup_prioritario') === 'on',
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

// ── COMENTARIOS DE LEADS ─────────────────────────────────────────────────────
// Disponible para cualquier admin (full o leads) -- agregar solamente, nunca
// editar ni borrar (no existen funciones para eso a proposito, y tampoco hay
// policy de UPDATE/DELETE en precalifica_lead_comentarios).
export async function addLeadComentario(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const leadId = String(formData.get('lead_id') || '');
  const comentario = String(formData.get('comentario') || '').trim();
  if (!leadId || !comentario) return { ok: false, error: 'Falta el comentario' };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const autor = userData?.user?.email || 'desconocido';

  const { error } = await supabase.from('precalifica_lead_comentarios').insert({
    lead_id: leadId, autor, comentario,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  return { ok: true };
}

// ── ACCESOS DE LEADS (usuarios con rol restringido) ─────────────────────────
// Requieren ADMIN_PARAMS_PASSWORD, igual que otras acciones sensibles.
// Usan el cliente con Service Role para crear/eliminar/actualizar el usuario
// de Supabase Auth directamente, sin pasar por un flujo de invitacion/email.
export async function createLeadsAdmin(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const roleErr = await requireFullAdmin();
  if (roleErr) return { ok: false, error: roleErr };
  const passErr = checkAdminPassword(formData);
  if (passErr) return { ok: false, error: passErr };

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { ok: false, error: 'Correo y contraseña son obligatorios' };
  if (password.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) return { ok: false, error: createErr.message };

  // admins solo tiene policy de SELECT (propia fila) -- el insert tiene que
  // hacerse con el cliente de service role, no con la sesion del admin.
  const { error: insertErr } = await admin.from('admins').insert({
    email, role: 'leads', user_id: created.user.id,
  });
  if (insertErr) {
    // Revertir la creacion del usuario si no se pudo registrar en admins.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: insertErr.message };
  }

  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteLeadsAdmin(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const roleErr = await requireFullAdmin();
  if (roleErr) return { ok: false, error: roleErr };
  const passErr = checkAdminPassword(formData);
  if (passErr) return { ok: false, error: passErr };

  const email = String(formData.get('email') || '');
  const userId = String(formData.get('user_id') || '');
  if (!email) return { ok: false, error: 'Falta el correo' };

  // admins no tiene policy de DELETE para la sesion del admin -- se hace con
  // el cliente de service role.
  const admin = createAdminClient();
  const { error: deleteErr } = await admin.from('admins').delete().eq('email', email).eq('role', 'leads');
  if (deleteErr) return { ok: false, error: deleteErr.message };

  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }

  revalidatePath('/admin');
  return { ok: true };
}

export async function resetLeadsAdminPassword(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const roleErr = await requireFullAdmin();
  if (roleErr) return { ok: false, error: roleErr };
  const passErr = checkAdminPassword(formData);
  if (passErr) return { ok: false, error: passErr };

  const userId = String(formData.get('user_id') || '');
  const password = String(formData.get('password') || '');
  if (!userId || !password) return { ok: false, error: 'Falta el usuario o la contraseña' };
  if (password.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

// ── REENVIAR DETALLE DE LEAD POR CORREO ─────────────────────────────────────
// Recalcula con los parametros ACTUALES del motor (pueden diferir de lo que
// el cliente vio en su momento si se ajustaron parametros desde entonces).
// Datos de co-deudor no guardados en su momento (deudas/atrasos del
// co-deudor) se asumen en 0 / sin atrasos -- caso poco comun, pero el
// resultado podria ser levemente mas favorable que el original para esos leads.
const EMP_LABELS: Record<string, string> = {
  formal: 'Empleado formal', independiente: 'Independiente', empresario: 'Empresario',
  remesa: 'Diáspora / ingresos en el exterior', pension: 'Pensionado',
};
const ATRASO_LABELS: Record<number, string> = {
  0: 'Sin atrasos', 30: 'Hasta 30 días', 45: '31-60 días', 90: 'Más de 60 días',
};

function fmtMoneyEmail(n: number | null | undefined, currency: string) {
  if (n == null) return '-';
  const symbol = currency === 'USD' ? 'US$' : 'RD$';
  return symbol + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export async function sendLeadEmailTo(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const roleErr = await requireFullAdmin();
  if (roleErr) return { ok: false, error: roleErr };

  const leadId = String(formData.get('lead_id') || '');
  const toEmail = String(formData.get('to_email') || '').trim();
  if (!leadId || !toEmail) return { ok: false, error: 'Falta el correo destino' };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY no configurada en el servidor' };

  const supabase = await createClient();
  const { data: lead, error: leadErr } = await supabase
    .from('precalifica_leads')
    .select('*, precalifica_calculos(*)')
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr || !lead) return { ok: false, error: leadErr?.message || 'Lead no encontrado' };

  const c = lead.precalifica_calculos;
  if (!c) return { ok: false, error: 'Este lead no tiene un cálculo asociado' };

  const mr = c.moneda_resultado === 'USD' ? 'USD' : 'DOP';
  const input: CalcInput = {
    edad: c.edad || 0, pais: c.pais || 'DO', emp: c.empleo || 'formal', ant: c.antiguedad_laboral || 'mas5',
    tuvoPres: !!c.tuvo_prestamos, expc: c.exp_monto || 0, antCred: c.antiguedad_credito || 'nunca',
    prods: c.productos || ['ninguno'],
    atraw: c.atraso_dias || 0, atpat: c.atraso_patron || 'na', atrehab: '',
    tieneCD: !!c.tiene_codeudor, activos: c.activos_dop || 0,
    ingDOP: c.ing_dop || 0, deuDOP: c.deu_dop || 0,
    ingCDDOP: c.ingreso_codeudor_dop || 0, deuCDDOP: 0,
    expcCD: 0, antCredCD: 'nunca', prodsCD: ['ninguno'],
    atrawCD: 0, atpatCD: 'na', empCD: '', antCD: '', paisCD: '',
    vinmDOP: c.vinm_dop || 0, iniDOP: c.ini_dop || 0, mr,
  };

  const flatMap = await loadFlatParams();
  const p = flatMap ? buildParamsFromMap(flatMap) : defaultParams();
  const tc = p.fin.tc || DEF_TC;
  const tdop = p.fin.tasaDOP / 12 || DEF_TDOP;
  const tusd = p.fin.tasaUSD / 12 || DEF_TUSD;
  const tm = mr === 'USD' ? tusd : tdop;

  const result = computeFull(input, p, tm, tc);
  const { e1, e2, why, sims } = result;

  const rows: string[] = [];
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 10px;color:#666;font-size:13px;">${label}</td><td style="padding:4px 10px;font-size:13px;"><b>${value}</b></td></tr>`;

  rows.push(row('Nombre', `${lead.nombre || ''} ${lead.apellido || ''}`.trim() || '-'));
  rows.push(row('WhatsApp', lead.telefono || '-'));
  rows.push(row('Email', lead.email || '-'));
  rows.push(row('Documento', `${lead.doc_tipo || ''} ${lead.doc_numero || ''}`.trim() || '-'));
  rows.push(row('Desea ofertas', lead.quiere_ofertas ? 'Sí' : 'No'));

  const e1Rows: string[] = [];
  e1Rows.push(row('Valor inmueble', fmtMoneyEmail(c.vinm_dop, mr)));
  e1Rows.push(row('Monto a financiar', fmtMoneyEmail(c.pr_dop, mr)));
  e1Rows.push(row('Inicial', fmtMoneyEmail(c.ini_dop, mr)));
  e1Rows.push(row('Cuota mensual', fmtMoneyEmail(e1.cDOP, mr)));
  e1Rows.push(row('Capacidad de endeudamiento', e1.dti != null ? Math.round(e1.dti * 100) + '%' : '-'));
  e1Rows.push(row('Probabilidad (Score E1)', (e1.sc != null ? e1.sc : '-') + '%'));

  const e2Rows: string[] = [];
  if (e2.sc != null) {
    e2Rows.push(row('Valor inmueble sugerido', fmtMoneyEmail(result.virDOP, mr)));
    e2Rows.push(row('Monto a financiar', fmtMoneyEmail(result.mrDOP, mr)));
    e2Rows.push(row('Probabilidad (Score E2)', e2.sc + '%'));
  }

  const perfilRows: string[] = [];
  perfilRows.push(row('Ingreso mensual', fmtMoneyEmail(c.ing_dop, mr)));
  perfilRows.push(row('Deudas mensuales', fmtMoneyEmail(c.deu_dop, mr)));
  perfilRows.push(row('Ingresos adicionales', fmtMoneyEmail(c.activos_dop, mr)));
  perfilRows.push(row('Empleo', `${EMP_LABELS[c.empleo || ''] || c.empleo || '-'} · ${c.antiguedad_laboral || '-'}`));
  perfilRows.push(row('País de residencia', c.pais || '-'));
  perfilRows.push(row('Edad', c.edad != null ? `${c.edad} años` : '-'));

  const histRows: string[] = [];
  histRows.push(row('Historial previo', c.tuvo_prestamos ? 'Con préstamos previos' : 'Sin préstamos previos'));
  histRows.push(row('Atrasos', `${ATRASO_LABELS[c.atraso_dias ?? -1] || '-'} ${c.atraso_patron === 'patron' ? '(recurrente)' : c.atraso_patron === 'unico' ? '(aislado)' : ''}`));
  histRows.push(row('Antigüedad de crédito', c.antiguedad_credito || '-'));
  histRows.push(row('Productos financieros', (c.productos || []).join(', ') || 'Ninguno'));
  histRows.push(row('Co-deudor', c.tiene_codeudor ? `Sí — ingreso ${fmtMoneyEmail(c.ingreso_codeudor_dop, mr)}` : 'No'));

  const WHY_ICON: Record<string, string> = { ok: '✅', w: '⚠️', b: '❌' };
  const WHY_COLOR: Record<string, string> = { ok: '#065F46', w: '#92400E', b: '#991B1B' };
  const whyHtml = why.map((w) =>
    `<div style="margin-bottom:10px;padding:8px 12px;border-radius:6px;background:${w.t === 'ok' ? '#F0FDF4' : w.t === 'w' ? '#FFFBEB' : '#FEF2F2'};">
      <div style="font-size:13px;font-weight:bold;color:${WHY_COLOR[w.t] || '#333'};">${WHY_ICON[w.t] || '•'} ${w.x}</div>
      <div style="font-size:12px;color:#555;margin-top:3px;">${w.s}</div>
    </div>`).join('');

  const simsFiltered = sims.filter((s) => s.d > 0);
  const simsHtml = simsFiltered.map((s) =>
    `<div style="margin-bottom:6px;padding:7px 12px;border-radius:6px;background:#EFF6FF;font-size:12px;">
      <span style="font-weight:bold;color:#1D4ED8;">+${s.d}%</span>
      <span style="color:#333;margin-left:6px;">${s.l}</span>
      <span style="color:#6B7280;margin-left:6px;">→ llegaría a ${s.b}%</span>
    </div>`).join('');

  const section = (title: string, htmlRows: string[]) =>
    htmlRows.length ? `<h3 style="margin:18px 0 6px;font-size:14px;color:#C0161C;">${title}</h3><table style="width:100%;border-collapse:collapse;">${htmlRows.join('')}</table>` : '';
  const sectionHtml = (title: string, content: string) =>
    content ? `<h3 style="margin:18px 0 6px;font-size:14px;color:#C0161C;">${title}</h3>${content}` : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0D0D0D;padding:16px 20px;border-radius:10px 10px 0 0;">
        <span style="color:#fff;font-size:18px;font-weight:bold;">📤 Reenvío de lead — PrecalificateRD</span>
      </div>
      <div style="border:1px solid #eee;border-radius:0 0 10px 10px;padding:16px 20px;">
        <p style="font-size:11px;color:#9CA3AF;margin:0 0 10px;">Recalculado con los parámetros actuales del motor el ${new Date().toLocaleString('es-DO')}.</p>
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
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'PrecalificateRD <onboarding@resend.dev>',
      to: [toEmail],
      subject: `📤 Lead reenviado: ${lead.nombre || 'Sin nombre'} — ${e1.sc != null ? e1.sc + '%' : '-'}`,
      html,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    return { ok: false, error: errText };
  }

  return { ok: true };
}
