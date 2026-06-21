import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updateParametro, signOut } from './actions';
import LeadsTable, { type Lead } from './LeadsTable';
import './admin.css';

type Parametro = {
  clave: string;
  valor: number;
  categoria: string | null;
  descripcion: string | null;
};

const FACTOR_DEFS = [
  { key: 'dti', pesoClave: 'peso_dti', label: 'Capacidad de endeudamiento (DTI)' },
  { key: 'mora', pesoClave: 'peso_mora', label: 'Historial de pagos (mora)' },
  { key: 'exp', pesoClave: 'peso_exp', label: 'Experiencia crediticia' },
  { key: 'ltv', pesoClave: 'peso_ltv', label: 'Monto de inicial (LTV)' },
  { key: 'ing', pesoClave: 'peso_ing', label: 'Nivel de ingresos' },
  { key: 'est', pesoClave: 'peso_est', label: 'Estabilidad laboral' },
  { key: 'pais', pesoClave: 'peso_pais', label: 'País de residencia' },
  { key: 'act', pesoClave: 'peso_act', label: 'Ingresos adicionales' },
  { key: 'edad', pesoClave: 'peso_edad', label: 'Edad del solicitante' },
];

const BUCKETS = [
  { label: '0–20%', min: 0, max: 20 },
  { label: '20–40%', min: 20, max: 40 },
  { label: '40–60%', min: 40, max: 60 },
  { label: '60–80%', min: 60, max: 80 },
  { label: '80–100%', min: 80, max: 101 },
];

function bucketize(scores: (number | null | undefined)[]) {
  const counts = BUCKETS.map(() => 0);
  scores.forEach((s) => {
    if (s == null) return;
    for (let i = 0; i < BUCKETS.length; i++) {
      if (s >= BUCKETS[i].min && s < BUCKETS[i].max) {
        counts[i]++;
        break;
      }
    }
  });
  return counts;
}

function Histogram({ title, counts }: { title: string; counts: number[] }) {
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <div className="adm-hist">
      <h3>{title} ({total})</h3>
      {BUCKETS.map((b, i) => (
        <div className="adm-hist-row" key={b.label}>
          <div className="adm-hist-label">{b.label}</div>
          <div className="adm-hist-bar-wrap">
            <div className="adm-hist-bar" style={{ width: `${(counts[i] / max) * 100}%` }} />
          </div>
          <div className="adm-hist-count">{counts[i]}</div>
        </div>
      ))}
    </div>
  );
}

function ParamForm({ p, compact }: { p: Parametro; compact?: boolean }) {
  return (
    <form action={updateParametro} className="adm-param">
      <label htmlFor={p.clave}>{p.descripcion || p.clave}</label>
      <input type="hidden" name="clave" value={p.clave} />
      <div className="adm-param-row">
        <input
          id={p.clave}
          name="valor"
          type="number"
          step="any"
          defaultValue={p.valor}
          className={compact ? 'adm-input adm-input-sm' : 'adm-input'}
        />
        <button type="submit" className="adm-btn adm-btn-primary">Guardar</button>
      </div>
    </form>
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
          <form action={updateParametro} className="adm-factor-peso">
            <input type="hidden" name="clave" value={peso.clave} />
            <input
              id={peso.clave}
              name="valor"
              type="number"
              step="any"
              defaultValue={peso.valor}
              className="adm-input adm-input-sm"
            />
            <span className="adm-factor-pct">%</span>
            <button type="submit" className="adm-btn adm-btn-primary">Guardar</button>
          </form>
        ) : null}
      </div>
      {subParams.length > 0 && (
        <details className="adm-factor-details">
          <summary>Ver / editar {subParams.length} subparámetros</summary>
          <div className="adm-params-grid">
            {subParams.map((p) => <ParamForm key={p.clave} p={p} />)}
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
    .select('*, precalifica_calculos(score_e1, score_e2, moneda_resultado, vinm_dop, dti)')
    .order('created_at', { ascending: false })
    .returns<Lead[]>();

  const { data: calculos } = await supabase
    .from('precalifica_calculos')
    .select('score_e1')
    .returns<{ score_e1: number | null }[]>();

  const calculosCounts = bucketize((calculos || []).map((c) => c.score_e1));
  const leadsCounts = bucketize((leads || []).map((l) => l.precalifica_calculos?.score_e1));

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
  const factorKeys = new Set(FACTOR_DEFS.map((f) => f.key));
  const otrosCats = Object.keys(groups).filter((c) => c !== 'pesos' && c !== 'fin' && !factorKeys.has(c));

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
          <Histogram title="Cálculos por probabilidad" counts={calculosCounts} />
          <Histogram title="Leads por probabilidad" counts={leadsCounts} />
        </div>
      </div>

      <div className="adm-card">
        <h2>Parámetros del motor de scoring</h2>

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
              {finParams.map((p) => <ParamForm key={p.clave} p={p} />)}
            </div>
          </div>
        )}

        {otrosCats.map((cat) => (
          <div key={cat}>
            <h3>{cat}</h3>
            <div className="adm-params-grid">
              {groups[cat].map((p) => <ParamForm key={p.clave} p={p} />)}
            </div>
          </div>
        ))}
      </div>

      <div className="adm-card">
        <h2>Leads ({leads?.length || 0})</h2>
        <LeadsTable leads={leads || []} />
      </div>
    </div>
  );
}
