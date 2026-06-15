'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import '../admin.css';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="adm-login-wrap">
      <form onSubmit={handleSubmit} className="adm-card adm-login-card">
        <h1 className="adm-login-title">PrecalificateRD — Admin</h1>

        <label className="adm-label" htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          required
          className="adm-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="adm-label" htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          required
          className="adm-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="adm-error">{error}</p>}

        <button type="submit" className="adm-btn adm-btn-primary" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
