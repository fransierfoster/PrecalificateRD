import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// ── DEFAULTS (usados si Supabase falla) ──────────────────────────────────────
const DEF_TC   = 60;
const DEF_TDOP = 0.1193 / 12;
const DEF_TUSD = 0.0850 / 12;

const DEF_PESOS = { dti:0.28, mora:0.20, exp:0.12, ltv:0.12, ing:0.12, est:0.10, pais:0.05, act:0.02, edad:0.01 };
const DEF_DTI   = { p100:100, p95:95, p85:85, p72:72, p45:45, p20:20, p5:5 };
const DEF_LTV   = { p100:100, p95:95, p88:88, p80:80, p73:73, p65:65, p52:52, p40:40, p22:22, p5:5 };
const DEF_MORA  = { sinAtrasos:100, a30Aislado:66, a30Recurrente:39, a3160Aislado:29, a3160Recurrente:13, a60Aislado:18, a60Recurrente:9, topeRec:68 };
const DEF_EXP   = { antNunca:32, antMenos1:48, ant1a3:77, ant3a5:93, antMas5:97, prodNinguno:36, prodTarjeta:59, prodPersonal:73, prodVehiculo:79, prodHipoteca:92, prodCombo:94, gap0:100, gap1:75, gap2:50, gap3:25, gap4:8 };
const DEF_ING   = { mas200k:100, r120_200k:88, r80_120k:75, r50_80k:58, r30_50k:38, menos30k:15 };
const DEF_EST   = { formal:94, pension:60, remesa:78, empresario:91, independiente:70, antMas5:98, ant2a5:87, ant1a2:64, antMenos1:40 };
const DEF_PAIS  = { DO:94, US:78, PR:77, CA:75, ES:75, otro:61 };
const DEF_ACT   = { noDeclara:41, menos10:57, r10_30:75, mas30:86 };
const DEF_EDAD  = { e18_24:35, e25_45:81, e46_55:89, e56_60:66, mas60:50 };

// ── TIPOS ────────────────────────────────────────────────────────────────────
interface Params {
  pesos: typeof DEF_PESOS;
  dti: typeof DEF_DTI;
  ltv: typeof DEF_LTV;
  mora: typeof DEF_MORA & { topeRecCD?: number };
  exp: typeof DEF_EXP;
  ing: typeof DEF_ING;
  est: typeof DEF_EST;
  pais: typeof DEF_PAIS;
  act: typeof DEF_ACT;
  edad: typeof DEF_EDAD;
  fin: { tasaDOP: number; tasaUSD: number; tc: number; precioMinE2Usd: number };
  ui: { popupActivo: boolean; contadorVisible: boolean };
}

interface ScoreResult {
  sc: number; dti: number; ltv: number; cDOP: number;
  pD: number; pL: number; pI: number; pAt: number; pAtFinal: number;
  pExp: number; pExpTit: number; pEs: number; pAct: number; pP: number; pEd: number;
  ingEff: number; dTot: number; atraw: number; atpat: string;
}

// ── CARGA PARÁMETROS DESDE SUPABASE ─────────────────────────────────────────
async function loadParams(): Promise<Params> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: rows } = await supabase
      .from('precalifica_parametros')
      .select('clave, valor');

    if (!rows || rows.length === 0) throw new Error('no rows');

    const m: Record<string, number> = {};
    rows.forEach((r: { clave: string; valor: number }) => { m[r.clave] = r.valor; });

    return {
      pesos: {
        dti: m.peso_dti / 100, mora: m.peso_mora / 100, exp: m.peso_exp / 100,
        ltv: m.peso_ltv / 100, ing: m.peso_ing / 100, est: m.peso_est / 100,
        pais: m.peso_pais / 100, act: m.peso_act / 100, edad: m.peso_edad / 100,
      },
      dti: { p100: m.dti_p100, p95: m.dti_p95, p85: m.dti_p85, p72: m.dti_p72, p45: m.dti_p45, p20: m.dti_p20, p5: m.dti_p5 },
      ltv: { p100: m.ltv_p100, p95: m.ltv_p95, p88: m.ltv_p88, p80: m.ltv_p80, p73: m.ltv_p73, p65: m.ltv_p65, p52: m.ltv_p52, p40: m.ltv_p40, p22: m.ltv_p22, p5: m.ltv_p5 },
      mora: {
        sinAtrasos: m.mora_sin_atrasos,
        a30Aislado: m.mora_30_aislado, a30Recurrente: m.mora_30_recurrente,
        a3160Aislado: m.mora_3160_aislado, a3160Recurrente: m.mora_3160_recurrente,
        a60Aislado: m.mora_60_aislado, a60Recurrente: m.mora_60_recurrente,
        topeRec: m.mora_tope_recurrente, topeRecCD: m.mora_tope_recurrente_cd,
      },
      exp: {
        antNunca: m.exp_ant_nunca, antMenos1: m.exp_ant_menos1, ant1a3: m.exp_ant_1a3, ant3a5: m.exp_ant_3a5, antMas5: m.exp_ant_mas5,
        prodNinguno: m.exp_prod_ninguno, prodTarjeta: m.exp_prod_tarjeta, prodPersonal: m.exp_prod_personal,
        prodVehiculo: m.exp_prod_vehiculo, prodHipoteca: m.exp_prod_hipoteca, prodCombo: m.exp_prod_combo,
        gap0: m.exp_monto_gap0, gap1: m.exp_monto_gap1, gap2: m.exp_monto_gap2, gap3: m.exp_monto_gap3, gap4: m.exp_monto_gap4,
      },
      ing: { mas200k: m.ing_mas200k, r120_200k: m.ing_120_200k, r80_120k: m.ing_80_120k, r50_80k: m.ing_50_80k, r30_50k: m.ing_30_50k, menos30k: m.ing_menos30k },
      est: { formal: m.est_formal, empresario: m.est_empresario, remesa: m.est_remesa, independiente: m.est_independiente, pension: m.est_pension, antMenos1: m.est_ant_menos1, ant1a2: m.est_ant_1a2, ant2a5: m.est_ant_2a5, antMas5: m.est_ant_mas5 },
      pais: { DO: m.pais_do, US: m.pais_us, PR: m.pais_pr, CA: m.pais_ca, ES: m.pais_es, otro: m.pais_otro },
      act: { noDeclara: m.act_no_declara, menos10: m.act_menos10, r10_30: m.act_10_30, mas30: m.act_mas30 },
      edad: { e18_24: m.edad_18_24, e25_45: m.edad_25_45, e46_55: m.edad_46_55, e56_60: m.edad_56_60, mas60: m.edad_mas60 },
      fin: { tasaDOP: m.fin_tasa_dop, tasaUSD: m.fin_tasa_usd, tc: m.fin_tipo_cambio, precioMinE2Usd: m.fin_precio_min_e2_usd },
      ui: {
        popupActivo: m.ui_popup_activo === 1,
        contadorVisible: m.ui_contador_visible === 1,
      },
    };
  } catch {
    return {
      pesos: DEF_PESOS, dti: DEF_DTI, ltv: DEF_LTV, mora: DEF_MORA,
      exp: DEF_EXP, ing: DEF_ING, est: DEF_EST, pais: DEF_PAIS,
      act: DEF_ACT, edad: DEF_EDAD,
      fin: { tasaDOP: DEF_TDOP * 12, tasaUSD: DEF_TUSD * 12, tc: DEF_TC, precioMinE2Usd: 40000 },
      ui: { popupActivo: true, contadorVisible: true },
    };
  }
}

// ── FUNCIONES DE SCORING ─────────────────────────────────────────────────────
function pDTI(dti: number, p: Params): number {
  const d = p.dti;
  return dti <= 0.30 ? d.p100 : dti <= 0.33 ? d.p95 : dti <= 0.36 ? d.p85 : dti <= 0.40 ? d.p72 : dti <= 0.45 ? d.p45 : dti <= 0.50 ? d.p20 : d.p5;
}

function pLTV(ltv: number, p: Params): number {
  const l = p.ltv;
  if (ltv < 0.60) return l.p100;
  if (ltv < 0.65) return l.p95;
  if (ltv < 0.70) return l.p88;
  if (ltv < 0.75) return l.p80;
  if (ltv < 0.78) return l.p73;
  if (ltv < 0.80) return l.p65;
  if (ltv < 0.83) return l.p52;
  if (ltv < 0.85) return l.p40;
  if (ltv < 0.90) return l.p22;
  return l.p5;
}

function pMora(atraw: number, atpat: string, tuvoPres: boolean, p: Params): number {
  if (!tuvoPres || atraw === 0) return p.mora.sinAtrasos;
  const aislado = atpat === 'unico';
  const m = p.mora;
  if (atraw === 30) return aislado ? m.a30Aislado : m.a30Recurrente;
  if (atraw === 45) return aislado ? m.a3160Aislado : m.a3160Recurrente;
  return aislado ? m.a60Aislado : m.a60Recurrente;
}

function topeMora(atraw: number, atpat: string, tuvoPres: boolean, p: Params): number {
  if (!tuvoPres || atraw === 0 || atraw === 30 || atpat === 'unico') return 96;
  return p.mora.topeRec;
}

function pExpAnt(antCred: string, p: Params): number {
  const e = p.exp;
  const map: Record<string, number> = { nunca: e.antNunca, menos1: e.antMenos1, '1a3': e.ant1a3, '3a5': e.ant3a5, mas5: e.antMas5 };
  return map[antCred] ?? 0;
}

function pExpProd(prods: string[], p: Params): number {
  if (!prods || prods.length === 0) return 0;
  const e = p.exp;
  let best = 0, count = 0;
  prods.forEach((x) => {
    if (x === 'hipoteca' && best < e.prodHipoteca) best = e.prodHipoteca;
    else if (x === 'vehiculo' && best < e.prodVehiculo) best = e.prodVehiculo;
    else if (x === 'personal' && best < e.prodPersonal) best = e.prodPersonal;
    else if (x === 'tarjeta' && best < e.prodTarjeta) best = e.prodTarjeta;
    if (x !== 'ninguno') count++;
  });
  if (count === 0) return e.prodNinguno;
  return count >= 2 ? Math.max(best, e.prodCombo) : best;
}

function pExpMonto(brecha: number, p: Params): number {
  const g = p.exp;
  if (brecha <= 0) return g.gap0;
  if (brecha === 1) return g.gap1;
  if (brecha === 2) return g.gap2;
  if (brecha === 3) return g.gap3;
  return g.gap4;
}

function pIng(ingEff: number, p: Params): number {
  const i = p.ing;
  return ingEff > 200000 ? i.mas200k : ingEff > 120000 ? i.r120_200k : ingEff > 80000 ? i.r80_120k : ingEff > 50000 ? i.r50_80k : ingEff > 30000 ? i.r30_50k : i.menos30k;
}

function pEstTipo(emp: string, p: Params): number {
  const e = p.est;
  const map: Record<string, number> = { formal: e.formal, pension: e.pension, remesa: e.remesa, empresario: e.empresario, independiente: e.independiente };
  return map[emp] ?? 45;
}

function pEstAnt(ant: string, p: Params): number {
  const e = p.est;
  const map: Record<string, number> = { mas5: e.antMas5, '2a5': e.ant2a5, '1a2': e.ant1a2, menos1: e.antMenos1 };
  return map[ant] ?? 0;
}

function pPais(pais: string, p: Params): number {
  const map: Record<string, number> = { DO: p.pais.DO, US: p.pais.US, PR: p.pais.PR, CA: p.pais.CA, ES: p.pais.ES };
  return map[pais] ?? p.pais.otro;
}

function pAct(activosDOP: number, ingDOP: number, p: Params): number {
  if (!activosDOP || activosDOP <= 0) return p.act.noDeclara;
  const ratio = activosDOP / Math.max(ingDOP, 1);
  return ratio < 0.10 ? p.act.menos10 : ratio < 0.30 ? p.act.r10_30 : p.act.mas30;
}

function pEdad(edad: number, p: Params): number {
  const e = p.edad;
  if (edad >= 25 && edad <= 45) return e.e25_45;
  if (edad >= 46 && edad <= 55) return e.e46_55;
  if (edad >= 18 && edad < 25) return e.e18_24;
  if (edad >= 56 && edad <= 60) return e.e56_60;
  return e.mas60;
}

function getPeso(factor: string, p: Params): number {
  return (p.pesos as Record<string, number>)[factor] ?? 0;
}

// ── MOTOR PRINCIPAL ──────────────────────────────────────────────────────────
function scoreFn(
  prDOP: number, iniDOP: number, ingTot: number, deuDOP: number, deuCDDOP: number,
  pais: string, emp: string, ant: string, expc: number, antCred: string, prods: string[],
  atraw: number, atpat: string, activosNum: number, edad: number,
  tieneCD: boolean, ingCD: number, ingDOP: number,
  expcCD: number, antCredCD: string, prodsCD: string[],
  atrawCD: number, atpatCD: string, empCD: string, antCD: string, paisCD: string,
  tuvoPres: boolean, p: Params, tm: number, tc: number,
): ScoreResult {
  const cDOP = prDOP > 0 ? (prDOP * tm) / (1 - Math.pow(1 + tm, -240)) : 0;
  const activosDOP = activosNum || 0;
  const ingEff = ingTot + activosDOP;
  const dTot = deuDOP + cDOP + deuCDDOP;
  const dti = ingEff > 0 ? dTot / ingEff : 1;
  const vinmDOP = prDOP + iniDOP;
  const ltv = vinmDOP > 0 ? prDOP / vinmDOP : 1;
  const pUSD = prDOP / tc;
  const nr = pUSD < 8000 ? 1 : pUSD < 25000 ? 2 : pUSD < 50000 ? 3 : pUSD < 100000 ? 4 : 5;

  const pD = pDTI(dti, p);

  const pAtTit = pMora(atraw, atpat, tuvoPres, p);
  const pAtCD  = tieneCD ? pMora(atrawCD, atpatCD, atrawCD > 0, p) : 100;
  const pAtFinal = tieneCD ? (pAtTit * 0.60 + pAtCD * 0.40) : pAtTit;

  const moraRec   = tuvoPres && atraw > 30 && atpat !== 'unico';
  const moraRecCD = tieneCD && atrawCD > 30 && atpatCD !== 'unico';

  const brTit = nr - expc;
  const pMtoTit = pExpMonto(brTit, p);
  const pAntCred = tuvoPres ? pExpAnt(antCred, p) : 0;
  const pProdTit = tuvoPres ? pExpProd(prods, p) : 0;
  let pExpTit = pMtoTit * 0.50 + pAntCred * 0.30 + pProdTit * 0.20;
  if (brTit >= 3) pExpTit = Math.min(40, pExpTit);

  let pExpCD = 0;
  if (tieneCD) {
    const brCD = nr - expcCD;
    const pMtoCD = pExpMonto(brCD, p);
    const pAntCredCD = pExpAnt(antCredCD, p);
    const pProdCD = pExpProd(prodsCD, p);
    pExpCD = pMtoCD * 0.50 + pAntCredCD * 0.30 + pProdCD * 0.20;
    if (brCD >= 3) pExpCD = Math.min(40, pExpCD);
  }
  const pExpFinal = tieneCD ? (pExpTit * 0.70 + pExpCD * 0.30) : pExpTit;

  const pL = pLTV(ltv, p);
  const pI = pIng(ingEff, p);

  const pEsTit = pEstAnt(ant, p) * 0.50 + pEstTipo(emp, p) * 0.50;
  let pEsCD = 0;
  if (tieneCD && empCD) pEsCD = pEstAnt(antCD, p) * 0.50 + pEstTipo(empCD, p) * 0.50;
  const pEs = (tieneCD && empCD) ? (pEsTit * 0.70 + pEsCD * 0.30) : pEsTit;

  const pP  = pPais(pais, p);
  const pA  = pAct(activosDOP, ingDOP, p);
  const pEd = pEdad(edad, p);

  let sc = pD * getPeso('dti', p) + pAtFinal * getPeso('mora', p) + pExpFinal * getPeso('exp', p) +
    pL * getPeso('ltv', p) + pI * getPeso('ing', p) + pEs * getPeso('est', p) +
    pP * getPeso('pais', p) + pA * getPeso('act', p) + pEd * getPeso('edad', p);
  sc = Math.round(Math.min(96, Math.max(5, sc)));

  if (moraRec) sc = Math.min(sc, topeMora(atraw, atpat, tuvoPres, p));
  if (moraRecCD) sc = Math.min(sc, 74);

  return {
    sc, dti, ltv, cDOP,
    pD, pL, pI, pAt: pAtTit, pAtFinal, pExp: pExpFinal, pExpTit, pEs,
    pAct: pA, pP, pEd, ingEff, dTot, atraw, atpat,
  };
}

// ── BUILD WHY ────────────────────────────────────────────────────────────────
type WhyItem = { t: string; x: string; s: string };

function buildWhy(e: ScoreResult, antCred: string, tuvoPres: boolean, activos: number, _pais: string, _edad: number): WhyItem[] {
  const w: WhyItem[] = [];
  const dtiPct = Math.round(e.dti * 100);

  if (e.pD >= 85) w.push({ t: 'ok', x: 'Excelente capacidad de endeudamiento', s: `El porcentaje de tus ingresos que va a deudas es ${dtiPct}%. Esta dentro del rango ideal (menos del 33%).` });
  else if (e.pD >= 72) w.push({ t: 'ok', x: 'Buena capacidad de endeudamiento', s: `El porcentaje de endeudamiento es ${dtiPct}%. Dentro del rango aceptable (33-40%). Hay margen con buen perfil general.` });
  else if (e.pD >= 45) w.push({ t: 'w', x: 'Capacidad de endeudamiento ajustada', s: `El porcentaje de endeudamiento es ${dtiPct}%. Supera el 40% maximo aceptado. Reducir deudas mejoraría tu perfil.` });
  else w.push({ t: 'b', x: 'Capacidad de endeudamiento insuficiente', s: `El porcentaje de endeudamiento es ${dtiPct}%. Muy por encima del limite. Es el principal obstaculo.` });

  if (!tuvoPres) {
    w.push({ t: 'w', x: 'Sin historial de prestamos previos', s: 'No haber tenido prestamos antes puede requerir un co-deudor con experiencia. Con buenos ingresos y estabilidad, muchos bancos aprueban con condiciones.' });
  } else if (!e.atraw || e.atraw === 0) {
    w.push({ t: 'ok', x: 'Historial de pagos impecable', s: 'Sin atrasos registrados. Es uno de los factores mas valorados por las entidades financieras.' });
  } else {
    const aislado = e.atpat === 'unico';
    const diasTxt = e.atraw === 30 ? 'de hasta 30 dias' : e.atraw === 45 ? 'de 31 a 60 dias' : 'de mas de 60 dias';
    if (e.atraw === 30 && aislado) w.push({ t: 'w', x: 'Atraso leve registrado', s: `Hubo un atraso ${diasTxt}, evento aislado. Es justificable pero mantener los pagos al dia es clave.` });
    else if (aislado) w.push({ t: 'w', x: 'Mora mayor - evento aislado', s: `Un atraso ${diasTxt} ocurrio una sola vez. Puede justificarse con historial limpio posterior.` });
    else w.push({ t: 'b', x: 'Mora mayor recurrente', s: `Patron de atrasos ${diasTxt} que se repitio. Este factor reduce significativamente la probabilidad.` });
  }

  if (e.pExpTit >= 80) w.push({ t: 'ok', x: 'Experiencia crediticia solida', s: 'Tu historial es compatible con el monto que solicitas.' });
  else if (e.pExpTit >= 40) w.push({ t: 'w', x: 'Experiencia crediticia limitada para este monto', s: 'Con buen ingreso y pagos al dia, un co-deudor con experiencia en montos similares puede completar el perfil.' });
  else w.push({ t: 'w', x: 'Poca experiencia crediticia', s: 'Con buenos ingresos y estabilidad, un co-deudor con historial puede resolver esta brecha.' });

  const iniPct = Math.round(100 - e.ltv * 100);
  if (e.pL >= 88) w.push({ t: 'ok', x: 'Inicial muy favorable', s: `Tu inicial representa el ${iniPct}% del valor. Reduce el riesgo del banco.` });
  else if (e.pL >= 70) w.push({ t: 'ok', x: 'Inicial adecuada', s: `Tu inicial cubre el ${iniPct}% del valor. Dentro del rango preferido.` });
  else if (e.pL >= 42) w.push({ t: 'w', x: 'Inicial en el limite minimo', s: `Tu inicial cubre el ${iniPct}% del valor. Aumentarla mejoraría directamente tu probabilidad y reduciría la cuota mensual.` });
  else w.push({ t: 'b', x: 'Inicial insuficiente', s: `Tu inicial cubre solo el ${iniPct}% del valor. La mayoria de entidades requieren al menos el 20%.` });

  if (e.pEs >= 80) w.push({ t: 'ok', x: 'Estabilidad laboral comprobable', s: 'Tu tipo de empleo y antiguedad generan confianza en los evaluadores.' });
  else if (e.pEs >= 55) w.push({ t: 'w', x: 'Estabilidad laboral aceptable', s: 'Mas de 2 años en el mismo empleo mejoraría tu evaluación.' });
  else w.push({ t: 'b', x: 'Estabilidad laboral limitada', s: 'Menos de 1 ano en el empleo actual es un factor limitante para varias entidades.' });

  if (e.pI >= 87) w.push({ t: 'ok', x: 'Nivel de ingresos alto', s: 'Tu ingreso mensual neto esta entre los mas favorables para calificar a montos hipotecarios mayores.' });
  else if (e.pI >= 50) w.push({ t: 'w', x: 'Nivel de ingresos moderado', s: 'Tu ingreso cubre el perfil estandar. Un ingreso mayor mejoraría tu probabilidad.' });
  else w.push({ t: 'b', x: 'Nivel de ingresos limitado', s: 'Tu ingreso mensual neto esta por debajo del rango mas favorable para el monto solicitado.' });

  if (activos > 0) w.push({ t: 'ok', x: 'Ingresos adicionales declarados', s: 'Tus ingresos complementarios suman a tu capacidad de pago efectiva.' });
  else w.push({ t: 'w', x: 'No declaraste ingresos adicionales', s: 'Si recibes alquileres, remesas u otros ingresos verificables, declararlos podria mejorar tu probabilidad.' });

  return w;
}

// ── BUILD SIMS ───────────────────────────────────────────────────────────────
type SimItem = { l: string; d: number; b: number };

function buildSims(
  e1: ScoreResult, prDOP: number, iniDOP: number, ingTot: number,
  deuDOP: number, deuCDDOP: number, tieneCD: boolean,
  atraw: number, atpat: string, tuvoPres: boolean,
  pais: string, emp: string, ant: string, expc: number, antCred: string, prods: string[],
  edad: number, ingDOP: number, activos: number, p: Params, tm: number, tc: number,
): SimItem[] {
  const s = e1.sc;
  const sims: SimItem[] = [];

  if (deuDOP > 0) {
    const cDOP = prDOP > 0 ? (prDOP * tm) / (1 - Math.pow(1 + tm, -240)) : 0;
    const d2 = (deuDOP * 0.5 + cDOP + deuCDDOP) / Math.max(ingTot, 1);
    const pD2 = pDTI(d2, p);
    const dl = Math.round(Math.min(95, s - e1.pD * getPeso('dti', p) + pD2 * getPeso('dti', p)) - s);
    if (dl > 0) sims.push({ l: 'Reduces tus deudas actuales en un 50%', d: dl, b: Math.min(95, s + dl) });
  }

  if (!tieneCD) {
    const ingCDsim = Math.round(ingDOP * 0.40);
    const eCD = scoreFn(prDOP, iniDOP, ingTot + ingCDsim, deuDOP, 0, pais, emp, ant, expc, antCred, prods, atraw, atpat, activos, edad, true, ingCDsim, ingDOP, 2, '1a3', ['tarjeta'], 0, 'na', 'formal', '2a5', pais, tuvoPres, p, tm, tc);
    const dlCD = Math.round(Math.min(95, eCD.sc) - s);
    if (dlCD > 0) sims.push({ l: 'Agregas un co-deudor con ingresos y buen historial al perfil combinado', d: dlCD, b: Math.min(95, s + dlCD) });
  }

  if (e1.pExpTit < 80 && tuvoPres) {
    const dl3 = Math.round(Math.min(95, s - e1.pExp * getPeso('exp', p) + 100 * getPeso('exp', p)) - s);
    if (dl3 > 0) sims.push({ l: 'Construyes historial crediticio en el rango del monto solicitado', d: dl3, b: Math.min(95, s + dl3) });
  }

  if (atraw > 0 && tuvoPres) {
    const dl4 = Math.round(Math.min(95, s - e1.pAtFinal * getPeso('mora', p) + 100 * getPeso('mora', p)) - s);
    if (dl4 > 0) sims.push({ l: 'Mantienes pagos al dia por 12 meses consecutivos', d: dl4, b: Math.min(95, s + dl4) });
  }

  if (e1.pL < 88) {
    const ltvSim = Math.max(0, e1.ltv - 0.05);
    const pL2 = pLTV(ltvSim, p);
    const dl5 = Math.round(Math.min(95, s - e1.pL * getPeso('ltv', p) + pL2 * getPeso('ltv', p)) - s);
    if (dl5 > 0) sims.push({ l: 'Aumentas tu inicial en 5 puntos porcentuales adicionales', d: dl5, b: Math.min(95, s + dl5) });
  }

  if (!activos || activos <= 0) {
    const actBase = p.act.noDeclara;
    const actSim  = p.act.menos10;
    const dl6 = Math.round(Math.min(95, s - actBase * getPeso('act', p) + actSim * getPeso('act', p)) - s);
    if (dl6 > 0) sims.push({ l: 'Declaras ingresos adicionales verificables', d: dl6, b: Math.min(95, s + dl6) });
  }

  if (sims.length === 0) sims.push({ l: 'Tu perfil esta bien optimizado', d: 0, b: s });
  return sims;
}

// ── CRED PERFIL ──────────────────────────────────────────────────────────────
function credPerfil(pExpTit: number, pAt: number, antCred: string, tuvoPres: boolean) {
  const antCM: Record<string, number> = { nunca: 0, menos1: 20, '1a3': 55, '3a5': 82, mas5: 100 };
  const sc = tuvoPres ? (pExpTit * 0.50 + pAt * 0.30 + (antCM[antCred] || 0) * 0.20) : 0;
  if (sc >= 85) return { c: 'cp-ex', t: '⭐ Perfil crediticio: Excelente' };
  if (sc >= 70) return { c: 'cp-mb', t: '✦ Perfil crediticio: Muy bueno' };
  if (sc >= 55) return { c: 'cp-b', t: '◆ Perfil crediticio: Bueno' };
  if (sc >= 35) return { c: 'cp-a', t: '◇ Perfil crediticio: Aceptable' };
  return { c: 'cp-d', t: '△ Perfil crediticio: Sin historial' };
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      edad, pais, emp, ant, tuvoPres, expc, antCred, prods,
      atraw, atpat, tieneCD, activos,
      ingDOP, deuDOP, ingCDDOP, deuCDDOP,
      expcCD, antCredCD, prodsCD, atrawCD, atpatCD, empCD, antCD, paisCD,
      vinmDOP, iniDOP, mr,
      sliderOnly,
    } = body;

    const p = await loadParams();

    const tc   = p.fin.tc   || DEF_TC;
    const tdop = p.fin.tasaDOP / 12 || DEF_TDOP;
    const tusd = p.fin.tasaUSD / 12 || DEF_TUSD;
    const tm   = mr === 'USD' ? tusd : tdop;

    const prDOP    = Math.max(0, vinmDOP - iniDOP);
    const ingTot   = ingDOP + ingCDDOP;
    const activosDOP = activos || 0;

    const e1 = scoreFn(
      prDOP, iniDOP, ingTot, deuDOP, deuCDDOP,
      pais, emp, ant, expc, antCred, prods,
      atraw, atpat, activosDOP, edad,
      tieneCD, ingCDDOP, ingDOP,
      expcCD, antCredCD, prodsCD,
      atrawCD, atpatCD, empCD, antCD, paisCD,
      tuvoPres, p, tm, tc,
    );

    // Para el slider solo necesitamos sc y cDOP
    if (sliderOnly) {
      return NextResponse.json({ sc: e1.sc, cDOP: e1.cDOP });
    }

    // ── E2 ───────────────────────────────────────────────────────────────────
    const ingEffTotal = ingTot + activosDOP;
    const deuExist    = deuDOP + deuCDDOP;
    const precioMinE2Usd = p.fin.precioMinE2Usd || 40000;
    const virDOPMin = Math.round(precioMinE2Usd * tc / 10000) * 10000;
    const e2NoViable = virDOPMin >= prDOP;

    let e2: ScoreResult = { sc: 0, cDOP: 0, dti: 0, ltv: 0, pD: 0, pL: 0, pI: 0, pAt: 0, pAtFinal: 0, pExp: 0, pExpTit: 0, pEs: 0, pAct: 0, pP: 0, pEd: 0, ingEff: 0, dTot: 0, atraw, atpat };
    let mrDOP = 0, virDOP = 0, isiDOP = iniDOP;

    if (!e2NoViable) {
      for (let pct = 0.95; pct >= 0.30; pct = Math.round((pct - 0.05) * 100) / 100) {
        let vir2 = Math.round(vinmDOP * pct / 10000) * 10000;
        if (vir2 < virDOPMin) vir2 = virDOPMin;
        if (vir2 >= vinmDOP) continue;
        const mr2 = Math.max(0, vir2 - iniDOP);
        if (mr2 <= 0) break;
        const e2t = scoreFn(mr2, iniDOP, ingTot, deuDOP, deuCDDOP, pais, emp, ant, expc, antCred, prods, atraw, atpat, activosDOP, edad, tieneCD, ingCDDOP, ingDOP, expcCD, antCredCD, prodsCD, atrawCD, atpatCD, empCD, antCD, paisCD, tuvoPres, p, tm, tc);
        if (e2t.sc > e2.sc) { mrDOP = mr2; virDOP = vir2; isiDOP = iniDOP; e2 = e2t; }
        if (e2.sc >= 80) break;
      }
    }

    if (e2.sc < 80) {
      const cmaxHip = Math.max(0, ingEffTotal * 0.33 - deuExist);
      mrDOP = cmaxHip > 0 ? Math.round((cmaxHip * (1 - Math.pow(1 + tm, -240)) / tm) / 10000) * 10000 : 0;
      if (mrDOP >= prDOP) mrDOP = Math.max(0, prDOP - 100000);

      virDOP = mrDOP > 0 ? Math.round(mrDOP / 0.80 / 10000) * 10000 : 0;
      if (virDOP > 0 && virDOP < virDOPMin) virDOP = virDOPMin;
      const isiMin = virDOP > 0 ? Math.round(virDOP * 0.20 / 10000) * 10000 : 0;
      isiDOP = Math.min(iniDOP, virDOP > 0 ? virDOP * 0.80 : 0);
      if (isiDOP < isiMin) isiDOP = isiMin;
      if (virDOP > 0) mrDOP = Math.max(0, virDOP - isiDOP);

      e2 = (!e2NoViable && mrDOP > 0)
        ? scoreFn(mrDOP, isiDOP, ingTot, deuDOP, deuCDDOP, pais, emp, ant, expc, antCred, prods, atraw, atpat, activosDOP, edad, tieneCD, ingCDDOP, ingDOP, expcCD, antCredCD, prodsCD, atrawCD, atpatCD, empCD, antCD, paisCD, tuvoPres, p, tm, tc)
        : { sc: 0, cDOP: 0, dti: 0, ltv: 0, pD: 0, pL: 0, pI: 0, pAt: 0, pAtFinal: 0, pExp: 0, pExpTit: 0, pEs: 0, pAct: 0, pP: 0, pEd: 0, ingEff: 0, dTot: 0, atraw, atpat };

      if (!e2NoViable) {
        const ratios = [0.30, 0.28, 0.25];
        for (let ri = 0; ri < ratios.length && e2.sc < 85; ri++) {
          const cap2 = ingEffTotal * ratios[ri] - deuExist;
          if (cap2 > 0) {
            let mr2 = Math.round((Math.max(0, cap2) * (1 - Math.pow(1 + tm, -240)) / tm) / 10000) * 10000;
            if (mr2 > 0 && mr2 < prDOP) {
              let vir2 = Math.round(mr2 / 0.80 / 10000) * 10000;
              if (vir2 < virDOPMin) vir2 = virDOPMin;
              if (vir2 < prDOP) {
                const isi2min = Math.round(vir2 * 0.20 / 10000) * 10000;
                let isi2 = Math.min(iniDOP, vir2 * 0.80);
                if (isi2 < isi2min) isi2 = isi2min;
                mr2 = Math.max(0, vir2 - isi2);
                const e2t = scoreFn(mr2, isi2, ingTot, deuDOP, deuCDDOP, pais, emp, ant, expc, antCred, prods, atraw, atpat, activosDOP, edad, tieneCD, ingCDDOP, ingDOP, expcCD, antCredCD, prodsCD, atrawCD, atpatCD, empCD, antCD, paisCD, tuvoPres, p, tm, tc);
                if (e2t.sc > e2.sc) { mrDOP = mr2; virDOP = vir2; isiDOP = isi2; e2 = e2t; }
              }
            }
          }
        }
      }
    }

    const e2Reached = e2.sc >= 85;
    const why = buildWhy(e1, antCred, tuvoPres, activosDOP, pais, edad);
    const sims = buildSims(e1, prDOP, iniDOP, ingTot, deuDOP, deuCDDOP, tieneCD, atraw, atpat, tuvoPres, pais, emp, ant, expc, antCred, prods, edad, ingDOP, activosDOP, p, tm, tc);
    const cp = credPerfil(e1.pExpTit, e1.pAt, antCred, tuvoPres);

    return NextResponse.json({
      e1, e2, why, sims, cp,
      virDOP, mrDOP, isiDOP, prDOP,
      e2Reached, e2NoViable, virDOPMin,
      tc, tdop, tusd,
      popupActivo: p.ui.popupActivo,
      contadorVisible: p.ui.contadorVisible,
    });
  } catch (err) {
    console.error('Error en /api/calcular:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
