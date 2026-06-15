import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updateParametro, updateLead, signOut } from './actions';
import './admin.css';

type Parametro = {
  clave: string;
  valor: number;
  categoria: string | null;
  descripcion: string | null;
};

type Calculo = {
  score_e1: number | null;
  score_e2: number | null;
  moneda_resultado: string | null;
  vinm_dop: number | null;
  dti: number | null;
};

type Lead = {
  id: string;
  created_at: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  doc_tipo: string | null;
  doc_numero: string | null;
  quiere_ofertas: boolean | null;
  contactado: boolean | null;
  asesor_asignado: string | null;
  resultado_banco: string | null;
  notas: string | null;
  precalifica_calculos: Calculo | null;
};

const CATEGORIA_LABELS: Record<string, string> = {
  pesos: 'Pesos del motor (deben sumar 100)',
  dti: 'Score por DTI',
  ltv: 'Score por LTV',
  mora: 'Score por mora',
  fin: 'Parámetros financieros',
};

const CATEGORIA_ORDER = ['pesos', 'dti', 'ltv', 'mora', 'fin'];

function fmtMoney(n: number | null, currency: string | null) {
  if (n == null) return '-';
  const symbol = currency === 'USD' ? 'US$' : 'RD$';
  return symbol + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
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
        {leads && leads.length > 0 ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Contacto</th>
                  <th>Documento</th>
                  <th>Resultado</th>
                  <th>Ofertas</th>
                  <th>Seguimiento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const c = lead.precalifica_calculos;
                  return (
                    <tr key={lead.id}>
                      <td>{new Date(lead.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>
                        <strong>{lead.nombre} {lead.apellido}</strong><br />
                        {lead.telefono}<br />
                        {lead.email}
                      </td>
                      <td>{lead.doc_tipo} {lead.doc_numero}</td>
                      <td>
                        {c ? (
                          <>
                            {fmtMoney(c.vinm_dop, c.moneda_resultado)}<br />
                            E1: {c.score_e1}% {c.score_e2 != null ? `/ E2: ${c.score_e2}%` : ''}<br />
                            DTI: {c.dti != null ? (c.dti * 100).toFixed(0) + '%' : '-'}
                          </>
                        ) : <span className="adm-empty">sin datos</span>}
                      </td>
                      <td>
                        <span className={`adm-pill ${lead.quiere_ofertas ? 'adm-pill-green' : 'adm-pill-gray'}`}>
                          {lead.quiere_ofertas ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td>
                        <form action={updateLead} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                          <input type="hidden" name="id" value={lead.id} />
                          <label style={{ fontSize: 12 }}>
                            <input type="checkbox" name="contactado" defaultChecked={!!lead.contactado} /> Contactado
                          </label>
                          <input type="text" name="asesor_asignado" placeholder="Asesor asignado" defaultValue={lead.asesor_asignado || ''} />
                          <input type="text" name="resultado_banco" placeholder="Resultado banco" defaultValue={lead.resultado_banco || ''} />
                          <textarea name="notas" placeholder="Notas" defaultValue={lead.notas || ''} />
                          <button type="submit" className="adm-btn adm-btn-primary">Guardar</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adm-empty">Aún no hay leads.</p>
        )}
      </div>
    </div>
  );
}
