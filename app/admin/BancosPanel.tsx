'use client';

import { useRef, useState, useTransition } from 'react';
import { saveBanco, toggleBanco, reorderBanco, deleteBancoLogo, saveBancoParametro, addBanco } from './actions';

export type Banco = {
  id: string;
  slug: string;
  nombre: string;
  activo: boolean;
  orden: number;
  logo_url: string | null;
  color: string;
  iniciales: string;
  tasa_interes: number;
};

export type BancoParametro = { clave: string; categoria: string | null; valor: number; descripcion: string | null };

const FACTORES = [
  { key: 'peso_dti', cat: 'dti', label: 'Capacidad de endeudamiento (DTI)' },
  { key: 'peso_mora', cat: 'mora', label: 'Historial de pagos (mora)' },
  { key: 'peso_exp', cat: 'exp', label: 'Experiencia crediticia' },
  { key: 'peso_ltv', cat: 'ltv', label: 'Monto de inicial (LTV)' },
  { key: 'peso_ing', cat: 'ing', label: 'Nivel de ingresos' },
  { key: 'peso_est', cat: 'est', label: 'Estabilidad laboral' },
  { key: 'peso_pais', cat: 'pais', label: 'País de residencia' },
  { key: 'peso_act', cat: 'act', label: 'Ingresos adicionales' },
  { key: 'peso_edad', cat: 'edad', label: 'Edad del solicitante' },
];

export default function BancosPanel({
  bancos,
  paramsByBanco,
  pesosGlobales,
  subParamsGlobales,
  total,
}: {
  bancos: Banco[];
  paramsByBanco: Record<string, Record<string, BancoParametro>>;
  pesosGlobales: Record<string, number>;
  subParamsGlobales: Record<string, BancoParametro[]>;
  total: number;
}) {
  const sorted = [...bancos].sort((a, b) => a.orden - b.orden);

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
        Cuando hay 2 o más bancos activos, la pantalla de resultados del cliente muestra una tarjeta comparativa por cada uno,
        en vez de un solo puntaje general. Cada banco hereda los parámetros globales del motor (pesos y subparámetros) y solo
        necesita guardar los que quiera personalizar — el resto se toma automáticamente del valor global.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((b, idx) => (
          <BancoSlot
            key={b.id}
            banco={b}
            idx={idx}
            total={total}
            overrides={paramsByBanco[b.id] || {}}
            pesosGlobales={pesosGlobales}
            subParamsGlobales={subParamsGlobales}
          />
        ))}
      </div>
      <AddBancoRow />
    </div>
  );
}

function BancoSlot({
  banco, idx, total, overrides, pesosGlobales, subParamsGlobales,
}: {
  banco: Banco; idx: number; total: number;
  overrides: Record<string, BancoParametro>; pesosGlobales: Record<string, number>;
  subParamsGlobales: Record<string, BancoParametro[]>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', banco.id);
      fd.set('activo', String(!banco.activo));
      await toggleBanco(fd);
    });
  }

  function handleOrder(dir: 'up' | 'down') {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', banco.id);
      fd.set('direccion', dir);
      await reorderBanco(fd);
    });
  }

  const sumaPesos = FACTORES.reduce((sum, f) => sum + (overrides[f.key]?.valor ?? pesosGlobales[f.key] ?? 0), 0);
  const sumaOk = Math.round(sumaPesos) === 100;
  const personalizados = FACTORES.filter((f) => overrides[f.key] !== undefined).length;

  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: 16, background: banco.activo ? '#F0FDF4' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: banco.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800,
          flexShrink: 0, overflow: 'hidden',
        }}>
          {banco.logo_url ? <img src={banco.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} /> : banco.iniciales}
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{banco.nombre}</span>
        <span style={{
          fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
          background: banco.activo ? '#D1FAE5' : '#F3F4F6',
          color: banco.activo ? '#065F46' : '#6B7280',
          border: '1px solid ' + (banco.activo ? '#6EE7B7' : '#e5e5e5'),
        }}>
          {banco.activo ? 'Activo' : 'Inactivo'}
        </span>
        <button type="button" onClick={() => handleOrder('up')} disabled={idx === 0 || isPending}
          style={{ border: '1px solid #e5e5e5', borderRadius: 4, background: '#fff', width: 28, height: 28, cursor: 'pointer', fontSize: 12 }}>▲</button>
        <button type="button" onClick={() => handleOrder('down')} disabled={idx === total - 1 || isPending}
          style={{ border: '1px solid #e5e5e5', borderRadius: 4, background: '#fff', width: 28, height: 28, cursor: 'pointer', fontSize: 12 }}>▼</button>
        <button type="button" onClick={handleToggle} disabled={isPending}
          style={{
            border: '1px solid ' + (banco.activo ? '#EF4444' : '#10B981'),
            color: banco.activo ? '#EF4444' : '#10B981',
            background: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
          {banco.activo ? '⏸ Pausar' : '▶ Activar'}
        </button>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#C0161C', listStyle: 'none' }}>▸ Ver / editar esta entidad</summary>
        <div style={{ marginTop: 12 }}>
          <BancoBasicForm banco={banco} />

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#C0161C', listStyle: 'none' }}>
              ▸ Ver los 9 factores del motor para esta entidad {personalizados > 0 && <span style={{ color: '#6B7280', fontWeight: 400 }}>({personalizados} personalizados)</span>}
            </summary>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9,
              fontSize: 12, fontWeight: 600, margin: '10px 0 12px',
              background: sumaOk ? '#ECFDF5' : '#FEF2F2',
              border: '1px solid ' + (sumaOk ? '#6EE7B7' : '#FCA5A5'),
              color: sumaOk ? '#065F46' : '#991B1B',
            }}>
              Suma de pesos de los 9 factores
              <span style={{ padding: '2px 8px', borderRadius: 999, background: '#fff' }}>{Math.round(sumaPesos)} / 100</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {FACTORES.map((f) => (
                <BancoFactorBlock
                  key={f.key}
                  bancoId={banco.id}
                  label={f.label}
                  clave={f.key}
                  valor={overrides[f.key]?.valor ?? pesosGlobales[f.key] ?? 0}
                  esOverride={overrides[f.key] !== undefined}
                  globalValor={pesosGlobales[f.key] ?? 0}
                  subParams={subParamsGlobales[f.cat] || []}
                  overrides={overrides}
                />
              ))}
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}

function BancoBasicForm({ banco }: { banco: Banco }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const fd = new FormData(e.currentTarget);
    const res = await saveBanco(fd);
    setSaving(false);
    setMsg(res.ok ? '✅ Guardado' : '❌ ' + res.error);
    setTimeout(() => setMsg(''), 3000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPreview(URL.createObjectURL(f));
  }

  function handleDeleteLogo() {
    if (!confirm('¿Eliminar el logo de este banco?')) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', banco.id);
      await deleteBancoLogo(fd);
      setPreview(null);
    });
  }

  const imgSrc = preview || banco.logo_url;

  return (
    <form onSubmit={handleSave}>
      <input type="hidden" name="id" value={banco.id} />
      {imgSrc ? (
        <div style={{ position: 'relative', marginBottom: 10, display: 'inline-block' }}>
          <img src={imgSrc} alt="" style={{ width: 120, height: 64, objectFit: 'contain', borderRadius: 8, background: '#F9FAFB', border: '1px solid #eee' }} />
          <button type="button" onClick={handleDeleteLogo} disabled={isPending}
            style={{ position: 'absolute', top: -8, right: -8, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 11, cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <div onClick={() => fileRef.current?.click()}
          style={{ border: '2px dashed #d1d5db', borderRadius: 8, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 10, color: '#9CA3AF', fontSize: 11.5, textAlign: 'center', padding: 6 }}>
          📷 Clic para subir logo (200×200px, fondo transparente)
        </div>
      )}
      <input ref={fileRef} type="file" name="logo" accept="image/png,image/svg+xml,image/webp,image/jpeg"
        style={{ display: 'none' }} onChange={handleFileChange} />
      {imgSrc && (
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ display: 'block', fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', marginBottom: 10 }}>
          📷 Cambiar logo
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 9 }}>
        <div>
          <label style={{ fontSize: 11, color: '#777', display: 'block', marginBottom: 2 }}>Nombre</label>
          <input name="nombre" defaultValue={banco.nombre} style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6, padding: '6px 8px', fontSize: 12.5, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#777', display: 'block', marginBottom: 2 }}>Tasa de interés anual (%)</label>
          <input name="tasa_interes" type="number" step="0.01" defaultValue={banco.tasa_interes} style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6, padding: '6px 8px', fontSize: 12.5, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#777', display: 'block', marginBottom: 2 }}>Iniciales de respaldo (sin logo)</label>
          <input name="iniciales" maxLength={3} defaultValue={banco.iniciales} style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6, padding: '6px 8px', fontSize: 12.5, boxSizing: 'border-box', textTransform: 'uppercase' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#777', display: 'block', marginBottom: 2 }}>Color identificador</label>
          <input name="color" type="color" defaultValue={banco.color} style={{ width: '100%', border: '1px solid #ccc', borderRadius: 6, padding: '2px', height: 32, boxSizing: 'border-box' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button type="submit" disabled={saving}
          style={{ background: '#C0161C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? 'Guardando…' : '💾 Guardar'}
        </button>
        {msg && <span style={{ fontSize: 12, color: msg.startsWith('✅') ? '#065F46' : '#991B1B' }}>{msg}</span>}
      </div>
    </form>
  );
}

function BancoFactorBlock({
  bancoId, label, clave, valor, esOverride, globalValor, subParams, overrides,
}: {
  bancoId: string; label: string; clave: string; valor: number; esOverride: boolean; globalValor: number;
  subParams: BancoParametro[]; overrides: Record<string, BancoParametro>;
}) {
  const personalizados = subParams.filter((p) => overrides[p.clave] !== undefined).length;

  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 9, padding: '9px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>
          {label}
          {!esOverride && <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 6, fontSize: 11 }}>(usa el valor global: {globalValor}%)</span>}
        </div>
        <BancoParamRow bancoId={bancoId} clave={clave} categoria="pesos" valor={valor} unit="%" compact />
      </div>

      {subParams.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#C0161C', listStyle: 'none' }}>
            ▸ Ver / editar {subParams.length} subparámetros
            {personalizados > 0 && <span style={{ color: '#6B7280', fontWeight: 400 }}> ({personalizados} personalizados)</span>}
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, marginTop: 9 }}>
            {subParams.map((p) => (
              <div key={p.clave} style={{ border: '1px solid #eee', borderRadius: 8, padding: '8px 10px' }}>
                <label style={{ fontSize: 10.5, color: '#777', display: 'block', marginBottom: 4, lineHeight: 1.3 }}>
                  {p.descripcion || p.clave}
                  {overrides[p.clave] === undefined && <span style={{ color: '#B0B7C0' }}> (global: {p.valor})</span>}
                </label>
                <BancoParamRow
                  bancoId={bancoId}
                  clave={p.clave}
                  categoria={p.categoria || ''}
                  valor={overrides[p.clave]?.valor ?? p.valor}
                />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BancoParamRow({
  bancoId, clave, categoria, valor, unit, compact,
}: {
  bancoId: string; clave: string; categoria: string; valor: number; unit?: string; compact?: boolean;
}) {
  const [value, setValue] = useState(valor);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSave() {
    const password = window.prompt('Confirma la contraseña de administrador para guardar este cambio:');
    if (password == null) return;
    setSaving(true);
    setMsg('');
    const fd = new FormData();
    fd.set('banco_id', bancoId);
    fd.set('clave', clave);
    fd.set('categoria', categoria);
    fd.set('valor', String(value));
    fd.set('adminPassword', password);
    const res = await saveBancoParametro(fd);
    setSaving(false);
    setMsg(res.ok ? 'Guardado ✓' : res.error || 'Error');
    if (res.ok) setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div style={{ display: compact ? 'contents' : 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="number" step="any" value={value} onChange={(e) => setValue(Number(e.target.value))}
          style={{ width: compact ? 60 : '100%', flex: compact ? undefined : 1, border: '1px solid #ccc', borderRadius: 6, padding: '5px 6px', fontSize: 12 }} />
        {unit && <span style={{ fontSize: 11, color: '#888' }}>{unit}</span>}
        <button type="button" disabled={saving} onClick={handleSave}
          style={{ background: '#C0161C', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? '…' : 'Guardar'}
        </button>
      </div>
      {msg && <div><span style={{ fontSize: 11, color: msg.startsWith('Guardado') ? '#166534' : '#991B1B' }}>{msg}</span></div>}
    </div>
  );
}

function AddBancoRow() {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleAdd() {
    if (!nombre.trim()) return;
    setSaving(true);
    setMsg('');
    const fd = new FormData();
    fd.set('nombre', nombre);
    const res = await addBanco(fd);
    setSaving(false);
    if (res.ok) {
      setNombre('');
      setOpen(false);
    } else {
      setMsg(res.error || 'Error al agregar');
    }
  }

  if (!open) {
    return (
      <div onClick={() => setOpen(true)}
        style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: 18, textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 4, cursor: 'pointer' }}>
        ＋ Agregar nueva entidad bancaria
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: 16, marginTop: 4 }}>
      <label style={{ fontSize: 11, color: '#777', display: 'block', marginBottom: 4 }}>Nombre del banco</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Scotiabank"
          style={{ flex: 1, border: '1px solid #ccc', borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
        <button type="button" onClick={handleAdd} disabled={saving || !nombre.trim()}
          style={{ background: '#C0161C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? 'Agregando…' : 'Agregar'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setMsg(''); }}
          style={{ background: 'none', border: '1px solid #e5e5e5', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Se crea inactivo — actívalo cuando termines de configurar su logo, tasa y factores.</p>
      {msg && <span style={{ fontSize: 12, color: '#991B1B' }}>{msg}</span>}
    </div>
  );
}
