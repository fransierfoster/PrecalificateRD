# PrecalificateRD

Simulador hipotecario de Perfect House SRL.

**Stack:** Next.js 14 (App Router) + Supabase + TypeScript  
**Deploy:** cada push a `main` actualiza automáticamente precalificaterd.com / .net / .do

## Archivos clave

- `public/precal-script.js` — lógica del formulario (vanilla JS, corre en el browser)
- `components/precal-body.ts` — HTML estático del simulador
- `app/api/calcular/route.ts` — motor de scoring (server-side)
- `app/admin/page.tsx` — panel de administración

## Cómo publicar cambios

```bash
npx tsc --noEmit
git add <archivos específicos>
git commit -m "Descripción del cambio"
git push
```

Vercel despliega automáticamente en ~1 minuto.

## Probar sin afectar producción

Usar `https://precalificaterd.com/?test=1` — con este parámetro no se guardan eventos, cálculos ni leads.
