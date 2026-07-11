var TC = 60, TDOP = 0.1193 / 12, TUSD = 0.0850 / 12;
var PRECIO_MIN_USD = 40000;
var POPUP_ACTIVO = true;

const DC = ['US','PR','CA','PA','EC','SV','BS','BB','AG','GD','KN','LC','VC','TT','BZ','GY','JM'];

var SNMS = ['', 'Perfil Personal', 'Situación Financiera', 'Inmueble y Capital'];

let SD = {};
var MR = 'DOP', TOK = false, COK = false, PRESVAL = null, ATVAL = null, CDATVAL = null, _popupTimer = null;

// ── SUPABASE ──
var SUPA_URL = (typeof window !== 'undefined' && window.__SUPA_URL__) || '';
var SUPA_KEY = (typeof window !== 'undefined' && window.__SUPA_KEY__) || '';

function supaHeaders(extra) {
  return Object.assign({
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}

function getSessionId() {
  try {
    var id = localStorage.getItem('precalRD_session');
    if (!id) {
      id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      localStorage.setItem('precalRD_session', id);
    }
    return id;
  } catch (e) {
    return 'sess_' + Date.now();
  }
}

var SESSION_ID = getSessionId();
var LAST_CALC_ID = null;

// ── NÚMEROS ──
function fni(el) {
  var v = el.value;
  var d = v.indexOf('.');
  if (d >= 0) v = v.substring(0, d);
  var r = v.replace(/[^0-9]/g, '');
  if (r.length > 10) r = r.slice(0, 10);
  el.value = r;
}

function ff(el) {
  var v = el.value;
  var d = v.indexOf('.');
  if (d >= 0) v = v.substring(0, d);
  v = v.replace(/[^0-9]/g, '');
  el.value = (v === '0' || v === '') ? '' : v;
  setTimeout(function () {
    try { el.select(); } catch (e) {}
  }, 0);
}

function fn(el) {
  var zok = ['deu', 'cdd'];
  var v = el.value;
  var d = v.indexOf('.');
  if (d >= 0) v = v.substring(0, d);
  var r = v.replace(/[^0-9]/g, '');
  if (!r) { el.value = ''; return; }
  var n = parseInt(r, 10);
  if (isNaN(n)) { el.value = ''; return; }
  if (n === 0 && zok.indexOf(el.id) >= 0) { el.value = '0'; return; }
  if (n === 0) { el.value = ''; return; }
  el.value = n.toLocaleString('en-US');
}

function pn(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  var v = el.value;
  var d = v.indexOf('.');
  if (d >= 0) v = v.substring(0, d);
  var dg = v.replace(/[^0-9]/g, '');
  if (!dg) return 0;
  var n = parseInt(dg, 10);
  return isNaN(n) ? 0 : n;
}

function en(e, nid) {
  if (e.key === 'Enter') {
    e.preventDefault();
    var el = document.getElementById(nid);
    if (el) el.focus();
  }
}

// ── PRODUCTOS MULTI-SELECT ──
function togProd(el) {
  el.classList.toggle('sel');
}

function getProds(prefix) {
  var sel = [];
  ['tarjeta', 'personal', 'vehiculo', 'hipoteca'].forEach(function (o) {
    var el = document.getElementById(prefix + '-' + o);
    if (el && el.classList.contains('sel')) sel.push(o);
  });
  return sel.length > 0 ? sel : ['ninguno'];
}

// ── PRÉSTAMOS SÍ/NO ──
function setPres(v) {
  PRESVAL = v;
  document.getElementById('presno').className = 'ynb' + (v === 'no' ? ' ano' : '');
  document.getElementById('pressi').className = 'ynb' + (v === 'si' ? ' asi' : '');

  var det = document.getElementById('pres-detalle');
  det.classList.toggle('vis', v === 'si');

  var hw = document.getElementById('exp-hist-wrap');
  hw.classList.toggle('vis', v === 'si');

  if (v === 'no') {
    document.getElementById('expc').value = '0';
    ATVAL = 'no';
    document.getElementById('atno').className = 'ynb ano';
    document.getElementById('atsi').className = 'ynb';
    document.getElementById('atd').classList.remove('vis');
    ['prod-tarjeta', 'prod-personal', 'prod-vehiculo', 'prod-hipoteca'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('sel');
    });
    document.getElementById('antcred').value = 'nunca';
  }
}

// ── MORA ──
function setAt(v) {
  ATVAL = v;
  document.getElementById('atno').className = 'ynb' + (v === 'no' ? ' ano' : '');
  document.getElementById('atsi').className = 'ynb' + (v === 'si' ? ' asi' : '');
  document.getElementById('atd').classList.toggle('vis', v === 'si');
  if (v === 'no') {
    document.getElementById('attyp').value = '';
    var atpatWrap = document.getElementById('atpat-wrap');
    if (atpatWrap) atpatWrap.style.display = 'none';
  }
}

function setCDAt(v) {
  CDATVAL = v;
  document.getElementById('cdatno').className = 'ynb' + (v === 'no' ? ' ano' : '');
  document.getElementById('cdatsi').className = 'ynb' + (v === 'si' ? ' asi' : '');
  document.getElementById('cdatd').classList.toggle('vis', v === 'si');
  if (v === 'no') {
    document.getElementById('cdattyp').value = '';
    var cdatpatWrap = document.getElementById('cdatpat-wrap');
    if (cdatpatWrap) cdatpatWrap.style.display = 'none';
  }
}

// ── MONEDA ──
function TM() {
  return MR === 'USD' ? TUSD : TDOP;
}

function TH() {
  var pctDOP = (TDOP * 12 * 100).toFixed(2);
  var pctUSD = (TUSD * 12 * 100).toFixed(2);
  return MR === 'USD' ? 'Tasa ref. ' + pctUSD + '% anual (préstamos USD en RD)' : 'Tasa ref. ' + pctDOP + '% anual';
}

function fmt(d) {
  return MR === 'USD' ? '$' + Math.round(d / TC).toLocaleString('en-US') : 'RD$' + Math.round(d).toLocaleString('en-US');
}

function fmtr(d) {
  return MR === 'USD' ? 'aprox. RD$' + Math.round(d).toLocaleString('en-US') : 'aprox. $' + Math.round(d / TC).toLocaleString('en-US') + ' USD';
}

function setM(m) {
  MR = m;
  document.getElementById('mdop').classList.toggle('act', m === 'DOP');
  document.getElementById('musd').classList.toggle('act', m === 'USD');
  updPx();

  var mp = document.getElementById('mprecio');
  if (mp) {
    mp.value = m;
    updPrecio();
  }
}

function updMon() {
  var p = document.getElementById('pais').value;
  var d = DC.indexOf(p) >= 0;
  document.getElementById('ming').value = d ? 'USD' : 'DOP';
  setM(d ? 'USD' : 'DOP');
  document.getElementById('mprecio').value = d ? 'USD' : 'DOP';
  updPrecio();
}

function updPx() {
  var s = MR === 'USD' ? '$' : 'RD$';
  ['pxi', 'pxd', 'pxcdi', 'pxcdd', 'pxact'].forEach(function (id) {
    var e = document.getElementById(id);
    if (e) e.textContent = s;
  });
}

function updPrecio() {
  var mp = document.getElementById('mprecio').value;
  var s = mp === 'USD' ? '$' : 'RD$';
  document.getElementById('pxp').textContent = s;
  document.getElementById('pxini').textContent = s;
  autoIni();
}

function autoIni() {
  var vinmRaw = pn('vinm');
  if (!vinmRaw) return;
  var ini10 = Math.round(vinmRaw * 0.10);
  var iniEl = document.getElementById('ini');
  if (iniEl) {
    iniEl.value = ini10.toLocaleString('en-US');
  }
}

function togT() {
  TOK = !TOK;
  document.getElementById('tck').classList.toggle('on', TOK);
  document.getElementById('bcalc').disabled = !TOK;
}

function togCon() {
  COK = !COK;
  document.getElementById('conck').classList.toggle('on', COK);
  document.getElementById('benv').disabled = !COK;
}

function toggleTheme() {
  var d = document.getElementById('thtog').checked;
  document.body.classList.toggle('dark', d);
  document.getElementById('thlbl').textContent = d ? '🌙 Oscuro' : '☀️ Claro';
}

function openM() {
  var dopEl = document.getElementById('tasaDopTxt');
  var usdEl = document.getElementById('tasaUsdTxt');
  if (dopEl) dopEl.textContent = (TDOP * 12 * 100).toFixed(2) + '%';
  if (usdEl) usdEl.textContent = (TUSD * 12 * 100).toFixed(2) + '%';
  document.getElementById('modal').classList.add('open');
}

function closeM() {
  document.getElementById('modal').classList.remove('open');
}

function togCD() {
  var on = document.getElementById('cdtog').checked;
  document.getElementById('cds').classList.toggle('vis', on);
  if (!on) {
    CDATVAL = null;
    document.getElementById('cdatno').className = 'ynb';
    document.getElementById('cdatsi').className = 'ynb';
    document.getElementById('cdatd').classList.remove('vis');
  }
}

function scrollToForm() {
  showS(1);
  document.getElementById('fa').scrollIntoView({ behavior: 'smooth' });
}

function volverInicio(e) {
  if (e) e.preventDefault();
  scrollToForm();
}

function ssc() {
  window.scrollTo({ top: document.getElementById('fa').offsetTop - 86, behavior: 'smooth' });
}

// ── NAVEGACIÓN ──
function showS(n) {
  document.querySelectorAll('.sc').forEach(function (c) {
    c.classList.remove('act');
  });

  var eid = n === 'r' ? 'sr' : n === 's' ? 'success' : 'step-' + n;
  var el = document.getElementById(eid);
  if (el) el.classList.add('act');

  var sp = (n === 'r' || n === 's');
  document.getElementById('pw').style.display = sp ? 'none' : 'block';

  if (!sp) {
    document.getElementById('plbl').textContent = 'Paso ' + n + ' de 3';
    document.getElementById('pnam').textContent = SNMS[n] || '';
    document.getElementById('pfill').style.width = (n / 3 * 100) + '%';
  }
}

function ns(f) {
  if (!chk(f)) return;
  showS(f + 1);
  ssc();
}

function ps(f) {
  showS(f - 1);
  ssc();
}

function chk(s) {
  var m = { 1: ['edad', 'pais', 'ming'], 2: ['emp', 'ant', 'ing', 'deu'], 3: ['tinm', 'vinm', 'ini'] };
  var zeroOk = ['deu', 'cdd'];

  ['ing', 'deu', 'vinm', 'ini', 'cdi', 'cdd', 'activos'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.value) fn(el);
  });

  var ok = true;

  (m[s] || []).forEach(function (id) {
    var el = document.getElementById(id);
    var v = el ? el.value.trim() : '';
    var empty = !v;
    var isZero = (v === '0');

    if (empty || (isZero && zeroOk.indexOf(id) < 0)) {
      el.style.borderColor = 'var(--red)';
      el.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)';
      ok = false;
    } else {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    }
  });

  if (s === 2) {
    if (PRESVAL === null) {
      document.getElementById('presno').style.outline = '2px solid var(--red)';
      setTimeout(function () {
        document.getElementById('presno').style.outline = '';
      }, 2500);
      ok = false;
    }

    if (PRESVAL === 'si') {
      if (!document.getElementById('expc').value) {
        var ep = document.getElementById('expc');
        ep.style.borderColor = 'var(--red)';
        ep.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)';
        ok = false;
      }

      if (ATVAL === null) {
        document.getElementById('atno').style.outline = '2px solid var(--red)';
        setTimeout(function () {
          document.getElementById('atno').style.outline = '';
        }, 2500);
        ok = false;
      }

      if (ATVAL === 'si' && !document.getElementById('attyp').value) {
        var el2 = document.getElementById('attyp');
        el2.style.borderColor = 'var(--red)';
        el2.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)';
        ok = false;
      }

      if (ATVAL === 'si' && document.getElementById('attyp').value && !document.getElementById('atpat').value) {
        var el3 = document.getElementById('atpat');
        el3.style.borderColor = 'var(--red)';
        el3.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)';
        ok = false;
      }
    }
  }

  // Validar co-deudor si está activado (paso 3)
  if (s === 3 && document.getElementById('cdtog').checked) {
    var cdiEl = document.getElementById('cdi');
    var cdiVal = cdiEl ? pn('cdi') : 0;
    if (!cdiVal) {
      if (cdiEl) { cdiEl.style.borderColor = 'var(--red)'; cdiEl.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)'; }
      ok = false;
    }
    if (CDATVAL === null) {
      var cdatnoEl = document.getElementById('cdatno');
      if (cdatnoEl) { cdatnoEl.style.outline = '2px solid var(--red)'; setTimeout(function(){ cdatnoEl.style.outline=''; }, 2500); }
      ok = false;
    }
    if (CDATVAL === 'si' && !document.getElementById('cdattyp').value) {
      var cdattypEl = document.getElementById('cdattyp');
      if (cdattypEl) { cdattypEl.style.borderColor = 'var(--red)'; cdattypEl.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)'; }
      ok = false;
    }
    if (CDATVAL === 'si' && document.getElementById('cdattyp').value && parseInt(document.getElementById('cdattyp').value) > 30 && !document.getElementById('cdatpat').value) {
      var cdatpatEl = document.getElementById('cdatpat');
      if (cdatpatEl) { cdatpatEl.style.borderColor = 'var(--red)'; cdatpatEl.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)'; }
      ok = false;
    }
  }

  // Validaciones de precio mínimo e inicial mínimo (solo paso 3)
  if (s === 3) {
    var mp3 = document.getElementById('mprecio').value;
    var mpR3 = mp3 === 'USD' ? TC : 1;
    var vinmVal = pn('vinm') * mpR3;
    var iniVal = pn('ini') * mpR3;

    var precioMinUsd = PRECIO_MIN_USD;
    var precioMinDOP = precioMinUsd * TC;

    var vinmErrEl = document.getElementById('vinm-err');
    var iniErrEl = document.getElementById('ini-err');

    if (vinmErrEl) vinmErrEl.style.display = 'none';
    if (iniErrEl) iniErrEl.style.display = 'none';

    if (vinmVal > 0 && vinmVal < precioMinDOP) {
      var montoMinFmt = mp3 === 'USD'
        ? '$' + Math.round(precioMinUsd).toLocaleString('en-US') + ' USD'
        : 'RD$' + Math.round(precioMinDOP).toLocaleString('en-US');
      if (vinmErrEl) {
        vinmErrEl.textContent = '⚠️ El precio mínimo de una vivienda para financiamiento hipotecario en República Dominicana ronda los ' + montoMinFmt + '. Esta es una calculadora hipotecaria profesional.';
        vinmErrEl.style.display = 'block';
      }
      var vinmEl = document.getElementById('vinm');
      if (vinmEl) { vinmEl.style.borderColor = 'var(--red)'; vinmEl.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)'; }
      ok = false;
    }

    if (vinmVal >= precioMinDOP && iniVal > 0 && iniVal < vinmVal * 0.10) {
      var ini10DOP = vinmVal * 0.10;
      var ini10Fmt = mp3 === 'USD'
        ? '$' + Math.round(ini10DOP / TC).toLocaleString('en-US') + ' USD'
        : 'RD$' + Math.round(ini10DOP).toLocaleString('en-US');
      if (iniErrEl) {
        iniErrEl.textContent = '⚠️ El inicial mínimo requerido para un financiamiento hipotecario es el 10% del valor del inmueble (' + ini10Fmt + ').';
        iniErrEl.style.display = 'block';
      }
      var iniEl2 = document.getElementById('ini');
      if (iniEl2) { iniEl2.style.borderColor = 'var(--red)'; iniEl2.style.boxShadow = '0 0 0 3px rgba(192,22,28,.12)'; }
      ok = false;
    }
  }

  if (!ok) {
    var c = document.getElementById('step-' + s);
    if (c && !c.querySelector('.em')) {
      var em = document.createElement('div');
      em.className = 'em';
      em.style.cssText = 'color:var(--red);font-size:12px;text-align:center;margin-top:5px;';
      em.textContent = 'Completa todos los campos requeridos.';
      c.querySelector('.bp').insertAdjacentElement('afterend', em);
      setTimeout(function () {
        em.remove();
      }, 3000);
    }
  }

  return ok;
}

// Motor de scoring movido al servidor (/app/api/calcular/route.ts)

function scoreFn_DEAD(prDOP, iniDOP, ingTot, deuDOP, deuCDDOP, pais, emp, ant, expc, antCred, prods, atraw, atpat, activosNum, edad, tieneCD, ingCD, ingDOP, expcCD, antCredCD, prodsCD, atrawCD, atpatCD, empCD, antCD, paisCD, tuvoPres) {
  var tm = TM();
  var cDOP = prDOP > 0 ? (prDOP * tm) / (1 - Math.pow(1 + tm, -240)) : 0;
  var activosDOP = activosNum || 0;
  var ingEff = ingTot + activosDOP;
  var dTot = deuDOP + cDOP + deuCDDOP;
  var dti = ingEff > 0 ? dTot / ingEff : 1;
  var vinmDOP = prDOP + iniDOP;
  var ltv = vinmDOP > 0 ? prDOP / vinmDOP : 1;
  var pUSD = prDOP / TC;
  var nr = pUSD < 8000 ? 1 : pUSD < 25000 ? 2 : pUSD < 50000 ? 3 : pUSD < 100000 ? 4 : 5;

  // 1. Capacidad de endeudamiento — usa parámetros remotos si disponibles
  var pD = P_DTI_SCORE(dti);

  // 2. Historial de pagos — usa parámetros remotos si disponibles
  var pAt = P_MORA_SCORE(atraw, atpat, tuvoPres);
  var pAtCD = tieneCD ? P_MORA_SCORE(atrawCD, atpatCD, atrawCD > 0) : 100;
  var pAtFinal = tieneCD ? (pAt * 0.60 + pAtCD * 0.40) : pAt;

  var moraRec = (tuvoPres && atraw > 30 && atpat !== 'unico');
  var moraRecCD = (tieneCD && atrawCD > 30 && atpatCD !== 'unico');

  // 3. Experiencia crediticia — usa parámetros remotos si disponibles
  var brTit = nr - expc;
  var pMtoTit = P_EXP_MONTO_SCORE(brTit);
  var pAntCred = tuvoPres ? P_EXP_ANT_SCORE(antCred) : 0;
  var pProdTit = tuvoPres ? P_EXP_PROD_SCORE(prods) : 0;
  var pExpTit = pMtoTit * 0.50 + pAntCred * 0.30 + pProdTit * 0.20;
  if (brTit >= 3) pExpTit = Math.min(40, pExpTit);

  var pExpCD = 0;
  if (tieneCD) {
    var brCD = nr - expcCD;
    var pMtoCD = P_EXP_MONTO_SCORE(brCD);
    var pAntCredCD2 = P_EXP_ANT_SCORE(antCredCD);
    var pProdCD = P_EXP_PROD_SCORE(prodsCD);
    pExpCD = pMtoCD * 0.50 + pAntCredCD2 * 0.30 + pProdCD * 0.20;
    if (brCD >= 3) pExpCD = Math.min(40, pExpCD);
  }
  var pExp = tieneCD ? (pExpTit * 0.70 + pExpCD * 0.30) : pExpTit;

  // 4. Inicial / monto financiado — usa parámetros remotos si disponibles
  var pL = P_LTV_SCORE(ltv);

  // 5. Nivel de ingresos — usa parámetros remotos si disponibles
  var pI = P_ING_SCORE(ingEff);

  // 6. Estabilidad laboral — usa parámetros remotos si disponibles
  var pEsTit = P_EST_ANT_SCORE(ant) * 0.50 + P_EST_TIPO_SCORE(emp) * 0.50;
  var pEsCD = 0;
  if (tieneCD && empCD) pEsCD = P_EST_ANT_SCORE(antCD) * 0.50 + P_EST_TIPO_SCORE(empCD) * 0.50;
  var pEs = tieneCD && empCD ? (pEsTit * 0.70 + pEsCD * 0.30) : pEsTit;

  // 7. País — usa parámetros remotos si disponibles
  var pP = P_PAIS_SCORE(pais);

  // 8. Activos adicionales, Edad — usa parámetros remotos si disponibles
  var pAct = P_ACT_SCORE(activosDOP, ingDOP);
  var pEd = P_EDAD_SCORE(edad);

  // Pesos — usa parámetros remotos si disponibles
  var sc = pD * GET_PESO('dti') + pAtFinal * GET_PESO('mora') + pExp * GET_PESO('exp') + pL * GET_PESO('ltv') + pI * GET_PESO('ing') + pEs * GET_PESO('est') + pP * GET_PESO('pais') + pAct * GET_PESO('act') + pEd * GET_PESO('edad');
  sc = Math.round(Math.min(96, Math.max(5, sc)));

  // Tope máximo por mora recurrente — no puede salir Alta/Muy Alta
  if (moraRec) sc = Math.min(sc, P_TOPE_MORA(atraw, atpat, tuvoPres));
  if (moraRecCD) sc = Math.min(sc, 74);

  return {
    sc: sc, dti: dti, ltv: ltv, cDOP: cDOP,
    pD: pD, pL: pL, pI: pI, pAt: pAt, pAtFinal: pAtFinal,
    pExp: pExp, pExpTit: pExpTit, pEs: pEs, pAct: pAct, pP: pP, pEd: pEd, ingEff: ingEff, dTot: dTot,
    atraw: atraw, atpat: atpat
  };
}

function bdg(s) {
  if (s >= 90) return { c: 'b-vh', t: 'Muy Alta Probabilidad', m: 'Perfil excelente. Estás listo para aplicar.', k: '#10B981' };
  if (s >= 80) return { c: 'b-h', t: 'Alta Probabilidad', m: 'Muy buen perfil. Las posibilidades son altas.', k: '#0F766E' };
  if (s >= 70) return { c: 'b-m', t: 'Probabilidad Moderada', m: 'Perfil aceptable. Varias entidades podrían aprobarte.', k: '#F0A500' };
  if (s >= 60) return { c: 'b-l', t: 'Probabilidad Baja', m: 'Hay áreas importantes por mejorar.', k: '#F97316' };
  return { c: 'b-vl', t: 'Probabilidad Muy Baja', m: 'Tu perfil necesita mejoras significativas.', k: '#EF4444' };
}

// credPerfil movido al servidor (/app/api/calcular/route.ts)

function anim(rid, pid, sc, col) {
  var circ = 2 * Math.PI * 22;
  var r = document.getElementById(rid);
  r.style.stroke = col;
  setTimeout(function () {
    r.style.strokeDashoffset = circ * (1 - sc / 100);
  }, 80);

  var c = 0;
  var el = document.getElementById(pid);
  var iv = setInterval(function () {
    c = Math.min(sc, c + 2);
    el.textContent = c + '%';
    el.style.color = col;
    if (c >= sc) clearInterval(iv);
  }, 18);
}


function calc() {
  if (!TOK) { openM(); return; }
  if (!chk(3)) return;
  var bcalc = document.getElementById('bcalc');
  if (bcalc) bcalc.disabled = true;

  var edad = parseFloat(document.getElementById('edad').value) || 0;
  var pais = document.getElementById('pais').value;
  var emp = document.getElementById('emp').value;
  var ant = document.getElementById('ant').value;
  var tuvoPres = (PRESVAL === 'si');
  var expc = tuvoPres ? (parseInt(document.getElementById('expc').value) || 0) : 0;
  var antCred = tuvoPres ? (document.getElementById('antcred').value || 'nunca') : 'nunca';
  var prods = tuvoPres ? getProds('prod') : ['ninguno'];
  var atraw = (!tuvoPres || ATVAL === 'no') ? 0 : (parseInt(document.getElementById('attyp').value) || 30);
  var atpat = atraw > 0 ? (document.getElementById('atpat').value || 'unico') : 'na';
  var tieneCD = document.getElementById('cdtog').checked;
  var activos = pn('activos');

  var rIn = MR === 'USD' ? TC : 1;
  var ingDOP = pn('ing') * rIn;
  var deuDOP = pn('deu') * rIn;
  var ingCDDOP = tieneCD ? pn('cdi') * rIn : 0;
  var deuCDDOP = tieneCD ? pn('cdd') * rIn : 0;
  var expcCD = tieneCD ? (parseInt(document.getElementById('cdexpc').value) || 0) : 0;
  var antCredCD = tieneCD ? (document.getElementById('cdantcred').value || 'nunca') : 'nunca';
  var prodsCD = tieneCD ? getProds('cdprod') : ['ninguno'];
  var atrawCD = tieneCD && CDATVAL !== null ? (CDATVAL === 'no' ? 0 : parseInt(document.getElementById('cdattyp').value) || 30) : 0;
  var atpatCD = atrawCD > 30 && tieneCD ? (document.getElementById('cdatpat').value || 'unico') : 'na';
  var empCD = tieneCD ? (document.getElementById('cdemp').value || '') : '';
  var antCD = tieneCD ? (document.getElementById('cdant').value || '') : '';
  var paisCD = tieneCD ? (document.getElementById('cdpais').value || '') : '';

  var mp = document.getElementById('mprecio').value;
  var mpR = mp === 'USD' ? TC : 1;
  var vinmDOP = pn('vinm') * mpR;
  var iniDOP = pn('ini') * mpR;

  fetch('/api/calcular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      edad: edad, pais: pais, emp: emp, ant: ant, tuvoPres: tuvoPres,
      expc: expc, antCred: antCred, prods: prods,
      atraw: atraw, atpat: atpat, tieneCD: tieneCD, activos: activos,
      ingDOP: ingDOP, deuDOP: deuDOP, ingCDDOP: ingCDDOP, deuCDDOP: deuCDDOP,
      expcCD: expcCD, antCredCD: antCredCD, prodsCD: prodsCD,
      atrawCD: atrawCD, atpatCD: atpatCD, empCD: empCD, antCD: antCD, paisCD: paisCD,
      vinmDOP: vinmDOP, iniDOP: iniDOP, mr: MR
    })
  }).then(function (r) { return r.json(); }).then(function (res) {
    if (res.error) { if (bcalc) bcalc.disabled = false; return; }

    if (res.tc) TC = res.tc;
    if (res.tdop) TDOP = res.tdop;
    if (res.tusd) TUSD = res.tusd;
    if (res.virDOPMin) PRECIO_MIN_USD = Math.round(res.virDOPMin / TC);

    POPUP_ACTIVO = res.popupActivo !== false;
    applyUIParams(res.contadorVisible !== false);

    sendWebhook('calculo', {
      e1: res.e1, e2: res.e2,
      vinmDOP: vinmDOP, prDOP: res.prDOP, iniDOP: iniDOP, virDOP: res.virDOP, mrDOP: res.mrDOP, isiDOP: res.isiDOP,
      perfil: {
        ingDOP: ingDOP, deuDOP: deuDOP, emp: emp, ant: ant,
        pais: pais, edad: edad, tuvoPres: tuvoPres, atraw: atraw, atpat: atpat, expc: expc,
        antCred: antCred, prods: prods, activos: activos, tieneCD: tieneCD, ingCDDOP: ingCDDOP
      },
      monedaRes: MR
    }, null);

    SD = {
      e1: res.e1, e2: res.e2, why: res.why, sims: res.sims, cp: res.cp,
      vinmDOP: vinmDOP, iniDOP: iniDOP, prDOP: res.prDOP, mrDOP: res.mrDOP, virDOP: res.virDOP, isiDOP: res.isiDOP,
      ingTot: ingDOP + ingCDDOP, deuDOP: deuDOP, deuCDDOP: deuCDDOP,
      pais: pais, emp: emp, ant: ant, expc: expc, antCred: antCred, prods: prods,
      atraw: atraw, atpat: atpat, activos: activos, edad: edad, tuvoPres: tuvoPres,
      tieneCD: tieneCD, ingCDDOP: ingCDDOP, ingDOP: ingDOP,
      expcCD: expcCD, antCredCD: antCredCD, prodsCD: prodsCD,
      atrawCD: atrawCD, atpatCD: atpatCD, empCD: empCD, antCD: antCD, paisCD: paisCD,
      e2Reached: res.e2Reached, rIn: rIn, mp: mp, virDOPMin: res.virDOPMin, e2NoViable: res.e2NoViable
    };

    render();
  }).catch(function (err) {
    console.error('Error al calcular:', err);
    if (bcalc) bcalc.disabled = false;
  });
}

function buildWhy_DEAD(e, antCred, tuvoPres, activos, pais, edad) {
  var w = [];

  if (e.pD >= 85) w.push({ t: 'ok', x: 'Excelente capacidad de endeudamiento', s: 'El porcentaje de tus ingresos que va a deudas es ' + Math.round(e.dti * 100) + '%. Esta dentro del rango ideal (menos del 33%).' });
  else if (e.pD >= 72) w.push({ t: 'ok', x: 'Buena capacidad de endeudamiento', s: 'El porcentaje de endeudamiento es ' + Math.round(e.dti * 100) + '%. Dentro del rango aceptable (33-40%). Hay margen con buen perfil general.' });
  else if (e.pD >= 45) w.push({ t: 'w', x: 'Capacidad de endeudamiento ajustada', s: 'El porcentaje de endeudamiento es ' + Math.round(e.dti * 100) + '%. Supera el 40% maximo aceptado. Reducir deudas mejoraría tu perfil.' });
  else w.push({ t: 'b', x: 'Capacidad de endeudamiento insuficiente', s: 'El porcentaje de endeudamiento es ' + Math.round(e.dti * 100) + '%. Muy por encima del limite. Es el principal obstaculo.' });

  if (!tuvoPres) {
    w.push({ t: 'w', x: 'Sin historial de prestamos previos', s: 'No haber tenido prestamos antes puede requerir un co-deudor con experiencia. Con buenos ingresos y estabilidad, muchos bancos aprueban con condiciones.' });
  } else if (!e.atraw || e.atraw === 0) {
    w.push({ t: 'ok', x: 'Historial de pagos impecable', s: 'Sin atrasos registrados. Es uno de los factores mas valorados por las entidades financieras.' });
  } else {
    var aislado = e.atpat === 'unico';
    var diasTxt = e.atraw === 30 ? 'de hasta 30 dias' : e.atraw === 45 ? 'de 31 a 60 dias' : 'de mas de 60 dias';
    if (e.atraw === 30 && aislado) {
      w.push({ t: 'w', x: 'Atraso leve registrado', s: 'Hubo un atraso ' + diasTxt + ', evento aislado. Es justificable pero mantener los pagos al dia es clave.' });
    } else if (aislado) {
      w.push({ t: 'w', x: 'Mora mayor - evento aislado', s: 'Un atraso ' + diasTxt + ' ocurrio una sola vez. Puede justificarse con historial limpio posterior.' });
    } else {
      w.push({ t: 'b', x: 'Mora mayor recurrente', s: 'Patron de atrasos ' + diasTxt + ' que se repitio. Este factor reduce significativamente la probabilidad.' });
    }
  }

  if (e.pExpTit >= 80) w.push({ t: 'ok', x: 'Experiencia crediticia solida', s: 'Tu historial es compatible con el monto que solicitas.' });
  else if (e.pExpTit >= 40) w.push({ t: 'w', x: 'Experiencia crediticia limitada para este monto', s: 'Con buen ingreso y pagos al dia, un co-deudor con experiencia en montos similares puede completar el perfil.' });
  else w.push({ t: 'w', x: 'Poca experiencia crediticia', s: 'Con buenos ingresos y estabilidad, un co-deudor con historial puede resolver esta brecha.' });

  if (e.pL >= 88) w.push({ t: 'ok', x: 'Inicial muy favorable', s: 'Tu inicial representa el ' + Math.round(100 - e.ltv * 100) + '% del valor. Reduce el riesgo del banco.' });
  else if (e.pL >= 70) w.push({ t: 'ok', x: 'Inicial adecuada', s: 'Tu inicial cubre el ' + Math.round(100 - e.ltv * 100) + '% del valor. Dentro del rango preferido.' });
  else if (e.pL >= 42) w.push({ t: 'w', x: 'Inicial en el limite minimo', s: 'Tu inicial cubre el ' + Math.round(100 - e.ltv * 100) + '% del valor. Aumentarla mejoraría directamente tu probabilidad y reduciría la cuota mensual.' });
  else w.push({ t: 'b', x: 'Inicial insuficiente', s: 'Tu inicial cubre solo el ' + Math.round(100 - e.ltv * 100) + '% del valor. La mayoria de entidades requieren al menos el 20%.' });

  if (e.pEs >= 80) w.push({ t: 'ok', x: 'Estabilidad laboral comprobable', s: 'Tu tipo de empleo y antiguedad generan confianza en los evaluadores.' });
  else if (e.pEs >= 55) w.push({ t: 'w', x: 'Estabilidad laboral aceptable', s: 'Mas de 2 años en el mismo empleo mejoraría tu evaluación.' });
  else w.push({ t: 'b', x: 'Estabilidad laboral limitada', s: 'Menos de 1 ano en el empleo actual es un factor limitante para varias entidades.' });

  if (e.pI >= 87) w.push({ t: 'ok', x: 'Nivel de ingresos alto', s: 'Tu ingreso mensual neto esta entre los mas favorables para calificar a montos hipotecarios mayores.' });
  else if (e.pI >= 50) w.push({ t: 'w', x: 'Nivel de ingresos moderado', s: 'Tu ingreso cubre el perfil estandar. Un ingreso mayor mejoraría tu probabilidad.' });
  else w.push({ t: 'b', x: 'Nivel de ingresos limitado', s: 'Tu ingreso mensual neto esta por debajo del rango mas favorable para el monto solicitado.' });

  // Pais de residencia y edad no se muestran aqui: son factores de ponderacion
  // interna del modelo, pero exponerlos como "razon" del resultado podria
  // interpretarse como un criterio discriminatorio hacia el usuario.

  if (activos > 0) w.push({ t: 'ok', x: 'Ingresos adicionales declarados', s: 'Tus ingresos complementarios suman a tu capacidad de pago efectiva.' });
  else w.push({ t: 'w', x: 'No declaraste ingresos adicionales', s: 'Si recibes alquileres, remesas u otros ingresos verificables, declararlos podria mejorar tu probabilidad.' });

  return w;
}

function buildSims(e1, prDOP, iniDOP, ingTot, deuDOP, deuCDDOP, tieneCD, atraw, atpat, tuvoPres, pais, emp, ant, expc, antCred, prods, edad, ingDOP, activos) {
  var s = e1.sc, sims = [];

  if (deuDOP > 0) {
    var tm = TM();
    var cDOP = prDOP > 0 ? (prDOP * tm) / (1 - Math.pow(1 + tm, -240)) : 0;
    var d2 = (deuDOP * 0.5 + cDOP + deuCDDOP) / Math.max(ingTot, 1);
    var pD2 = P_DTI_SCORE(d2);
    var dl = Math.round(Math.min(95, s - e1.pD * GET_PESO('dti') + pD2 * GET_PESO('dti')) - s);
    if (dl > 0) sims.push({ l: 'Reduces tus deudas actuales en un 50%', d: dl, b: Math.min(95, s + dl) });
  }

  // Co-deudor: simulamos un perfil de apoyo modesto (40% del ingreso del titular,
  // empleo formal, sin atrasos) y recalculamos con el motor real en vez de un % fijo.
  if (!tieneCD) {
    var ingCDsim = Math.round(ingDOP * 0.40);
    var eCD = scoreFn(prDOP, iniDOP, ingTot + ingCDsim, deuDOP, 0, pais, emp, ant, expc, antCred, prods, atraw, atpat, activos, edad, true, ingCDsim, ingDOP, 2, '1a3', ['tarjeta'], 0, 'na', 'formal', '2a5', pais, tuvoPres);
    var dlCD = Math.round(Math.min(95, eCD.sc) - s);
    if (dlCD > 0) sims.push({ l: 'Agregas un co-deudor con ingresos y buen historial al perfil combinado', d: dlCD, b: Math.min(95, s + dlCD) });
  }

  if (e1.pExpTit < 80 && tuvoPres) {
    var dl3 = Math.round(Math.min(95, s - e1.pExp * GET_PESO('exp') + 100 * GET_PESO('exp')) - s);
    if (dl3 > 0) sims.push({ l: 'Construyes historial crediticio en el rango del monto solicitado', d: dl3, b: Math.min(95, s + dl3) });
  }

  if (atraw > 0 && tuvoPres) {
    var dl4 = Math.round(Math.min(95, s - e1.pAtFinal * GET_PESO('mora') + 100 * GET_PESO('mora')) - s);
    if (dl4 > 0) sims.push({ l: 'Mantienes pagos al dia por 12 meses consecutivos', d: dl4, b: Math.min(95, s + dl4) });
  }

  // Inicial: simulamos 5 puntos porcentuales adicionales de inicial sobre el valor del inmueble
  if (e1.pL < 88) {
    var ltvActual = e1.ltv;
    var ltvSim = Math.max(0, ltvActual - 0.05);
    var pL2 = P_LTV_SCORE(ltvSim);
    var dl5 = Math.round(Math.min(95, s - e1.pL * GET_PESO('ltv') + pL2 * GET_PESO('ltv')) - s);
    if (dl5 > 0) sims.push({ l: 'Aumentas tu inicial en 5 puntos porcentuales adicionales', d: dl5, b: Math.min(95, s + dl5) });
  }

  if (!activos || activos <= 0) {
    var actBase = REMOTE_PARAMS ? REMOTE_PARAMS.act.noDeclara : 41;
    var actSim = REMOTE_PARAMS ? REMOTE_PARAMS.act.menos10 : 57;
    var dl6 = Math.round(Math.min(95, s - actBase * GET_PESO('act') + actSim * GET_PESO('act')) - s);
    if (dl6 > 0) sims.push({ l: 'Declaras ingresos adicionales verificables', d: dl6, b: Math.min(95, s + dl6) });
  }

  if (sims.length === 0) sims.push({ l: 'Tu perfil esta bien optimizado', d: 0, b: s });

  return sims;
}

function render() {
  var e1 = SD.e1, e2 = SD.e2, why = SD.why, sims = SD.sims, cp = SD.cp;
  var th = TH();

  document.getElementById('e1p').textContent = fmt(SD.vinmDOP);
  document.getElementById('e1pr').textContent = fmtr(SD.vinmDOP);

  document.getElementById('e1f').textContent = fmt(SD.prDOP);
  document.getElementById('e1fr').textContent = fmtr(SD.prDOP);

  document.getElementById('e1i').textContent = fmt(SD.iniDOP);
  document.getElementById('e1ir').textContent = fmtr(SD.iniDOP);

  document.getElementById('e1c').textContent = fmt(e1.cDOP) + '/mes';
  document.getElementById('e1cr').textContent = fmtr(e1.cDOP) + '/mes';

  document.getElementById('e1th').textContent = th;

  var b1 = bdg(e1.sc);
  anim('r1', 'p1', e1.sc, b1.k);

  document.getElementById('b1').className = 'sbdg ' + b1.c;
  document.getElementById('b1').textContent = b1.t;
  document.getElementById('m1').textContent = b1.m;

  document.getElementById('cred-tag').className = 'cred-perfil ' + cp.c;
  document.getElementById('cred-tag').textContent = cp.t;

  var wh = { ok: '✓', w: '⚠', b: '✕' }, wc = { ok: 'wok', w: 'www', b: 'wbd' };

  document.getElementById('wl1').innerHTML = why.map(function (w) {
    return '<div class="witem"><div class="wic ' + wc[w.t] + '">' + wh[w.t] + '</div><div class="wtxt">' + w.x + '<small>' + w.s + '</small></div></div>';
  }).join('');

  var si = e1.sc < 80;
  document.getElementById('slwrap').style.display = si ? 'block' : 'none';
  document.getElementById('simsec').style.display = si ? 'block' : 'none';

  if (si) {
    var curPct = Math.round((SD.iniDOP / (SD.vinmDOP || 1)) * 100);
    document.getElementById('sli').value = Math.max(10, Math.min(50, curPct));
    updSl();

    document.getElementById('simlist').innerHTML = sims.map(function (s) {
      return '<div class="simc"><div class="simr"><div class="simlbl">' + s.l + '</div>' + (s.d > 0 ? '<div class="simdlt">+' + s.d + '%</div>' : '') + '</div><div class="simbar"><div class="simbf" style="width:' + s.b + '%"></div></div></div>';
    }).join('');
  }

  var showE2 = e1.sc < 80 && SD.e2 && SD.e2.sc >= 80;
  document.getElementById('e2wrap').style.display = showE2 ? 'block' : 'none';

  var bo1 = document.getElementById('btn-ofertas-e1');
  if (bo1) {
    if (e1.sc >= 70) {
      bo1.textContent = '🏠 Quiero recibir ofertas dentro de mi mejor probabilidad de aprobación';
      bo1.style.background = '';
      bo1.style.boxShadow = '';
    } else {
      bo1.textContent = '🤝 Quiero asesoria para mejorar mi perfil crediticio';
      bo1.style.background = b1.k;
      bo1.style.boxShadow = '0 4px 15px ' + b1.k + '4D';
    }
  }

  QUIERE_OFERTAS = false;
  document.getElementById('ofertasck').classList.remove('on');
  document.getElementById('ofertas-row').style.display = 'none';

  if (showE2) {
    var e2Insuficiente = SD.mrDOP <= 0 || e2.sc < 80;
    var e2box = document.getElementById('e2box');
    var e2lbl = document.getElementById('e2lbl');
    var bo2 = document.getElementById('btn-ofertas-e2');
    var aBox = document.getElementById('asesor-wrap');

    if (e2Insuficiente) {
      // Ni reduciendo el precio del inmueble el perfil alcanza una probabilidad real.
      // No mostramos una propiedad "sugerida" enganosa: solo recomendamos asesoria.
      e2box.style.display = 'none';
      if (bo2) bo2.style.display = 'none';
      e2lbl.textContent = '📋 Recomendación para tu perfil';
      e2lbl.style.color = '';

      var topFIns = [];
      if (e1.pExpTit < 50) topFIns.push('Construir historial crediticio en el rango del monto solicitado');
      if (e1.pAt < 70) topFIns.push('Mantener pagos al dia de forma consistente');
      if (e1.pD < 72) topFIns.push('Reducir las deudas actuales para mejorar la capacidad de pago');
      if (e1.pEs < 55) topFIns.push('Aumentar antiguedad laboral o formalizar el tipo de empleo');
      if (topFIns.length === 0) topFIns.push('Fortalecer el perfil financiero en las areas indicadas');

      var fHTMLIns = topFIns.slice(0, 2).map(function (f) {
        return '<li>' + f + '</li>';
      }).join('');

      var cdBtnIns = !SD.tieneCD ? '<button class="btn-cd-suggest" onclick="irCd()">Agregar un co-deudor para complementar tu experiencia crediticia</button>' : '';

      aBox.innerHTML = '<div class="asesor-box"><h4>Aun no encontramos una propiedad realista con tu perfil</h4><p>Ni reduciendo el monto del inmueble tu perfil actual alcanza una probabilidad aceptable. Antes de buscar propiedad, te recomendamos fortalecer estos puntos:</p><ul class="asesor-actions">' + fHTMLIns + '</ul>' + cdBtnIns + '<button class="btn-asesor" onclick="irLead()">Habla con un asesor de Perfect House - te ayudamos a mejorar tu perfil crediticio</button></div>';
      aBox.style.display = 'block';
    } else {
      e2box.style.display = '';
      e2lbl.textContent = '✅ Escenario 2 — Tu mejor opción con el inicial que tienes disponible';
      e2lbl.style.color = '#059669';

      document.getElementById('e2p').textContent = fmt(SD.virDOP);
      document.getElementById('e2pr').textContent = fmtr(SD.virDOP);

      document.getElementById('e2f').textContent = fmt(SD.mrDOP);
      document.getElementById('e2fr').textContent = fmtr(SD.mrDOP);

      document.getElementById('e2i').textContent = fmt(SD.isiDOP);
      document.getElementById('e2ir').textContent = fmtr(SD.isiDOP);

      document.getElementById('e2c').textContent = fmt(e2.cDOP) + '/mes';
      document.getElementById('e2cr').textContent = fmtr(e2.cDOP) + '/mes';

      document.getElementById('e2th').textContent = th;

      var b2 = bdg(e2.sc);
      anim('r2', 'p2', e2.sc, b2.k);

      document.getElementById('b2').className = 'sbdg ' + b2.c;
      document.getElementById('b2').textContent = b2.t;

      if (bo2) bo2.style.display = 'flex';

      var e2msg = document.getElementById('m2');
      if (e2msg) {
        var msgE2 = '';
        if (e2.sc >= 85) msgE2 = 'Con esta propiedad tu probabilidad es alta. Es una opción realista hoy.';
        else if (e2.sc >= 70) msgE2 = 'Esta propiedad mejora tus posibilidades respecto al Escenario 1.';
        else msgE2 = 'Esta propiedad mejora tu probabilidad, aunque aun no es la ideal.';
        e2msg.textContent = msgE2;
      }

      if (!SD.e2Reached) {
        var topF = [];
        if (e1.pExpTit < 50) topF.push('Construir historial crediticio en el rango del monto solicitado');
        if (e1.pAt < 70) topF.push('Mantener pagos al dia de forma consistente');
        if (e1.pD < 72) topF.push('Reducir las deudas actuales para mejorar la capacidad de pago');
        if (e1.pEs < 55) topF.push('Aumentar antiguedad laboral o formalizar el tipo de empleo');
        if (topF.length === 0) topF.push('Fortalecer el perfil financiero en las areas indicadas');

        var fHTML = topF.slice(0, 2).map(function (f) {
          return '<li>' + f + '</li>';
        }).join('');

        var cdBtn = !SD.tieneCD ? '<button class="btn-cd-suggest" onclick="irCd()">Agregar un co-deudor para complementar tu experiencia crediticia</button>' : '';

        aBox.innerHTML = '<div class="asesor-box"><h4>Tu mejor escenario con el perfil actual</h4><p>Basado en tu información, esta es la propiedad con mayor probabilidad hoy. Para alcanzar una probabilidad más alta, estas acciones concretas marcarían la diferencia:</p><ul class="asesor-actions">' + fHTML + '</ul>' + cdBtn + '<button class="btn-asesor" onclick="irLead()">Habla con un asesor de Perfect House - te ayudamos a preparar tu perfil</button></div>';

        aBox.style.display = 'block';
      } else {
        aBox.style.display = 'none';
        aBox.innerHTML = '';
      }
    }
  }

  renderResumen();

  actualizarContador();
  actualizarContadorSolicitudes();

  var lt = document.getElementById('lead-title');
  var lm = document.getElementById('lead-msg');

  if (lt && lm) {
    if (e1.sc >= 80) {
      lt.textContent = 'Estas listo para aplicar!';
      lm.textContent = 'Tu perfil tiene alta probabilidad de aprobación. Un asesor te contacta hoy para guiarte en el proceso.';
    } else if (e1.sc >= 70) {
      lt.textContent = 'Un asesor te ayuda a cerrar la brecha';
      lm.textContent = 'Tu perfil es aceptable. Con algunos ajustes puedes mejorar significativamente tu probabilidad.';
    } else if (e1.sc >= 60) {
      lt.textContent = 'Trabajemos juntos en tu perfil';
      lm.textContent = 'Hay areas que mejorar, pero con orientacion correcta puedes calificar en 6-12 meses.';
    } else {
      lt.textContent = 'Prepara tu perfil con nosotros';
      lm.textContent = 'Tu perfil actual necesita mejoras. Un asesor de Perfect House puede ayudarte a crear un plan.';
    }
  }

  document.querySelectorAll('.sc').forEach(function (c) {
    c.classList.remove('act');
  });

  document.getElementById('sr').classList.add('act');

  var fabShare = document.getElementById('fab-share');
  if (fabShare) fabShare.style.display = 'block';

  document.getElementById('pw').style.display = 'none';

  COK = false;
  document.getElementById('conck').classList.remove('on');
  document.getElementById('benv').disabled = true;

  setTimeout(function () {
    var target = document.getElementById('e1-anchor');
    if (target) {
      var y = target.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      ssc();
    }
  }, 150);

  clearTimeout(_popupTimer);
  if (e1.sc >= 70) {
    _popupTimer = setTimeout(function () { showLeadPopup(e1.sc, false); }, 2500);
  } else if (showE2 && SD.e2 && SD.e2.sc >= 80) {
    _popupTimer = setTimeout(function () { showLeadPopup(SD.e2.sc, true); }, 2500);
  }
}

function closeLeadPopup() {
  var p = document.getElementById('lead-popup');
  if (p) p.style.display = 'none';
}

function showLeadPopup(sc, isE2) {
  if (!POPUP_ACTIVO) return;
  var color, badge, title, sub, body;
  if (sc >= 90) {
    color = '#059669';
    badge = '★ Muy Alta Probabilidad';
    title = isE2 ? '¡Encontramos una propiedad con excelente probabilidad para ti!' : '¡Tu perfil es excelente! Estás listo para aplicar';
    sub = isE2 ? 'Con una propiedad ajustada a tu perfil' : 'Perfil excelente. Las puertas están abiertas';
    body = isE2 ? 'Identificamos una opción de propiedad donde tu probabilidad de aprobación es excelente. Un asesor te muestra los detalles.' : 'Con este resultado las entidades financieras verán tu expediente con muy buenos ojos. ¡No pierdas esta oportunidad!';
  } else if (sc >= 80) {
    color = '#0F766E';
    badge = 'Alta Probabilidad';
    title = isE2 ? 'Encontramos una opción con alta probabilidad de aprobación' : 'Tu perfil tiene alta probabilidad de aprobación';
    sub = isE2 ? 'Con una propiedad ajustada a tu perfil' : 'Las posibilidades son muy altas';
    body = isE2 ? 'Hay una propiedad donde tu perfil clasifica con alta probabilidad. Nuestros asesores te acompañan desde el primer paso.' : 'Muy buen perfil. Estás en una posición sólida para iniciar el proceso. Nuestros asesores te acompañarán desde el inicio hasta el cierre.';
  } else {
    color = '#0E7490';
    badge = 'Probabilidad Moderada';
    title = 'Tu perfil puede clasificar para financiamiento';
    sub = 'Varias entidades podrían aprobarte hoy';
    body = 'Con este perfil ya puedes explorar opciones reales. Un asesor puede ayudarte a presentarte ante la entidad correcta y aumentar tus probabilidades.';
  }

  var p = document.getElementById('lead-popup');
  var head = document.getElementById('lead-popup-head');
  var circle = document.getElementById('lead-popup-circle');
  var cta = document.getElementById('lead-popup-cta');
  if (!p) return;

  document.getElementById('lead-popup-badge').textContent = badge;
  document.getElementById('lead-popup-title').textContent = title;
  document.getElementById('lead-popup-score').textContent = sc;
  document.getElementById('lead-popup-sub').textContent = sub;
  document.getElementById('lead-popup-body').textContent = body;
  head.style.background = color;
  circle.style.border = '3px solid rgba(255,255,255,0.5)';
  cta.style.background = color;

  p.style.display = 'flex';
}

function irCd() {
  showS(3);
  ssc();
  setTimeout(function () {
    document.getElementById('cdtog').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 400);
}

function irLead() {
  var el = document.getElementById('lead-title') || document.getElementById('lcard');
  if (!el) return;
  var header = document.querySelector('header');
  var headerH = header ? header.getBoundingClientRect().height : 0;
  var targetY = window.pageYOffset + el.getBoundingClientRect().top - headerH - 12;
  window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
}

function renderResumen() {
  var empMap = { formal: 'Empleado formal', independiente: 'Independiente', empresario: 'Empresario', remesa: 'Diaspora', pension: 'Pensionado' };
  var antMap = { menos1: 'Menos de 1 ano', '1a2': '1-2 anos', '2a5': '2-5 anos', mas5: 'Mas de 5 anos' };
  var atMap = { 0: 'Sin atrasos', 30: 'Atraso leve (<30 dias)', 45: 'Atraso moderado (31-60 dias)', 90: 'Atraso grave (>60 dias)' };

  var rIn = SD.rIn || 1;

  var items = [
    { l: 'Ingreso mensual', v: fmt(SD.ingDOP) + '/mes' },
    { l: 'Deudas mensuales', v: fmt(SD.deuDOP) + '/mes' },
    { l: 'Precio ingresado', v: fmt(SD.vinmDOP) },
    { l: 'Inicial disponible', v: fmt(SD.iniDOP) },
    { l: 'Tipo de empleo', v: empMap[SD.emp] || SD.emp },
    { l: 'Antiguedad laboral', v: antMap[SD.ant] || SD.ant },
    { l: 'Ha tenido prestamos', v: SD.tuvoPres ? 'Si' : 'No' },
    { l: 'Historial de pago', v: SD.tuvoPres ? (atMap[SD.atraw] || 'Sin atrasos') : 'No aplica' },
    { l: 'Productos usados', v: SD.tuvoPres ? (SD.prods || ['ninguno']).join(', ') : 'Ninguno' },
  ];

  if (SD.activos > 0) items.push({ l: 'Ingresos adicionales', v: fmt(SD.activos * rIn) + '/mes' });

  document.getElementById('sum-grid').innerHTML = items.map(function (it) {
    return '<div class="sum-item"><div class="sum-lbl">' + it.l + '</div><div class="sum-val">' + it.v + '</div></div>';
  }).join('');

  var cdWrap = document.getElementById('sum-cd-wrap');

  if (cdWrap) {
    if (SD.tieneCD) {
      var empMapCD = { formal: 'Empleado formal', independiente: 'Independiente', empresario: 'Empresario', remesa: 'Diaspora', pension: 'Pensionado' };
      var antMapCD = { menos1: 'Menos de 1 ano', '1a2': '1-2 anos', '2a5': '2-5 anos', mas5: 'Mas de 5 anos' };
      var atMapCD = { 0: 'Sin atrasos', 30: 'Atraso leve (<30d)', 45: 'Atraso moderado (31-60d)', 90: 'Atraso grave (>60d)' };

      var cdItems = [
        { l: 'Ingreso mensual', v: fmt(SD.ingCDDOP) + '/mes' },
        { l: 'Deudas mensuales', v: fmt(SD.deuCDDOP) + '/mes' },
        { l: 'Actividad economica', v: empMapCD[SD.empCD] || SD.empCD || '-' },
        { l: 'Antiguedad laboral', v: antMapCD[SD.antCD] || SD.antCD || '-' },
        { l: 'Pais', v: SD.paisCD || '-' },
        { l: 'Historial de pago', v: atMapCD[SD.atrawCD] || 'Sin atrasos' },
        { l: 'Productos usados', v: (SD.prodsCD || ['ninguno']).join(', ') },
      ];

      cdWrap.style.display = 'block';

      document.getElementById('sum-cd-grid').innerHTML = cdItems.map(function (it) {
        return '<div class="sum-item"><div class="sum-lbl">' + it.l + '</div><div class="sum-val">' + it.v + '</div></div>';
      }).join('');
    } else {
      cdWrap.style.display = 'none';
    }
  }
}

function togSum() {
  var b = document.getElementById('sum-body');
  var a = document.getElementById('sum-arrow');
  var open = b.classList.toggle('open');
  a.classList.toggle('open', open);
}

var _slTimer = null;
function updSl() {
  var pct = parseInt(document.getElementById('sli').value);
  document.getElementById('slpct').textContent = pct + '%';

  var vinmDOP = SD.vinmDOP || 0;
  var niDOP = Math.round(vinmDOP * pct / 100);
  var npDOP = Math.max(0, vinmDOP - niDOP);

  document.getElementById('slini').textContent = fmt(niDOP);
  document.getElementById('slfi').textContent = fmt(npDOP);

  clearTimeout(_slTimer);
  _slTimer = setTimeout(function () {
    fetch('/api/calcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edad: SD.edad, pais: SD.pais, emp: SD.emp, ant: SD.ant, tuvoPres: SD.tuvoPres,
        expc: SD.expc, antCred: SD.antCred || 'nunca', prods: SD.prods,
        atraw: SD.atraw, atpat: SD.atpat, tieneCD: SD.tieneCD, activos: SD.activos,
        ingDOP: SD.ingDOP, deuDOP: SD.deuDOP, ingCDDOP: SD.ingCDDOP, deuCDDOP: SD.deuCDDOP,
        expcCD: SD.expcCD, antCredCD: SD.antCredCD || 'nunca', prodsCD: SD.prodsCD || ['ninguno'],
        atrawCD: SD.atrawCD, atpatCD: SD.atpatCD, empCD: SD.empCD, antCD: SD.antCD, paisCD: SD.paisCD,
        vinmDOP: vinmDOP, iniDOP: niDOP, mr: MR, sliderOnly: true
      })
    }).then(function (r) { return r.json(); }).then(function (res) {
      document.getElementById('slcu').textContent = fmt(res.cDOP || 0);
      var col = res.sc >= 80 ? '#10B981' : res.sc >= 70 ? '#F0A500' : '#EF4444';
      var pr = document.getElementById('slpr');
      pr.textContent = (res.sc || 0) + '%';
      pr.style.color = col;
    }).catch(function () {});
  }, 300);
}

function enviar() {
  var n = document.getElementById('lnom').value.trim();
  var t = document.getElementById('ltel').value.trim();

  var dt = document.getElementById('ldoc').value;
  var dn = document.getElementById('ldocn').value.trim();

  if (!n || !t) {
    alert('Por favor ingresa tu nombre y telefono de WhatsApp.');
    return;
  }

  if (!dt || !dn) {
    alert('El tipo y numero de documento son requeridos.');
    return;
  }

  if (!COK) {
    alert('Debes autorizar el tratamiento de datos para continuar.');
    return;
  }

  var lead = {
    nombre: n,
    apellido: document.getElementById('lape').value,
    tel: t,
    email: document.getElementById('lem').value,
    docTipo: dt,
    docNum: dn
  };

  sendWebhook('contacto', { quiereOfertas: QUIERE_OFERTAS }, lead);

  document.getElementById('sr').classList.remove('act');
  document.getElementById('success').classList.add('act');
  ssc();
  actualizarContadorSolicitudes();
}

function reinit() {
  clearTimeout(_popupTimer);
  closeLeadPopup();
  ['sr', 'success'].forEach(function (id) {
    document.getElementById(id).classList.remove('act');
  });

  document.querySelectorAll('input:not([type=range]),select').forEach(function (el) {
    el.value = '';
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });

  document.querySelectorAll('.prod-opt').forEach(function (el) {
    el.classList.remove('sel');
  });

  document.getElementById('cdtog').checked = false;
  document.getElementById('cds').classList.remove('vis');

  TOK = false;
  COK = false;
  PRESVAL = null;
  ATVAL = null;
  CDATVAL = null;

  document.getElementById('tck').classList.remove('on');
  document.getElementById('bcalc').disabled = true;

  document.getElementById('presno').className = 'ynb';
  document.getElementById('pressi').className = 'ynb';

  document.getElementById('pres-detalle').classList.remove('vis');
  document.getElementById('exp-hist-wrap').classList.remove('vis');

  document.getElementById('atno').className = 'ynb';
  document.getElementById('atsi').className = 'ynb';
  document.getElementById('atd').classList.remove('vis');

  document.getElementById('cdatno').className = 'ynb';
  document.getElementById('cdatsi').className = 'ynb';
  document.getElementById('cdatd').classList.remove('vis');

  ['r1', 'r2'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.style.strokeDashoffset = '138.2';
      el.style.stroke = '';
    }
  });

  ['p1', 'p2'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = '0%';
      el.style.color = '';
    }
  });

  setM('DOP');
  SD = {};
  showS(1);
  document.getElementById('pw').style.display = 'block';
  scrollToForm();

  var fabShare = document.getElementById('fab-share');
  if (fabShare) fabShare.style.display = 'none';
}

function compartir() {
  if (!SD || !SD.e1) return;

  var e1 = SD.e1;
  var nivelTxt = function (sc) {
    return sc >= 90 ? 'Muy alta ✅' : sc >= 80 ? 'Alta ✅' : sc >= 70 ? 'Moderada 🟡' : sc >= 60 ? 'Baja 🟠' : 'Muy baja 🔴';
  };

  var txt = '🏠 Mi precalificación en PrecalificateRD\n\n';
  txt += '📋 Escenario 1 — La propiedad que quieres\n';
  txt += '💰 Propiedad evaluada: ' + fmt(SD.vinmDOP) + '\n';
  txt += '🏦 Monto a financiar: ' + fmt(SD.prDOP) + '\n';
  txt += '📅 Cuota mensual estimada: ' + fmt(e1.cDOP) + '\n';
  txt += '📊 Probabilidad de aprobación: ' + e1.sc + '% (' + nivelTxt(e1.sc) + ')\n';

  var showE2 = e1.sc < 80;
  var e2Insuficiente = !SD.e2 || SD.mrDOP <= 0 || SD.e2.sc < 80;
  if (showE2 && !e2Insuficiente) {
    txt += '\n✅ Escenario 2 — Tu mejor opción con el inicial que tienes disponible\n';
    txt += '💰 Propiedad sugerida: ' + fmt(SD.virDOP) + '\n';
    txt += '🏦 Monto a financiar: ' + fmt(SD.mrDOP) + '\n';
    txt += '📊 Probabilidad de aprobación: ' + SD.e2.sc + '% (' + nivelTxt(SD.e2.sc) + ')\n';
  }

  if (SD.why && SD.why.length) {
    var wh = { ok: '✓', w: '⚠', b: '✕' };
    txt += '\n🔍 ¿Por qué este resultado?\n';
    SD.why.forEach(function (w) {
      txt += (wh[w.t] || '•') + ' ' + w.x + '\n';
    });
  }

  if (SD.sims && SD.sims.length) {
    var simsConMejora = SD.sims.filter(function (s) { return s.d > 0; });
    if (simsConMejora.length) {
      txt += '\n📈 Acciones que podrían mejorar tu probabilidad:\n';
      simsConMejora.forEach(function (s) {
        txt += '+' + s.d + '% ' + s.l + '\n';
      });
    }
  }

  txt += '\nMe he evaluado en *PrecalificateRD*, accede y has tu precalificación ¡totalmente gratis y sin acceder a tu score!\n';
  txt += 'https://precalificaterd.com';

  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}

// -- LOCALSTORAGE -- guardar datos del formulario
function saveForm() {
  try {
    var data = {
      edad: document.getElementById('edad').value,
      pais: document.getElementById('pais').value,
      ming: document.getElementById('ming').value,
      mr: MR,
      emp: document.getElementById('emp').value,
      ant: document.getElementById('ant').value,
      ing: document.getElementById('ing').value,
      deu: document.getElementById('deu').value,
      activos: document.getElementById('activos').value,
      presval: PRESVAL,
      expc: document.getElementById('expc').value,
      antcred: document.getElementById('antcred').value,
      atval: ATVAL,
      attyp: document.getElementById('attyp').value,
      atpat: document.getElementById('atpat').value,
      tinm: document.getElementById('tinm').value,
      mprecio: document.getElementById('mprecio').value,
      vinm: document.getElementById('vinm').value,
      ini: document.getElementById('ini').value,
    };

    localStorage.setItem('precalRD_form', JSON.stringify(data));
  } catch (e) {}
}

function loadForm() {
  try {
    var raw = localStorage.getItem('precalRD_form');
    if (!raw) return;

    var d = JSON.parse(raw);

    var zeroAllowed = ['deu', 'cdd', 'activos'];
    var set = function (id, val) {
      var el = document.getElementById(id);
      if (el && (val || zeroAllowed.indexOf(id) >= 0)) el.value = val || '';
    };

    set('edad', d.edad);
    set('pais', d.pais);
    set('ming', d.ming);

    set('emp', d.emp);
    set('ant', d.ant);

    set('ing', d.ing);
    set('deu', d.deu);
    set('activos', d.activos);

    set('expc', d.expc);
    set('antcred', d.antcred);

    set('attyp', d.attyp);
    set('atpat', d.atpat);

    set('tinm', d.tinm);
    set('mprecio', d.mprecio);

    set('vinm', d.vinm);
    set('ini', d.ini);

    if (d.mr) setM(d.mr);
    if (d.presval) setPres(d.presval);
    if (d.atval) setAt(d.atval);
    if (d.pais) updMon();

    ['ing', 'deu', 'activos', 'vinm', 'ini'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.value) fn(el);
    });

    var banner = document.getElementById('restore-banner');
    if (banner) banner.style.display = 'flex';
  } catch (e) {}
}

function clearSaved() {
  try {
    localStorage.removeItem('precalRD_form');
  } catch (e) {}

  var banner = document.getElementById('restore-banner');
  if (banner) banner.style.display = 'none';
}

// Auto-save al calcular
var _origCalc = calc;
calc = function () {
  saveForm();
  _origCalc();
};

// -- WEBHOOK -- envia datos a Supabase
function sendWebhook(tipo, data, lead) {
  try {
    if (!SUPA_URL || !SUPA_KEY) return;

    if (tipo === 'calculo') {
      var newId = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(16) + Math.random().toString(16).slice(2)));

      var body = {
        id: newId,
        session_id: SESSION_ID,
        tipo: 'calculo',
        moneda_resultado: data.monedaRes,
        vinm_dop: data.vinmDOP,
        pr_dop: data.prDOP,
        ini_dop: data.iniDOP,
        cuota_dop: data.e1.cDOP,
        dti: data.e1.dti,
        score_e1: data.e1.sc,
        score_e2: data.e2 ? data.e2.sc : null,
        vir_dop: data.virDOP || 0,
        mr_dop: data.mrDOP || 0,
        ing_dop: data.perfil.ingDOP,
        deu_dop: data.perfil.deuDOP,
        empleo: data.perfil.emp,
        antiguedad_laboral: data.perfil.ant,
        pais: data.perfil.pais,
        edad: data.perfil.edad,
        tuvo_prestamos: data.perfil.tuvoPres,
        atraso_dias: data.perfil.atraw,
        atraso_patron: data.perfil.atpat,
        exp_monto: data.perfil.expc,
        antiguedad_credito: data.perfil.antCred,
        productos: data.perfil.prods,
        activos_dop: data.perfil.activos,
        tiene_codeudor: data.perfil.tieneCD,
        ingreso_codeudor_dop: data.perfil.ingCDDOP
      };

      LAST_CALC_ID = newId;

      fetch(SUPA_URL + '/rest/v1/precalifica_calculos', {
        method: 'POST',
        headers: supaHeaders({ 'Prefer': 'return=minimal' }),
        body: JSON.stringify(body)
      }).catch(function (err) {
        console.log('Supabase calculo error:', err);
      });
    } else if (tipo === 'contacto') {
      var leadBody = {
        calculo_id: LAST_CALC_ID,
        session_id: SESSION_ID,
        nombre: lead.nombre,
        apellido: lead.apellido,
        telefono: lead.tel,
        email: lead.email,
        doc_tipo: lead.docTipo,
        doc_numero: lead.docNum,
        quiere_ofertas: !!data.quiereOfertas
      };

      fetch(SUPA_URL + '/rest/v1/precalifica_leads', {
        method: 'POST',
        headers: supaHeaders({ 'Prefer': 'return=minimal' }),
        body: JSON.stringify(leadBody)
      }).catch(function (err) {
        console.log('Supabase lead error:', err);
      });

      fetch('/api/notify-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: lead, quiereOfertas: !!data.quiereOfertas, sd: SD })
      }).catch(function (err) {
        console.log('Notify lead error:', err);
      });
    }
  } catch (err) {
    console.log('sendWebhook err:', err);
  }
}

// -- CONTADOR DE CONSULTAS --
function actualizarContador() {
  fetchContadorReal();
}

function mostrarContador(n) {
  var el = document.getElementById('contador-consultas');
  if (el && n > 0) el.textContent = Number(n).toLocaleString('en-US');
}

function fetchContadorReal() {
  if (!SUPA_URL || !SUPA_KEY) return;

  fetch(SUPA_URL + '/rest/v1/rpc/contar_precalificaciones', {
    method: 'POST',
    headers: supaHeaders({})
  }).then(function (r) { return r.json(); }).then(function (total) {
    if (!isNaN(total) && total > 0) mostrarContador(total);
  }).catch(function (err) {
    console.log('Contador fetch error:', err);
  });
}

// -- CONTADOR DE SOLICITUDES --
function actualizarContadorSolicitudes() {
  fetchSolicitudesReal();
}

function mostrarContadorSolicitudes(n) {
  var el = document.getElementById('contador-solicitudes');
  if (el && n > 0) el.textContent = Number(n).toLocaleString('en-US');
}

function fetchSolicitudesReal() {
  if (!SUPA_URL || !SUPA_KEY) return;

  fetch(SUPA_URL + '/rest/v1/rpc/contar_solicitudes', {
    method: 'POST',
    headers: supaHeaders({})
  }).then(function (r) { return r.json(); }).then(function (total) {
    if (!isNaN(total) && total > 0) mostrarContadorSolicitudes(total);
  }).catch(function (err) {
    console.log('Solicitudes fetch error:', err);
  });
}

// -- BOTON OFERTAS --
var QUIERE_OFERTAS = false;

function solicitarOfertas(escenario) {
  QUIERE_OFERTAS = true;

  var esAsesoria = escenario === 1 && SD.e1.sc < 70;
  var txt = document.getElementById('ofertas-text');
  if (txt) {
    txt.textContent = esAsesoria
      ? '🤝 Deseo recibir asesoría para mejorar mi perfil crediticio'
      : '🏠 Deseo recibir ofertas de propiedades dentro de mi rango de precio';
  }

  document.getElementById('ofertasck').classList.add('on');
  document.getElementById('ofertas-row').style.display = 'flex';

  irLead();

  var btn = document.getElementById('btn-ofertas-e' + escenario);
  if (btn) {
    btn.textContent = 'Registrado! Completa tus datos abajo';
    btn.style.background = esAsesoria ? bdg(SD.e1.sc).k : '#065F46';
  }
}

function togOfertas() {
  QUIERE_OFERTAS = !QUIERE_OFERTAS;
  document.getElementById('ofertasck').classList.toggle('on', QUIERE_OFERTAS);
}

// -- CONFIGURACION UI --
function applyUIParams(contadorVisible) {
  var solEl = document.getElementById('contador-solicitudes');
  if (solEl) {
    var solBlk = solEl.parentElement;
    if (solBlk) solBlk.style.display = contadorVisible ? '' : 'none';
  }
}

// Parámetros y funciones de scoring removidos del cliente — ver /app/api/calcular/route.ts

// -- INICIALIZACION --
function initPrecal() {
  var modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === this) closeM();
    });
  }

  setTimeout(loadForm, 300);
  fetchContadorReal();
  fetchSolicitudesReal();
}

if (typeof window !== 'undefined') {
  window.initPrecal = initPrecal;
}
