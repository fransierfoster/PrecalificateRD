import {
  buildParamsFromMap, computeFull, defaultParams, loadFlatParams,
  DEF_TC, DEF_TDOP, DEF_TUSD,
  type CalcInput, type Params,
} from '@/app/api/calcular/route';

// SOLO SERVER-SIDE. Este archivo contiene la lógica de la calculadora inversa
// y los perfiles de referencia: nunca importarlo desde código de cliente ni
// devolver sus constantes/parámetros en una respuesta de API.

export const PORCENTAJES = [70, 80, 90] as const;

// Mezcla de edades de los clientes (20-39 / 40-59 / 60+), estimada de los cálculos reales;
// se usa para estimar el seguro de vida cuando la calculadora no pregunta la edad.
const MEZCLA_EDADES = { t20: 0.68, t40: 0.31, t60: 0.01 };

function segurosPromedio(financiarDOP: number, vinmDOP: number, p: Params): number {
  if (!p.fin.segurosActivo) return 0;
  const vidaMil = MEZCLA_EDADES.t20 * p.fin.vida20 + MEZCLA_EDADES.t40 * p.fin.vida40 + MEZCLA_EDADES.t60 * p.fin.vida60;
  return (financiarDOP / 1000) * vidaMil + vinmDOP * (p.fin.segPropAnual / 12);
}

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
  | { ok: true; moneda: 'DOP' | 'USD'; valor: number; opciones: OpcionCalc[]; conSeguros: boolean }
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
    const cuotaDOP = (financiarDOP * tm) / (1 - Math.pow(1 + tm, -240)) + segurosPromedio(financiarDOP, vinmDOP, p);

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

  return { ok: true, moneda, valor, opciones, conSeguros: p.fin.segurosActivo };
}

// ── Modo "tengo mi ingreso": precio de vivienda que se podría comprar ────────
// Para cada % de financiamiento se busca el precio más alto que sigue cumpliendo
// el mismo criterio (probabilidad y endeudamiento) con el perfil exigente (peor
// escenario) y con el perfil sólido (mejor escenario).

function precioMaximo(
  perfil: { base: BasePerfil; deudaRatio: number },
  ingDOP: number, pct: number, minDOP: number, mr: 'DOP' | 'USD',
  p: Params, tm: number, tc: number,
): number | null {
  const ok = (v: number) => {
    const e1 = computeFull(
      { ...perfil.base, ingDOP, deuDOP: ingDOP * perfil.deudaRatio, vinmDOP: v, iniDOP: v * (1 - pct / 100), mr },
      p, tm, tc,
    ).e1;
    return e1.sc >= OBJETIVO && e1.dti <= TOPE_DTI;
  };

  let lo = minDOP, hi = 500_000_000;
  if (!ok(lo)) return null;
  if (ok(hi)) return hi;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

export interface OpcionPrecio {
  pct: number;
  precioMin: number | null;
  precioMax: number | null;
  precioMinOtro: number | null;
  precioMaxOtro: number | null;
  inicialMin: number | null;
  inicialMax: number | null;
  cuotaMin: number | null;
  cuotaMax: number | null;
}

export type ResultadoPrecio =
  | { ok: true; moneda: 'DOP' | 'USD'; ingreso: number; opciones: OpcionPrecio[]; conSeguros: boolean }
  | { ok: false; error: 'bajo'; minimo: number }
  | { ok: false; error: 'invalido' };

export async function calcularPorIngreso(ingresoRaw: number, moneda: 'DOP' | 'USD'): Promise<ResultadoPrecio> {
  const flat = await loadFlatParams();
  const p = flat ? buildParamsFromMap(flat) : defaultParams();
  const tc = p.fin.tc || DEF_TC;
  const tm = moneda === 'USD' ? (p.fin.tasaUSD / 12 || DEF_TUSD) : (p.fin.tasaDOP / 12 || DEF_TDOP);

  const ingreso = Math.round(ingresoRaw);
  if (!Number.isFinite(ingreso) || ingreso <= 0 || ingreso > 100_000_000) return { ok: false, error: 'invalido' };

  const factor = moneda === 'USD' ? tc : 1;
  const ingDOP = ingreso * factor;
  const minUsd = p.fin.precioMinE2Usd || 40000;
  const minDOP = minUsd * tc;
  const minUser = Math.round(minDOP / factor);

  const paso = moneda === 'USD' ? 5000 : 100000;
  const aUsuario = (vDOP: number | null): number | null => {
    if (vDOP == null) return null;
    return Math.max(minUser, Math.floor(vDOP / factor / paso) * paso);
  };
  const otraMoneda = (vUser: number | null): number | null => {
    if (vUser == null) return null;
    return moneda === 'USD'
      ? Math.floor(vUser * tc / 100000) * 100000
      : Math.floor(vUser / tc / 1000) * 1000;
  };
  const cuotaDe = (vUser: number | null, pct: number): number | null => {
    if (vUser == null) return null;
    const financiarDOP = vUser * factor * pct / 100;
    const cuotaDOP = (financiarDOP * tm) / (1 - Math.pow(1 + tm, -240)) + segurosPromedio(financiarDOP, vUser * factor, p);
    return Math.round(cuotaDOP / factor);
  };

  const opciones: OpcionPrecio[] = PORCENTAJES.map((pct) => {
    const peor = aUsuario(precioMaximo(PERFIL_EXIGENTE, ingDOP, pct, minDOP, moneda, p, tm, tc));
    const mejor = aUsuario(precioMaximo(PERFIL_MEJOR, ingDOP, pct, minDOP, moneda, p, tm, tc));
    return {
      pct,
      precioMin: peor,
      precioMax: mejor,
      precioMinOtro: otraMoneda(peor),
      precioMaxOtro: otraMoneda(mejor),
      inicialMin: peor == null ? null : Math.round(peor * (100 - pct) / 100),
      inicialMax: mejor == null ? null : Math.round(mejor * (100 - pct) / 100),
      cuotaMin: cuotaDe(peor, pct),
      cuotaMax: cuotaDe(mejor, pct),
    };
  });

  if (opciones.every((o) => o.precioMax == null)) return { ok: false, error: 'bajo', minimo: minUser };
  return { ok: true, moneda, ingreso, opciones, conSeguros: p.fin.segurosActivo };
}
