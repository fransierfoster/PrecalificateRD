'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLeadsAdmin, deleteLeadsAdmin, resetLeadsAdminPassword } from './actions';

export type AccesoLeads = { email: string; user_id: string | null };

function CrearAccesoForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const adminPassword = window.prompt('Confirma tu contraseña de administrador para crear este acceso:');
    if (adminPassword == null) return;

    setBusy(true);
    setMsg('');
    const fd = new FormData();
    fd.set('email', email);
    fd.set('password', password);
    fd.set('adminPassword', adminPassword);

    const res = await createLeadsAdmin(fd);
    setBusy(false);

    if (!res.ok) {
      setMsg('❌ ' + (res.error || 'Error al crear el acceso'));
      return;
    }
    setMsg('✅ Acceso creado');
    setEmail('');
    setPassword('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
      <input type="email" placeholder="correo@ejemplo.com" required value={email} onChange={(e) => setEmail(e.target.value)}
        style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, minWidth: 220 }} />
      <input type="text" placeholder="Contraseña (mín. 8 caracteres)" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
        style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, minWidth: 220 }} />
      <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
        {busy ? 'Creando…' : '+ Crear acceso'}
      </button>
      {msg && <span style={{ fontSize: 12 }}>{msg}</span>}
    </form>
  );
}

function AccesoRow({ acceso }: { acceso: AccesoLeads }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleResetPassword() {
    const nueva = window.prompt(`Nueva contraseña para ${acceso.email} (mín. 8 caracteres):`);
    if (!nueva) return;
    if (nueva.length < 8) { setMsg('❌ Debe tener al menos 8 caracteres'); return; }
    const adminPassword = window.prompt('Confirma tu contraseña de administrador:');
    if (adminPassword == null) return;

    setBusy(true);
    setMsg('');
    const fd = new FormData();
    fd.set('user_id', acceso.user_id || '');
    fd.set('password', nueva);
    fd.set('adminPassword', adminPassword);

    const res = await resetLeadsAdminPassword(fd);
    setBusy(false);
    setMsg(res.ok ? '✅ Contraseña actualizada' : '❌ ' + (res.error || 'Error'));
    setTimeout(() => setMsg(''), 4000);
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el acceso de ${acceso.email}? No podrá volver a entrar al admin.`)) return;
    const adminPassword = window.prompt('Confirma tu contraseña de administrador para eliminar:');
    if (adminPassword == null) return;

    setBusy(true);
    setMsg('');
    const fd = new FormData();
    fd.set('email', acceso.email);
    fd.set('user_id', acceso.user_id || '');
    fd.set('adminPassword', adminPassword);

    const res = await deleteLeadsAdmin(fd);
    setBusy(false);
    if (!res.ok) { setMsg('❌ ' + (res.error || 'Error al eliminar')); return; }
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #e5e5e5', borderRadius: 8, marginBottom: 6 }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{acceso.email}</span>
      <button type="button" className="adm-btn" disabled={busy} onClick={handleResetPassword}>🔑 Cambiar contraseña</button>
      <button type="button" className="adm-btn adm-btn-delete" disabled={busy} onClick={handleDelete}>🗑 Eliminar</button>
      {msg && <span style={{ fontSize: 12 }}>{msg}</span>}
    </div>
  );
}

export default function AccesosLeadsPanel({ accesos }: { accesos: AccesoLeads[] }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 12px' }}>
        Crea accesos con correo y contraseña que tú elijas. Esa persona entra por el mismo login del admin, pero solo ve la lista de leads, puede agregar comentarios de seguimiento y reenviar el detalle por correo — no puede editar ni eliminar nada.
      </p>
      <CrearAccesoForm />
      {accesos.length === 0 ? (
        <p className="adm-empty">No hay accesos restringidos creados todavía.</p>
      ) : (
        accesos.map((a) => <AccesoRow key={a.email} acceso={a} />)
      )}
    </div>
  );
}
