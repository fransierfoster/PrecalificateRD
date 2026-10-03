import type { NextRequest } from 'next/server';

// SOLO SERVER-SIDE. Límite de uso del motor de scoring por IP: los primeros
// CALCULOS_LIBRES cálculos completos pasan directo; después se exige una
// verificación anti-robot (Cloudflare Turnstile) y se permiten CALCULOS_EXTRA
// más. Pasado ese tope se bloquea hasta que termine la ventana.
// El conteo vive en memoria del servidor: es un freno, no un candado.

const VENTANA_MS = 60 * 60 * 1000;
const CALCULOS_LIBRES = 5;
const CALCULOS_EXTRA = 5;
const SLIDER_POR_CALCULO = 60;
const SLIDER_MAX = 180;

interface Estado {
  desde: number;
  n: number;
  verificado: boolean;
  slider: number;
}

const estados = new Map<string, Estado>();

function estadoDe(ip: string): Estado {
  const ahora = Date.now();
  let e = estados.get(ip);
  if (!e || ahora - e.desde >= VENTANA_MS) {
    e = { desde: ahora, n: 0, verificado: false, slider: 0 };
    estados.set(ip, e);
    if (estados.size > 5000) {
      for (const [k, v] of estados) if (ahora - v.desde >= VENTANA_MS) estados.delete(k);
    }
  }
  return e;
}

export function ipDe(req: NextRequest): string {
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
}

export function evaluarCalculo(ip: string): 'ok' | 'captcha' | 'limite' {
  const e = estadoDe(ip);
  if (e.n >= CALCULOS_LIBRES + CALCULOS_EXTRA) return 'limite';
  // Sin TURNSTILE_SECRET_KEY configurada no se puede verificar: se evita bloquear
  // al usuario y el tope queda en CALCULOS_LIBRES + CALCULOS_EXTRA por ventana.
  if (e.n >= CALCULOS_LIBRES && !e.verificado && process.env.TURNSTILE_SECRET_KEY) return 'captcha';
  return 'ok';
}

export function marcarVerificado(ip: string) {
  estadoDe(ip).verificado = true;
}

export function registrarCalculo(ip: string) {
  const e = estadoDe(ip);
  e.n += 1;
  e.slider = Math.min(SLIDER_MAX, e.slider + SLIDER_POR_CALCULO);
}

// El slider devuelve el score exacto: su presupuesto sale de los cálculos completos.
export function consumirSlider(ip: string): boolean {
  const e = estadoDe(ip);
  if (e.slider <= 0) return false;
  e.slider -= 1;
  return true;
}

export async function verificarCaptcha(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'local') form.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}
