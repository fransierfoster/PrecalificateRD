import {
  buildParamsFromMap, computeFull, defaultParams, loadFlatParams,
  DEF_TC, DEF_TDOP, DEF_TUSD,
  type CalcInput, type Params,
} from '@/app/api/calcular/route';

// SOLO SERVER-SIDE. Este archivo contiene la lógica de la calculadora inversa
// y los perfiles de referencia: nunca importarlo desde código de cliente ni
// devolver sus constantes/parámetros en una respuesta de API.

export const PORCENTAJES = [70, 80, 90] as const;

// Probabilidad mínima (score E1) que se considera "buena probabilidad".
const OBJETIVO = 70;
// El score es una suma ponderada: un perfil fuerte podría alcanzar el objetivo
// con un endeudamiento irreal, así que además se exige un DTI máximo.
const TOPE_DTI = 0.40;

type BasePerfil = Omit<CalcInput, 'ingDOP' | 'deuDOP' | 'vinmDOP' | 'iniDOP' | 'mr'>;

const COMUN: Pick<BasePerfil, 'pais' | 'tieneCD' | 'activos' | 'ingCDDOP' | 'deuCDDOP' | 'expcCD' | 'antCredCD' | 'prodsCD' | 'atrawCD' | 'atpatCD' | 'empCD' | 'antCD' | 'paisCD' | 'atrehab'> = {
  pais: 'DO', tieneCD: false, activos: 0, ingCDDOP: 0, deuCDDOP: 0,
  expcCD: 0, antCredCD: '', prodsCD: [], atrawCD: 0, atpatCD: '', empCD: '', antCD: '', paisCD: '', atrehab: '',
};

// Mejor caso: con experiencia crediticia amplia, pagos al día, empleo formal
// estable y sin deudas.
const PERFIL_MEJOR: { base: BasePerfil; deudaRatio: number } = {
  base: {
    ...COMUN, edad: 48, emp: 'formal', ant: 'mas5',
    tuvoPres: true, expc: 5, antCred: 'mas5', prods: ['hipoteca'],
    atraw: 0, atpat: '',
  },
  deudaRatio: 0,
};

// Caso exigente: sin experiencia crediticia, ingreso independiente de poca
// antigüedad y deudas moderadas (proporcionales al ingreso).
const PERFIL_EXIGENTE: { base: BasePerfil; deudaRatio: number } = {
  base: {
    ...COMUN, edad: 28, emp: 'independiente', ant: '1a2',
    tuvoPres: false, expc: 0, antCred: 'nunca', prods: ['ninguno'],
    atraw: 0, atpat: '',
  },
  deudaRatio: 0.05,
};

function ingresoMinimo(
  perfil: { base: BasePerfil; deudaRatio: number },
  vinmDOP: number, iniDOP: number, mr: 'DOP' | 'USD',
  p: Params, tm: number, tc: number,
): number | null {
  const ok = (ing: number) => {
    const e1 = computeFull(
      { ...perfil.base, ingDOP: ing, deuDOP: ing * perfil.deudaRatio, vinmDOP, iniDOP, mr },
      p, tm, tc,
    ).e1;
    return e1.sc >= OBJETIVO && e1.dti <= TOPE_DTI;
  };

  let lo = 10000, hi = 3000000;
  if (!ok(hi)) return null;
  if (ok(lo)) return lo;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

const r5Down = (n: number) => Math.floor(n / 5000) * 5000;
const r5Up = (n: number) => Math.ceil(n / 5000) * 5000;

export interface OpcionCalc {
  pct: number;
  inicial: number;
  financiar: number;
  cuota: number;
  ingresoMin: number | null;
  ingresoMax: number | null;
  ingresoMinUsd: number | null;
  ingresoMaxUsd: number | null;
}

export type ResultadoCalc =
  | { ok: true; moneda: 'DOP' | 'USD'; valor: number; opciones: OpcionCalc[] }
  | { ok: false; error: 'min'; minimo: number }
  | { ok: false; error: 'invalido' };

export async function calcularInversa(valorRaw: number, moneda: 'DOP' | 'USD'): Promise<ResultadoCalc> {
  const flat = await loadFlatParams();
  const p = flat ? buildParamsFromMap(flat) : defaultParams();
  const tc = p.fin.tc || DEF_TC;
  const tm = moneda === 'USD' ? (p.fin.tasaUSD / 12 || DEF_TUSD) : (p.fin.tasaDOP / 12 || DEF_TDOP);

  const valor = Math.round(valorRaw);
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: 'invalido' };

  const factor = moneda === 'USD' ? tc : 1;
  const vinmDOP = valor * factor;
  const minUsd = p.fin.precioMinE2Usd || 40000;
  if (vinmDOP < minUsd * tc) {
    return { ok: false, error: 'min', minimo: Math.round(moneda === 'USD' ? minUsd : minUsd * tc) };
  }
  if (vinmDOP > 500_000_000) return { ok: false, error: 'invalido' };

  const opciones: OpcionCalc[] = PORCENTAJES.map((pct) => {
    const financiarDOP = vinmDOP * pct / 100;
    const iniDOP = vinmDOP - financiarDOP;
    const cuotaDOP = (financiarDOP * tm) / (1 - Math.pow(1 + tm, -240));

    const mejor = ingresoMinimo(PERFIL_MEJOR, vinmDOP, iniDOP, moneda, p, tm, tc);
    const exigente = ingresoMinimo(PERFIL_EXIGENTE, vinmDOP, iniDOP, moneda, p, tm, tc);

    const ingresoMin = mejor == null ? null : r5Down(mejor);
    const ingresoMax = exigente == null ? null : r5Up(exigente);

    return {
      pct,
      inicial: Math.round((vinmDOP - financiarDOP) / factor),
      financiar: Math.round(financiarDOP / factor),
      cuota: Math.round(cuotaDOP / factor),
      ingresoMin,
      ingresoMax,
      ingresoMinUsd: ingresoMin == null ? null : Math.floor(ingresoMin / tc / 100) * 100,
      ingresoMaxUsd: ingresoMax == null ? null : Math.ceil(ingresoMax / tc / 100) * 100,
    };
  });

  return { ok: true, moneda, valor, opciones };
}
