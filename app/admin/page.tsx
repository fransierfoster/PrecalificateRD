import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';
import LeadsTable, { type Lead } from './LeadsTable';
import CalculosTable, { type Calculo } from './CalculosTable';
import ParamForm from './ParamForm';
import ToggleParamForm from './ToggleParamForm';
import AnunciosPanel, { type Anuncio } from './AnuncioForm';
import BancosPanel, { type Banco, type BancoParametro } from './BancosPanel';
import './admin.css';

// Multi-banco: visible en local y en vistas previas de Vercel, nunca en
// producción — ver la nota en app/api/calcular/route.ts.
const PREVIEW_MULTIBANCO = process.env.VERCEL_ENV !== 'production';

type Parametro = {
  clave: string;
  valor: number;
  categoria: string | null;
  descripcion: string | null;
};

const FACTOR_DEFS = [
  { key: 'dti', pesoClave: 'peso_dti', label: 'Capacidad de endeudamiento (relación cuota/ingreso)' },
  { key: 'mora', pesoClave: 'peso_mora', label: 'Historial de pagos (mora)' },
  { key: 'exp', pesoClave: 'peso_exp', label: 'Experiencia crediticia' },
  { key: 'ltv', pesoClave: 'peso_ltv', label: 'Monto de inicial (porcentaje financiado del inmueble)' },
  { key: 'ing', pesoClave: 'peso_ing', label: 'Nivel de ingresos' },
  { key: 'est', pesoClave: 'peso_est', label: 'Estabilidad laboral' },
  { key: 'pais', pesoClave: 'peso_pais', label: 'País de residencia' },
  { key: 'act', pesoClave: 'peso_act', label: 'Ingresos adicionales' },
  { key: 'edad', pesoClave: 'peso_edad', label: 'Edad del solicitante' },
];

const THRESHOLDS = [
  { label: '≥ 70%', min: 70 },
  { label: '≥ 80%', min: 80 },
  { label: '≥ 90%', min: 90 },
];

function countAbove(scores: (number | null | undefined)[], min: number) {
  return scores.filter((s) => s != null && (s as number) >= min).length;
}

function ScoreHistogram({ title, e1Scores, e2Scores }: { title: string; e1Scores: (number | null | undefined)[]; e2Scores: (number | null | undefined)[] }) {
  const rows = THRESHOLDS.map((t) => ({
    label: t.label,
    e1: countAbove(e1Scores, t.min),
    e2: countAbove(e2Scores, t.min),
  }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.e1, r.e2]));
  const totalE1 = e1Scores.filter((s) => s != null).length;
  return (
    <div className="adm-hist">
      <h3>{title} ({totalE1})</h3>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, fontSize: 11, color: '#6B7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#C0161C', display: 'inline-block' }} /> E1 — propiedad solicitada</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#0F766E', display: 'inline-block' }} /> E2 — mejor opción</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>{r.label}</div>
          <div className="adm-hist-row">
            <div className="adm-hist-label" style={{ fontSize: 11, color: '#9CA3AF' }}>E1</div>
            <div className="adm-hist-bar-wrap">
              <div className="adm-hist-bar" style={{ width: `${(r.e1 / max) * 100}%`, background: '#C0161C' }} />
            </div>
            <div className="adm-hist-count">{r.e1}</div>
          </div>
          <div className="adm-hist-row">
            <div className="adm-hist-label" style={{ fontSize: 11, color: '#9CA3AF' }}>E2</div>
            <div className="adm-hist-bar-wrap">
              <div className="adm-hist-bar" style={{ width: `${(r.e2 / max) * 100}%`, background: '#0F766E' }} />
            </div>
            <div className="adm-hist-count">{r.e2}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FactorCard({
  label,
  peso,
  subParams,
}: {
  label: string;
  peso: Parametro | undefined;
  subParams: Parametro[];
}) {
  return (
    <div className="adm-factor">
      <div className="adm-factor-head">
        <div className="adm-factor-title">{label}</div>
        {peso ? (
          <div className="adm-factor-peso">
            <ParamForm clave={peso.clave} valor={peso.valor} descripcion={peso.descripcion} compact />
          </div>
        ) : null}
      </div>
      {subParams.length > 0 && (
        <details className="adm-factor-details">
          <summary>Ver / editar {subParams.length} subparámetros</summary>
          <div className="adm-params-grid">
            {subParams.map((p) => (
              <ParamForm key={p.clave} clave={p.clave} valor={p.valor} descripcion={p.descripcion} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect('/admin/login');

  const { data: admin } = await supabase
    .from('admins')
    .select('email')
    .eq('email', userData.user.email)
    .maybeSingle();

  if (!admin) redirect('/admin/login');

  const { data: parametros } = await supabase
    .from('precalifica_parametros')
    .select('clave, valor, categoria, descripcion')
    .order('categoria')
    .order('clave')
    .returns<Parametro[]>();

  const { data: leads } = await supabase
    .from('precalifica_leads')
    .select('*, precalifica_calculos(*)')
    .order('created_at', { ascending: false })
    .returns<Lead[]>();

  const { data: calculos } = await supabase
    .from('precalifica_calculos')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<Calculo[]>();

  const calculosE1 = (calculos || []).map((c) => c.score_e1);
  const calculosE2 = (calculos || []).map((c) => c.score_e2);
  const leadsE1 = (leads || []).map((l) => l.precalifica_calculos?.score_e1);
  const leadsE2 = (leads || []).map((l) => l.precalifica_calculos?.score_e2);
  const pdfDownloadsCount = (leads || []).filter((l) => l.tipo === 'pdf').length;

  const groups: Record<string, Parametro[]> = {};
  (parametros || []).forEach((p) => {
    const cat = p.categoria || 'otros';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });

  const pesosByClave: Record<string, Parametro> = {};
  (groups.pesos || []).forEach((p) => { pesosByClave[p.clave] = p; });

  const sumaPesos = (groups.pesos || []).reduce((sum, p) => sum + (Number(p.valor) || 0), 0);
  const sumaOk = Math.round(sumaPesos) === 100;

  const finParams = groups.fin || [];
  const uiParams = groups.ui || [];
  const factorKeys = new Set(FACTOR_DEFS.map((f) => f.key));
  const otrosCats = Object.keys(groups).filter((c) => c !== 'pesos' && c !== 'fin' && c !== 'ui' && !factorKeys.has(c));

  const uiPopup = uiParams.find((p) => p.clave === 'ui_popup_activo');
  const uiContador = uiParams.find((p) => p.clave === 'ui_contador_visible');
  const uiPopupSoloE2 = uiParams.find((p) => p.clave === 'ui_popup_solo_e2');

  const { data: anuncios } = await supabase
    .from('precalifica_anuncios')
    .select('*')
    .order('orden')
    .returns<Anuncio[]>();

  let bancos: Banco[] = [];
  const paramsByBanco: Record<string, Record<string, BancoParametro>> = {};
  if (PREVIEW_MULTIBANCO) {
    const { data: bancosData } = await supabase
      .from('precalifica_bancos')
      .select('*')
      .order('orden')
      .returns<Banco[]>();
    bancos = bancosData || [];

    if (bancos.length > 0) {
      const { data: bancoParams } = await supabase
        .from('precalifica_bancos_parametros')
        .select('banco_id, clave, categoria, valor, descripcion')
        .in('banco_id', bancos.map((b) => b.id))
        .returns<(BancoParametro & { banco_id: string })[]>();

      (bancoParams || []).forEach((p) => {
        if (!paramsByBanco[p.banco_id]) paramsByBanco[p.banco_id] = {};
        paramsByBanco[p.banco_id][p.clave] = p;
      });
    }
  }

  type FunnelRow = { evento: string; total: number };
  const { data: eventosFunnel } = await supabase
    .rpc('contar_eventos_funnel') as { data: FunnelRow[] | null };

  const funnelMap: Record<string, number> = {};
  (eventosFunnel || []).forEach((r: FunnelRow) => { funnelMap[r.evento] = Number(r.total); });

  const funnelSteps = [
    { key: 'click_asesoria',    label: 'Quiero asesoría / ofertas',              color: '#C0161C' },
    { key: 'click_pdf',         label: 'Descargar Precalificación',               color: '#C0161C' },
    { key: 'click_popup_cta',   label: 'Popup — Quiero iniciar el proceso',       color: '#C0161C' },
    { key: 'click_anuncio_cta', label: 'Anuncio — Quiero información del proyecto', color: '#0F766E' },
    { key: 'form_submit',       label: 'Formulario completado',                   color: '#065F46' },
  ];
  const allSteps = funnelSteps;
  const maxFunnel = Math.max(1, ...allSteps.map((s) => funnelMap[s.key] || 0));

  return (
    <div className="adm-page">
      <div className="adm-header">
        <h1>PrecalificateRD — Admin</h1>
        <form action={signOut}>
          <button type="submit" className="adm-logout">Cerrar sesión</button>
        </form>
      </div>

      <div className="adm-card">
        <h2>Resumen</h2>
        <div className="adm-hist-grid">
          <ScoreHistogram title="Cálculos por probabilidad" e1Scores={calculosE1} e2Scores={calculosE2} />
          <ScoreHistogram title="Leads por probabilidad" e1Scores={leadsE1} e2Scores={leadsE2} />
        </div>
      </div>

      <div className="adm-card">
        <h2>Clics hacia el formulario</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allSteps.map((step, i) => {
            const count = funnelMap[step.key] || 0;
            const pct = Math.round((count / maxFunnel) * 100);
            const isLast = i === allSteps.length - 1;
            return (
              <div key={step.key}>
                {isLast && <div style={{ borderTop: '1px solid #E5E7EB', margin: '6px 0' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 240, fontSize: 13, color: '#374151', flexShrink: 0 }}>{step.label}</div>
                  <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: step.color, transition: 'width .3s' }} />
                  </div>
                  <div style={{ width: 36, textAlign: 'right', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111' }}>{count}</div>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 240, fontSize: 12, color: '#9CA3AF', flexShrink: 0, paddingLeft: 14 }}>↳ de esas, para descargar el reporte PDF</div>
            <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 4, height: 14, overflow: 'hidden' }}>
              <div style={{ width: Math.round((pdfDownloadsCount / maxFunnel) * 100) + '%', height: '100%', background: '#9CA3AF', transition: 'width .3s' }} />
            </div>
            <div style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{pdfDownloadsCount}</div>
          </div>
        </div>
      </div>

      <div className="adm-card">
        <details className="adm-section-details">
          <summary><h2 style={{ display: 'inline' }}>Anuncios de proyectos {(anuncios || []).some(a => a.activo) ? <span style={{ fontSize: 12, fontWeight: 400, color: '#065F46', background: '#D1FAE5', padding: '2px 8px', borderRadius: 10, marginLeft: 8 }}>Activo</span> : ''}</h2></summary>
          <div style={{ marginTop: 14 }}>
            <AnunciosPanel anuncios={anuncios || []} total={(anuncios || []).length} />
          </div>
        </details>
      </div>

      {PREVIEW_MULTIBANCO && (
        <div className="adm-card">
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 12.5, color: '#92400E' }}>
            🚧 En construcción — esta sección solo es visible en vistas previas y en local, nunca en precalificaterd.com.
          </div>
          <details className="adm-section-details">
            <summary><h2 style={{ display: 'inline' }}>Entidades bancarias {bancos.some((b) => b.activo) ? <span style={{ fontSize: 12, fontWeight: 400, color: '#065F46', background: '#D1FAE5', padding: '2px 8px', borderRadius: 10, marginLeft: 8 }}>{bancos.filter((b) => b.activo).length} activa{bancos.filter((b) => b.activo).length === 1 ? '' : 's'}</span> : ''}</h2></summary>
            <div style={{ marginTop: 14 }}>
              {uiParams.find((p) => p.clave === 'ui_multibanco_activo') && (
                <div style={{ marginBottom: 16 }}>
                  <ToggleParamForm
                    clave="ui_multibanco_activo"
                    valor={uiParams.find((p) => p.clave === 'ui_multibanco_activo')!.valor}
                    label="Modo comparación multi-banco"
                    description="Si está apagado, el cliente ve un solo resultado general (comportamiento actual). Solo aplica en vistas previas / local mientras el feature esté en construcción."
                  />
                </div>
              )}
              <BancosPanel
                bancos={bancos}
                paramsByBanco={paramsByBanco}
                pesosGlobales={{
                  peso_dti: pesosByClave.peso_dti?.valor ?? 0,
                  peso_mora: pesosByClave.peso_mora?.valor ?? 0,
                  peso_exp: pesosByClave.peso_exp?.valor ?? 0,
                  peso_ltv: pesosByClave.peso_ltv?.valor ?? 0,
                  peso_ing: pesosByClave.peso_ing?.valor ?? 0,
                  peso_est: pesosByClave.peso_est?.valor ?? 0,
                  peso_pais: pesosByClave.peso_pais?.valor ?? 0,
                  peso_act: pesosByClave.peso_act?.valor ?? 0,
                  peso_edad: pesosByClave.peso_edad?.valor ?? 0,
                }}
                subParamsGlobales={{
                  dti: groups.dti || [],
                  mora: groups.mora || [],
                  exp: groups.exp || [],
                  ltv: groups.ltv || [],
                  ing: groups.ing || [],
                  est: groups.est || [],
                  pais: groups.pais || [],
                  act: groups.act || [],
                  edad: groups.edad || [],
                }}
                total={bancos.length}
              />
            </div>
          </details>
        </div>
      )}

      <div className="adm-card">
        <h2>Configuración de la interfaz</h2>
        <div className="adm-toggle-list">
          {uiPopup && (
            <ToggleParamForm
              clave={uiPopup.clave}
              valor={uiPopup.valor}
              label="Popup de captación de leads"
              description="Ventana flotante que aparece 2.5s después del resultado cuando el score ≥ 70%"
            />
          )}
          {uiPopupSoloE2 && (
            <ToggleParamForm
              clave={uiPopupSoloE2.clave}
              valor={uiPopupSoloE2.valor}
              label="Popup solo para resultados del Escenario 2"
              description="Si está activo, el popup de arriba solo aparece cuando el resultado que califica viene del Escenario 2 (la oferta que armamos automáticamente), no del Escenario 1"
            />
          )}
          {uiContador && (
            <ToggleParamForm
              clave={uiContador.clave}
              valor={uiContador.valor}
              label="Contador de asesorías solicitadas"
              description="Número visible en la página principal que muestra el total de personas que pidieron asesoría"
            />
          )}
        </div>
      </div>

      <div className="adm-card">
        <details className="adm-section-details">
          <summary><h2 style={{ display: 'inline' }}>Parámetros del motor de scoring</h2></summary>
          <div style={{ marginTop: 14 }}>
            <div className={sumaOk ? 'adm-peso-banner adm-peso-banner-ok' : 'adm-peso-banner adm-peso-banner-bad'}>
              <span>Suma de pesos de los 9 factores</span>
              <span className={sumaOk ? 'adm-pill adm-pill-green' : 'adm-pill adm-pill-red'}>
                {sumaPesos} / 100
              </span>
              {!sumaOk && <span className="adm-peso-warn">Ajusta los pesos para que sumen exactamente 100</span>}
            </div>

            <div className="adm-factor-list">
              {FACTOR_DEFS.map((f) => (
                <FactorCard
                  key={f.key}
                  label={f.label}
                  peso={pesosByClave[f.pesoClave]}
                  subParams={groups[f.key] || []}
                />
              ))}
            </div>

            {finParams.length > 0 && (
              <div>
                <h3>Parámetros financieros</h3>
                <div className="adm-params-grid">
                  {finParams.map((p) => (
                    <ParamForm key={p.clave} clave={p.clave} valor={p.valor} descripcion={p.descripcion} />
                  ))}
                </div>
              </div>
            )}

            {otrosCats.map((cat) => (
              <div key={cat}>
                <h3>{cat}</h3>
                <div className="adm-params-grid">
                  {groups[cat].map((p) => (
                    <ParamForm key={p.clave} clave={p.clave} valor={p.valor} descripcion={p.descripcion} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="adm-card">
        <details className="adm-section-details">
          <summary><h2 style={{ display: 'inline' }}>Leads ({leads?.length || 0})</h2></summary>
          <div style={{ marginTop: 14 }}>
            <LeadsTable leads={leads || []} />
          </div>
        </details>
      </div>

      <div className="adm-card">
        <details className="adm-section-details">
          <summary><h2 style={{ display: 'inline' }}>Cálculos realizados ({calculos?.length || 0})</h2></summary>
          <div style={{ marginTop: 14 }}>
            <CalculosTable calculos={calculos || []} />
          </div>
        </details>
      </div>
    </div>
  );
}
