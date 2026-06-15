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

const CATEGORIA_LABELS: Record<string, string> = {
  pesos: 'Pesos del motor (deben sumar 100)',
  dti: 'Score por DTI',
  ltv: 'Score por LTV',
  mora: 'Score por mora',
  fin: 'Parámetros financieros',
};

const CATEGORIA_ORDER = ['pesos', 'dti', 'ltv', 'mora', 'fin'];

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

  const orderedCats = [
    ...CATEGORIA_ORDER.filter((c) => groups[c]),
    ...Object.keys(groups).filter((c) => !CATEGORIA_ORDER.includes(c)),
  ];

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
        {orderedCats.map((cat) => (
          <div key={cat}>
            <h3>{CATEGORIA_LABELS[cat] || cat}</h3>
            <div className="adm-params-grid">
              {groups[cat].map((p) => (
                <form key={p.clave} action={updateParametro} className="adm-param">
                  <label htmlFor={p.clave}>{p.descripcion || p.clave}</label>
                  <input type="hidden" name="clave" value={p.clave} />
                  <div className="adm-param-row">
                    <input
                      id={p.clave}
                      name="valor"
                      type="number"
                      step="any"
                      defaultValue={p.valor}
                      className="adm-input"
                    />
                    <button type="submit" className="adm-btn adm-btn-primary">Guardar</button>
                  </div>
                </form>
              ))}
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
