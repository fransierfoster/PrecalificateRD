'use client';

import { useState } from 'react';
import Image from 'next/image';

type Result =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'found'; nombre: string; fecha: string; ref: string }
  | { state: 'notfound'; ref: string }
  | { state: 'error'; message: string };

export default function VerificarPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Result>({ state: 'idle' });

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const ref = input.trim().toUpperCase();
    if (!ref) return;
    setResult({ state: 'loading' });
    try {
      const res = await fetch(`/api/verificar?ref=${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (data.found) {
        setResult({ state: 'found', nombre: data.nombre, fecha: data.fecha, ref });
      } else if (data.error) {
        setResult({ state: 'error', message: data.error });
      } else {
        setResult({ state: 'notfound', ref });
      }
    } catch {
      setResult({ state: 'error', message: 'Error de conexión. Intenta nuevamente.' });
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F5F2',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 16px', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#C0161C', letterSpacing: '-0.5px' }}>
          PrecalificateRD
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>Perfect House SRL</div>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '28px 24px',
        maxWidth: 440, width: '100%',
        boxShadow: '0 2px 20px rgba(0,0,0,.07)',
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1110', marginBottom: 6 }}>
            Verificar autenticidad de reporte
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
            Ingresa el número de referencia que aparece en el reporte PDF para confirmar que fue generado por PrecalificateRD.
          </div>
        </div>

        <form onSubmit={buscar}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Número de referencia
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setResult({ state: 'idle' }); }}
            placeholder="PRC-2026-A1B2C3D4"
            style={{
              display: 'block', width: '100%', padding: '11px 14px',
              border: '1.5px solid #E5E2DF', borderRadius: 10,
              fontSize: 15, fontWeight: 600, letterSpacing: '1px',
              color: '#1A1110', background: '#F9F8F7',
              outline: 'none', boxSizing: 'border-box',
              fontFamily: 'monospace',
              marginBottom: 12,
            }}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={result.state === 'loading' || !input.trim()}
            style={{
              display: 'block', width: '100%', padding: '12px',
              background: result.state === 'loading' ? '#E5E2DF' : '#C0161C',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: result.state === 'loading' ? 'default' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {result.state === 'loading' ? 'Verificando…' : 'Verificar reporte'}
          </button>
        </form>

        {/* Results */}
        {result.state === 'found' && (
          <div style={{
            marginTop: 20, padding: '16px', borderRadius: 10,
            background: '#F0FDF4', border: '1.5px solid #6EE7B7',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
              ✅ Reporte verificado
            </div>
            <div style={{ fontSize: 14, color: '#1A1110', marginBottom: 4 }}>
              <span style={{ color: '#6B7280' }}>Nombre:</span> <strong>{result.nombre}</strong>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>
              <span>Fecha de generación:</span> {result.fecha}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>
              Ref: {result.ref}
            </div>
          </div>
        )}

        {result.state === 'notfound' && (
          <div style={{
            marginTop: 20, padding: '16px', borderRadius: 10,
            background: '#FEF2F2', border: '1.5px solid #FCA5A5',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
              ❌ No encontrado
            </div>
            <div style={{ fontSize: 13, color: '#7F1D1D' }}>
              No existe ningún reporte con la referencia <strong style={{ fontFamily: 'monospace' }}>{result.ref}</strong>. Verifica que el número esté bien escrito.
            </div>
          </div>
        )}

        {result.state === 'error' && (
          <div style={{
            marginTop: 20, padding: '14px', borderRadius: 10,
            background: '#FFFBEB', border: '1.5px solid #FCD34D',
          }}>
            <div style={{ fontSize: 13, color: '#78350F' }}>{result.message}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
        Este portal confirma la autenticidad de reportes emitidos por PrecalificateRD.<br />
        Para consultas: <a href="mailto:precalificaterd@gmail.com" style={{ color: '#C0161C' }}>precalificaterd@gmail.com</a>
      </div>
    </div>
  );
}
