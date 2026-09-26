import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente con la Service Role Key -- ignora RLS por completo y puede
// administrar usuarios de Supabase Auth (crear/eliminar/cambiar contraseña).
// SOLO usar en Server Actions / rutas server-side. Nunca importar desde
// codigo que se ejecute en el cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no esta configurada en el servidor.');
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
