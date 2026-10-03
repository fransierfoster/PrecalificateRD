'use client';

import { useEffect, useRef, useState } from 'react';

type Moneda = 'DOP' | 'USD';

interface Opcion {
  pct: number;
  inicial: number;
  financiar: number;
  cuota: number;
  ingresoMin: number | null;
  ingresoMax: number | null;
  ingresoMinUsd: number | null;
  ingresoMaxUsd: number | null;
}

type Interes = 'asesoria' | 'ofertas';

type Estado =
  | { s: 'idle' }
  | { s: 'cargando' }
  | { s: 'ok'; moneda: Moneda; valor: number; opciones: Opcion[] }
  | { s: 'error'; msg: string; limite?: boolean };

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function esTest() {
  try { return new URLSearchParams(window.location.search).get('test') === '1'; } catch { return false; }
}

function leerFuente(): string {
  try {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get('utm') || q.get('utm_source') || '';
    return raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  } catch { return ''; }
}

function track(evento: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || esTest()) return;
    let sid = sessionStorage.getItem('precal_sid');
    if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('precal_sid', sid); }
    fetch(url + '/rest/v1/precalifica_eventos', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ session_id: sid, evento }),
    }).catch(() => {});
  } catch {}
}

function irAlFormulario() {
  window.location.href = esTest() ? '/?test=1' : '/';
}

export default function CalculadoraClient() {
  const [moneda, setMoneda] = useState<Moneda>('DOP');
  const [valorTxt, setValorTxt] = useState('');
  const [estado, setEstado] = useState<Estado>({ s: 'idle' });
  const [pctSel, setPctSel] = useState(80);
  const [interes, setInteres] = useState<Interes>('asesoria');
  const [paso, setPaso] = useState<'resultados' | 'contacto' | 'enviado'>('resultados');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errForm, setErrForm] = useState('');
  const seq = useRef(0);

  const valor = Number(valorTxt.replace(/[^\d]/g, '')) || 0;
  const simbolo = moneda === 'USD' ? 'US$' : 'RD$';

  const resRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track('calc_visita');
  }, []);

  useEffect(() => {
    if (estado.s !== 'ok') return;
    const t = setTimeout(() => resRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [estado.s]);

  useEffect(() => {
    seq.current++;
    setEstado({ s: 'idle' });
  }, [valor, moneda]);

  async function calcular() {
    if (!valor || estado.s === 'cargando') return;
    track('calc_calcular');
    setEstado({ s: 'cargando' });
    const mi = ++seq.current;
    try {
      const res = await fetch('/api/calculadora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor, moneda }),
      });
      const data = await res.json();
      if (mi !== seq.current) return;
      if (res.ok && data.ok) {
        setEstado({ s: 'ok', moneda: data.moneda, valor: data.valor, opciones: data.opciones });
      } else if (data.error === 'min') {
        const sym = moneda === 'USD' ? 'US$' : 'RD$';
        setEstado({ s: 'error', msg: `El precio mínimo de una vivienda para financiamiento hipotecario ronda los ${sym} ${fmt(data.minimo)}.` });
      } else if (res.status === 429) {
        setEstado({ s: 'error', limite: true, msg: 'Alcanzaste el límite de consultas por ahora. Para seguir, calcula tu probabilidad real completando tu precalificación gratis.' });
      } else {
        setEstado({ s: 'error', msg: 'No pudimos calcular con ese valor. Revisa la cifra e intenta de nuevo.' });
      }
    } catch {
      if (mi === seq.current) setEstado({ s: 'error', msg: 'Error de conexión. Intenta nuevamente.' });
    }
  }

  function onValor(v: string) {
    const digits = v.replace(/[^\d]/g, '');
    setValorTxt(digits ? Number(digits).toLocaleString('en-US') : '');
  }

  function irAContacto() {
    track('calc_continuar');
    setErrForm('');
    setPaso('contacto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function enviarLead() {
    if (enviando) return;
    const digitos = tel.replace(/\D/g, '');
    if (!nombre.trim() || !apellido.trim()) { setErrForm('Escribe tu nombre y apellido.'); return; }
    if (digitos.length < 10) { setErrForm('Escribe tu número de WhatsApp completo (10 dígitos).'); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErrForm('El correo no parece válido. Puedes dejarlo vacío.'); return; }
    if (!consent) { setErrForm('Debes autorizar el uso de tus datos para que un asesor te contacte.'); return; }
    setErrForm('');
    setEnviando(true);
    try {
      if (!esTest()) {
        let sessionId = '';
        try { sessionId = localStorage.getItem('precalRD_session') || ''; } catch {}
        const res = await fetch('/api/calculadora/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre, apellido, tel, email,
            valor: estado.s === 'ok' ? estado.valor : valor,
            moneda: estado.s === 'ok' ? estado.moneda : moneda,
            pct: estado.s === 'ok' ? pctSel : null,
            fuente: leerFuente(),
            sessionId,
            consentimiento: consent,
          }),
        });
        if (!res.ok) {
          setErrForm(res.status === 429
            ? 'Ya enviaste varias solicitudes. Un asesor te contactará pronto.'
            : 'No pudimos enviar tu solicitud. Revisa tus datos e intenta de nuevo.');
          setEnviando(false);
          return;
        }
        track('calc_lead_propiedades');
      }
      setPaso('enviado');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrForm('Error de conexión. Intenta nuevamente.');
    }
    setEnviando(false);
  }

  function continuarSinCalculo() {
    if (interes === 'ofertas' && valor) { irAContacto(); return; }
    try {
      const raw = localStorage.getItem('precalRD_form');
      const prev = raw ? JSON.parse(raw) : {};
      if (valor) localStorage.setItem('precalRD_form', JSON.stringify({ ...prev, mprecio: moneda, vinm: fmt(valor) }));
      localStorage.setItem('precalRD_calc', JSON.stringify({ interes, pct: null, fuente: leerFuente(), ts: Date.now() }));
    } catch {}
    track('calc_continuar');
    irAlFormulario();
  }

  function continuar() {
    if (estado.s !== 'ok') return;
    if (interes === 'ofertas') { irAContacto(); return; }
    const op = estado.opciones.find((o) => o.pct === pctSel) || estado.opciones[0];
    try {
      const raw = localStorage.getItem('precalRD_form');
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem('precalRD_form', JSON.stringify({
        ...prev,
        mprecio: estado.moneda,
        vinm: fmt(estado.valor),
        ini: fmt(op.inicial),
      }));
      localStorage.setItem('precalRD_calc', JSON.stringify({ interes, pct: op.pct, fuente: leerFuente(), ts: Date.now() }));
    } catch {}
    track('calc_continuar');
    irAlFormulario();
  }

  const sel = estado.s === 'ok' ? (estado.opciones.find((o) => o.pct === pctSel) || estado.opciones[0]) : null;
  const symRes = estado.s === 'ok' && estado.moneda === 'USD' ? 'US$' : 'RD$';

  return (
    <div style={{ minHeight: '100vh', background: '#F8F5F2', fontFamily: "'Inter', system-ui, sans-serif", color: '#0D0D0D' }}>
      <style>{`
        .calc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .calc-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        @media (max-width:720px){.calc-grid,.calc-opts{grid-template-columns:1fr;gap:10px}}
        .calc-card{position:relative;background:#fff;border:1.5px solid #E5E2DF;border-radius:14px;padding:14px 16px;text-align:left;cursor:pointer;font-family:inherit;color:inherit;width:100%;transition:border-color .15s,box-shadow .15s}
        .calc-card.sel{border-color:#C0161C;box-shadow:0 0 0 3px rgba(192,22,28,.10)}
        .calc-radio{width:20px;height:20px;border-radius:50%;border:2px solid #C9C5C0;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:#fff}
        .calc-card.sel .calc-radio{border-color:#C0161C}
        .calc-card.sel .calc-radio::after{content:'';width:10px;height:10px;border-radius:50%;background:#C0161C}
        .calc-row{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:#6B7280;padding:2px 0}
        .calc-row b{color:#0D0D0D;font-weight:600;text-align:right}
        .calc-bar{position:fixed;left:0;right:0;bottom:0;z-index:20;background:#fff;border-top:1px solid #E5E2DF;box-shadow:0 -4px 18px rgba(0,0,0,.08);padding:10px 16px calc(10px + env(safe-area-inset-bottom))}
        .calc-bar-in{max-width:940px;margin:0 auto;display:flex;gap:14px;align-items:center}
        .calc-bar-txt{flex:1;min-width:0;font-size:12.5px;line-height:1.45;color:#6B7280}
        .calc-bar-txt b{color:#0D0D0D}
        .calc-bar-btn{flex-shrink:0;padding:13px 20px;background:#C0161C;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
        @media (max-width:720px){.calc-bar{padding:8px 16px calc(8px + env(safe-area-inset-bottom))}.calc-bar-in{flex-direction:column;align-items:stretch;gap:6px}.calc-bar-btn{width:100%;padding:12px 16px}.calc-bar-sub{display:none}.calc-card{padding:12px 14px}}
      `}</style>

      <header>
        <a className="logo logo-full" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="PrecalificateRD" />
        </a>
      </header>

      <main style={{ maxWidth: 940, margin: '0 auto', padding: `24px 16px ${estado.s === 'ok' && paso === 'resultados' ? 150 : 48}px` }}>
        <div style={{ display: paso === 'resultados' ? 'block' : 'none' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px', lineHeight: 1.25 }}>¿Cuánto necesito ganar para comprar?</h1>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55, margin: '0 0 18px' }}>
          Escribe el valor de la vivienda y te mostramos el ingreso mensual aproximado que necesitarías según cuánto quieras financiar.
        </p>

        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 16px 18px', boxShadow: '0 2px 20px rgba(0,0,0,.07)', marginBottom: 14 }}>
          <label htmlFor="valor" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Valor de la vivienda
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', border: '1.5px solid #E5E2DF', borderRadius: 10, background: '#F9F8F7', padding: '0 12px' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#6B7280', marginRight: 8 }}>{simbolo}</span>
              <input
                id="valor"
                inputMode="numeric"
                autoComplete="off"
                value={valorTxt}
                onChange={(e) => onValor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') calcular(); }}
                placeholder="6,500,000"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 18, fontWeight: 600, padding: '13px 0', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', border: '1.5px solid #E5E2DF', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              {(['DOP', 'USD'] as Moneda[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoneda(m)}
                  aria-pressed={moneda === m}
                  style={{
                    padding: '0 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                    background: moneda === m ? '#0D0D0D' : '#fff', color: moneda === m ? '#fff' : '#6B7280',
                  }}
                >
                  {m === 'DOP' ? 'RD$' : 'US$'}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={calcular}
            disabled={!valor || estado.s === 'cargando'}
            style={{ width: '100%', marginTop: 12, padding: '14px 18px', background: !valor ? '#D1D5DB' : '#0D0D0D', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: !valor ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {estado.s === 'cargando' ? 'Calculando…' : 'Calcular'}
          </button>
        </div>

        {estado.s === 'error' && (
          <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 12, padding: '12px 16px', fontSize: 13, marginBottom: 18 }}>
            {estado.msg}
            {estado.limite && (
              <button
                type="button"
                onClick={continuarSinCalculo}
                style={{ display: 'block', width: '100%', marginTop: 12, padding: '12px 16px', background: '#C0161C', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Calcular mi probabilidad real
              </button>
            )}
          </div>
        )}

        {estado.s === 'ok' && (
          <div ref={resRef} style={{ scrollMarginTop: 78 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '4px 0 10px', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              1. Elige cuánto quieres financiar
            </div>
            <div className="calc-grid" style={{ marginBottom: 10 }}>
              {estado.opciones.map((o) => {
                const sym = estado.moneda === 'USD' ? 'US$' : 'RD$';
                return (
                  <button
                    key={o.pct}
                    type="button"
                    className={`calc-card${o.pct === pctSel ? ' sel' : ''}`}
                    onClick={() => setPctSel(o.pct)}
                    aria-pressed={o.pct === pctSel}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 10 }}>
                      <span className="calc-radio" aria-hidden="true" />
                      <span style={{ fontSize: 15, fontWeight: 700 }}>Financiar {o.pct}%</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>· {sym} {fmt(o.financiar)}</span>
                    </div>
                    {o.pct === 80 && (
                      <span style={{ position: 'absolute', top: -10, right: 14, fontSize: 11, fontWeight: 700, background: '#C0161C', color: '#fff', padding: '2px 9px', borderRadius: 20 }}>Más común</span>
                    )}
                    {o.ingresoMin == null || o.ingresoMinUsd == null ? (
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1D3A8A' }}>Lo evalúa un asesor contigo</div>
                    ) : o.ingresoMax == null || o.ingresoMaxUsd == null ? (
                      <>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#1D3A8A', letterSpacing: '-0.3px' }}>Desde RD$ {fmt(o.ingresoMin)}</div>
                        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 1 }}>de ingreso al mes · ≈ desde US$ {fmt(o.ingresoMinUsd)}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#1D3A8A', letterSpacing: '-0.3px' }}>RD$ {fmt(o.ingresoMin)} – {fmt(o.ingresoMax)}</div>
                        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 1 }}>de ingreso al mes · ≈ US$ {fmt(o.ingresoMinUsd)} – {fmt(o.ingresoMaxUsd)}</div>
                      </>
                    )}
                    <div style={{ borderTop: '1px solid #EFECE9', marginTop: 8, paddingTop: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 10px', fontSize: 12.5, color: '#6B7280' }}>
                      <span>Inicial ({100 - o.pct}%) <b style={{ color: '#0D0D0D' }}>{sym} {fmt(o.inicial)}</b></span>
                      <span>Cuota <b style={{ color: '#0D0D0D' }}>{sym} {fmt(o.cuota)}</b></span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '16px 0 8px', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              2. ¿Qué te gustaría recibir?
            </div>
            <div className="calc-opts">
              <button
                type="button"
                className={`calc-card${interes === 'asesoria' ? ' sel' : ''}`}
                onClick={() => setInteres('asesoria')}
                aria-pressed={interes === 'asesoria'}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
              >
                <span className="calc-radio" aria-hidden="true" style={{ marginTop: 2 }} />
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Asesoría y cálculo de intereses</span>
                  <span style={{ display: 'block', fontSize: 13, color: '#6B7280', marginTop: 2, lineHeight: 1.45 }}>Un asesor revisa tu caso con cifras reales de los bancos.</span>
                </span>
              </button>
              <button
                type="button"
                className={`calc-card${interes === 'ofertas' ? ' sel' : ''}`}
                onClick={() => setInteres('ofertas')}
                aria-pressed={interes === 'ofertas'}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
              >
                <span className="calc-radio" aria-hidden="true" style={{ marginTop: 2 }} />
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Opciones de propiedades en este rango</span>
                  <span style={{ display: 'block', fontSize: 13, color: '#6B7280', marginTop: 2, lineHeight: 1.45 }}>Un asesor te contacta con propiedades en tu rango cuando haya disponibles.</span>
                </span>
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.55, margin: '16px 0 0' }}>
              Rango orientativo: va desde un perfil crediticio sólido hasta uno exigente. No es una aprobación ni una oferta de una entidad financiera. La precalificación es gratis y no afecta tu historial crediticio.
            </p>
          </div>
        )}
        </div>

        {paso === 'contacto' && (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <button
              type="button"
              onClick={() => setPaso('resultados')}
              style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 14, fontFamily: 'inherit' }}
            >
              ← Volver a los resultados
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px', lineHeight: 1.25 }}>Recibe opciones de propiedades en tu rango</h1>
            <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55, margin: '0 0 14px' }}>
              Déjanos tus datos y un asesor te contactará por WhatsApp. No necesitamos tu cédula.
            </p>

            <div style={{ background: '#fff', border: '1px solid #E5E2DF', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 14 }}>
              Vivienda de interés: <b>{symRes} {fmt(estado.s === 'ok' ? estado.valor : valor)}</b>
              {sel && (
                <>
                  {' '}· financiando <b>{sel.pct}%</b>
                  {sel.ingresoMin != null && (
                    <> · ingreso aprox. <b>RD$ {fmt(sel.ingresoMin)}{sel.ingresoMax != null ? ` – ${fmt(sel.ingresoMax)}` : '+'}</b></>
                  )}
                </>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); enviarLead(); }}
              noValidate
              style={{ background: '#fff', borderRadius: 16, padding: '18px 16px', boxShadow: '0 2px 20px rgba(0,0,0,.07)', display: 'grid', gap: 12 }}
            >
              {([
                ['Nombre', nombre, setNombre, 'given-name', 'text', 'Ej: María', 'text'],
                ['Apellido', apellido, setApellido, 'family-name', 'text', 'Ej: Pérez', 'text'],
                ['WhatsApp', tel, setTel, 'tel', 'tel', 'Ej: 809 555 1234', 'tel'],
                ['Correo (opcional)', email, setEmail, 'email', 'email', 'Ej: maria@correo.com', 'email'],
              ] as const).map(([label, val, set, ac, type, ph, mode]) => (
                <label key={label} style={{ display: 'block' }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, letterSpacing: '.03em' }}>{label}</span>
                  <input
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    autoComplete={ac}
                    type={type}
                    inputMode={mode === 'tel' ? 'tel' : mode === 'email' ? 'email' : 'text'}
                    placeholder={ph}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E5E2DF', borderRadius: 10, background: '#F9F8F7', padding: '12px 12px', fontSize: 16, fontFamily: 'inherit', outline: 'none' }}
                  />
                </label>
              ))}

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ width: 20, height: 20, marginTop: 1, accentColor: '#C0161C', flexShrink: 0 }}
                />
                <span style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.5 }}>
                  Autorizo el tratamiento de mis datos para contacto por parte de Perfect House SRL y entidades financieras aliadas. Perfect House SRL no es una entidad financiera regulada y esto no es una oferta ni aprobación de crédito.
                </span>
              </label>

              {errForm && (
                <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                  {errForm}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando}
                style={{ width: '100%', padding: '14px 18px', background: '#C0161C', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit', opacity: enviando ? 0.7 : 1 }}
              >
                {enviando ? 'Enviando…' : 'Quiero recibir opciones de propiedades'}
              </button>
            </form>
          </div>
        )}

        {paso === 'enviado' && (
          <div style={{ maxWidth: 520, margin: '40px auto 0', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.25 }}>¡Solicitud enviada!</h1>
            <p style={{ fontSize: 14.5, color: '#6B7280', lineHeight: 1.6, margin: '0 0 20px' }}>
              Un asesor de <b style={{ color: '#C0161C' }}>Perfect House</b> se comunicará contigo por WhatsApp con opciones de propiedades dentro de tu rango.
            </p>
            {esTest() && (
              <p style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 10px', margin: '0 0 16px' }}>
                Modo prueba: esta solicitud no se guardó.
              </p>
            )}
            <button
              type="button"
              onClick={() => { setPaso('resultados'); setEstado({ s: 'idle' }); setValorTxt(''); setNombre(''); setApellido(''); setTel(''); setEmail(''); setConsent(false); }}
              style={{ padding: '12px 22px', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Calcular otro valor
            </button>
          </div>
        )}
      </main>

      {estado.s === 'ok' && sel && paso === 'resultados' && (
        <div className="calc-bar">
          <div className="calc-bar-in">
            <div className="calc-bar-txt">
              <b>Financiando {sel.pct}%</b> · inicial {symRes} {fmt(sel.inicial)}
              <span className="calc-bar-sub"><br />
                {interes === 'ofertas'
                  ? 'Recibir opciones de propiedades es gratis y sin compromiso.'
                  : 'Tu precalificación es gratis y no afecta tu historial crediticio.'}
              </span>
            </div>
            <button type="button" className="calc-bar-btn" onClick={continuar}>
              {interes === 'ofertas' ? 'Recibir opciones de propiedades gratis' : 'Continuar con mi precalificación gratis'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
