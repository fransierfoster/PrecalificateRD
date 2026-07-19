'use client';

import { useRef, useState, useTransition } from 'react';
import { saveAnuncio, toggleAnuncio, reorderAnuncio, deleteAnuncioImagen } from './actions';

export type Anuncio = {
  posicion: number;
  activo: boolean;
  titulo: string | null;
  descripcion: string | null;
  imagen_url: string | null;
  referencia: string | null;
  score_minimo: number | null;
  monto_minimo: number | null;
  orden: number;
  descuento_activo: boolean;
  descuento_monto: number | null;
  descuento_moneda: string | null;
  descuento_codigo: string | null;
  descuento_texto: string | null;
};

function fmtMonto(n: number | null) {
  if (!n) return '';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function AnunciosPanel({ anuncios, total }: { anuncios: Anuncio[]; total: number }) {
  const hayActivos = anuncios.some((a) => a.activo);
  const sorted = [...anuncios].sort((a, b) => a.orden - b.orden);

  return (
    <div>
      {hayActivos && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
          ⚠️ Hay anuncios activos — el popup de captación de leads está <strong>pausado</strong> mientras dure.
        </div>
      )}
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
        Imagen recomendada: <strong>800 × 400 px</strong> · JPG o PNG · máx. 2 MB
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((ad, idx) => (
          <AnuncioSlot key={ad.posicion} ad={ad} idx={idx} total={total} />
        ))}
      </div>
    </div>
  );
}

function AnuncioSlot({ ad, idx, total }: { ad: Anuncio; idx: number; total: number }) {
  const [descuentoOpen, setDescuentoOpen] = useState(ad.descuento_activo);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const fd = new FormData(e.currentTarget);
    fd.set('descuento_activo', descuentoOpen ? 'true' : 'false');
    const res = await saveAnuncio(fd);
    setSaving(false);
    setMsg(res.ok ? '✅ Guardado' : '❌ ' + res.error);
    setTimeout(() => setMsg(''), 3000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPreview(URL.createObjectURL(f));
  }

  function handleToggle() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('posicion', String(ad.posicion));
      fd.set('activo', String(!ad.activo));
      await toggleAnuncio(fd);
    });
  }

  function handleOrder(dir: 'up' | 'down') {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('posicion', String(ad.posicion));
      fd.set('direccion', dir);
      await reorderAnuncio(fd);
    });
  }

  function handleDeleteImg() {
    if (!confirm('¿Eliminar la imagen de este anuncio?')) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('posicion', String(ad.posicion));
      await deleteAnuncioImagen(fd);
      setPreview(null);
    });
  }

  const imgSrc = preview || ad.imagen_url;

  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: 16, background: ad.activo ? '#F0FDF4' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
          Anuncio {ad.posicion}
          {ad.titulo && <span style={{ fontWeight: 400, color: '#6B7280', marginLeft: 6 }}>— {ad.titulo}</span>}
        </span>
        <span style={{
          fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
          background: ad.activo ? '#D1FAE5' : '#F3F4F6',
          color: ad.activo ? '#065F46' : '#6B7280',
          border: '1px solid ' + (ad.activo ? '#6EE7B7' : '#e5e5e5'),
        }}>
          {ad.activo ? 'Activo' : 'Inactivo'}
        </span>
        <button type="button" onClick={() => handleOrder('up')} disabled={idx === 0 || isPending}
          style={{ border: '1px solid #e5e5e5', borderRadius: 4, background: '#fff', width: 28, height: 28, cursor: 'pointer', fontSize: 12 }}>▲</button>
        <button type="button" onClick={() => handleOrder('down')} disabled={idx === total - 1 || isPending}
          style={{ border: '1px solid #e5e5e5', borderRadius: 4, background: '#fff', width: 28, height: 28, cursor: 'pointer', fontSize: 12 }}>▼</button>
      </div>

      <form onSubmit={handleSave}>
        <input type="hidden" name="posicion" value={ad.posicion} />

        {imgSrc ? (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <img src={imgSrc} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8 }} />
            <button type="button" onClick={handleDeleteImg}
              style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.55)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
              🗑 Eliminar imagen
            </button>
          </div>
        ) : (
          <div onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed #d1d5db', borderRadius: 8, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 10, color: '#9CA3AF', fontSize: 13 }}>
            📷 Clic para subir imagen (800×400 px)
          </div>
        )}
        <input ref={fileRef} type="file" name="imagen" accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }} onChange={handleFileChange} />
        {imgSrc && (
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', marginBottom: 10 }}>
            📷 Cambiar imagen
          </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Título del anuncio</label>
            <input name="titulo" defaultValue={ad.titulo || ''} placeholder="Ej: Torres del Este — desde RD$4,500,000"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Descripción breve</label>
            <input name="descripcion" defaultValue={ad.descripcion || ''} placeholder="Ej: Unidades de 1 y 2 habitaciones disponibles"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Referencia interna <span style={{ color: '#C0161C' }}>(aparece en rojo en el popup y en el email)</span></label>
            <input name="referencia" defaultValue={ad.referencia || ''} placeholder="Ej: #TDE-01"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Score mínimo (%)</label>
            <input name="score_minimo" type="number" min={0} max={100} defaultValue={ad.score_minimo ?? 70}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Monto mínimo (RD$)</label>
            <input name="monto_minimo" defaultValue={fmtMonto(ad.monto_minimo)}
              placeholder="0"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        <details open={descuentoOpen} onToggle={(e) => setDescuentoOpen((e.currentTarget as HTMLDetailsElement).open)}
          style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, marginBottom: 10 }}>
          <summary style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#92400E', userSelect: 'none' }}>
            💰 Descuento (opcional)
          </summary>
          <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: '#92400E', display: 'block', marginBottom: 2 }}>Monto del descuento</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select name="descuento_moneda" defaultValue={ad.descuento_moneda || 'DOP'}
                  style={{ width: 70, border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 4px', fontSize: 13, background: '#fff' }}>
                  <option value="DOP">RD$</option>
                  <option value="USD">US$</option>
                </select>
                <input name="descuento_monto" defaultValue={fmtMonto(ad.descuento_monto)} placeholder="225,000"
                  style={{ flex: 1, border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: '#92400E', display: 'block', marginBottom: 2 }}>Código promocional (opcional)</label>
              <input name="descuento_codigo" defaultValue={ad.descuento_codigo || ''} placeholder="PRECAL2025"
                style={{ width: '100%', border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: '#fff', boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: '#92400E', display: 'block', marginBottom: 2 }}>Texto del descuento</label>
              <input name="descuento_texto" defaultValue={ad.descuento_texto || ''} placeholder="Descuento exclusivo para clientes precalificados"
                style={{ width: '100%', border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 8px', fontSize: 13, background: '#fff', boxSizing: 'border-box' }} />
            </div>
          </div>
        </details>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="submit" disabled={saving}
            style={{ background: '#C0161C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Guardando…' : '💾 Guardar'}
          </button>
          <button type="button" onClick={handleToggle} disabled={isPending || (!ad.imagen_url && !preview && !ad.activo)}
            style={{
              border: '1px solid ' + (ad.activo ? '#EF4444' : '#10B981'),
              color: ad.activo ? '#EF4444' : '#10B981',
              background: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            {ad.activo ? '⏸ Pausar' : '▶ Activar'}
          </button>
          {msg && <span style={{ fontSize: 12, color: msg.startsWith('✅') ? '#065F46' : '#991B1B' }}>{msg}</span>}
        </div>
      </form>
    </div>
  );
}
