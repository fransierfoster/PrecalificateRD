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

function bdg(s) {
  if (s >= 90) return { c: 'b-vh', t: 'Muy Alta Probabilidad', m: 'Perfil excelente. Estás listo para aplicar.', k: '#10B981' };
  if (s >= 80) return { c: 'b-h', t: 'Alta Probabilidad', m: 'Muy buen perfil. Las posibilidades son altas.', k: '#0F766E' };
  if (s >= 70) return { c: 'b-m', t: 'Probabilidad Moderada', m: 'Perfil aceptable. Varias entidades podrían aprobarte.', k: '#F0A500' };
  if (s >= 60) return { c: 'b-l', t: 'Probabilidad Baja', m: 'Hay áreas importantes por mejorar.', k: '#F97316' };
  return { c: 'b-vl', t: 'Probabilidad Muy Baja', m: 'Tu perfil necesita mejoras significativas.', k: '#EF4444' };
}

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

  var pdfSec = document.getElementById('pdf-section');
  var pdfBtn = document.getElementById('btn-pdf');
  if (pdfSec) pdfSec.style.display = 'block';

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
  trackEvent('form_submit');
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

  var ape = document.getElementById('lape').value.trim();
  var emailVal = document.getElementById('lem').value.trim();

  var lead = {
    nombre: n,
    apellido: ape,
    tel: t,
    email: emailVal,
    docTipo: dt,
    docNum: dn
  };

  sendWebhook('contacto', { quiereOfertas: QUIERE_OFERTAS, tipo: PDF_MODE ? 'pdf' : 'asesoria' }, lead);

  document.getElementById('sr').classList.remove('act');
  document.getElementById('success').classList.add('act');
  ssc();
  actualizarContadorSolicitudes();

  if (PDF_MODE) {
    var cedTxt = (dt === 'cedula' ? 'Cédula' : 'Pasaporte') + ': ' + dn;
    generarPDF(n, ape, cedTxt, t, emailVal);
  }
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
  PDF_MODE = false;
  QUIERE_OFERTAS = false;
  var benvR = document.getElementById('benv');
  if (benvR) benvR.textContent = '✅ Quiero que me contacten';

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
  var pdfSecR = document.getElementById('pdf-section');
  if (pdfSecR) pdfSecR.style.display = 'none';
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
      e2Reached: res.e2Reached, rIn: rIn, mp: mp, virDOPMin: res.virDOPMin, e2NoViable: res.e2NoViable,
      tinm: document.getElementById('tinm').value
    };

    render();
  }).catch(function (err) {
    console.error('Error al calcular:', err);
    if (bcalc) bcalc.disabled = false;
  });
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
        quiere_ofertas: !!data.quiereOfertas,
        tipo: data.tipo || 'asesoria'
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

function trackEvent(nombre) {
  if (!SUPA_URL || !SUPA_KEY) return;
  if (new URLSearchParams(window.location.search).get('test') === '1') return;
  var sid = sessionStorage.getItem('precal_sid');
  if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('precal_sid', sid); }
  fetch(SUPA_URL + '/rest/v1/precalifica_eventos', {
    method: 'POST',
    headers: supaHeaders({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify({ session_id: sid, evento: nombre })
  }).catch(function() {});
}

function solicitarOfertas(escenario) {
  trackEvent('click_asesoria');
  QUIERE_OFERTAS = true;
  PDF_MODE = false;
  var benvEl = document.getElementById('benv');
  if (benvEl) benvEl.textContent = '✅ Quiero que me contacten';

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

// -- PDF REPORT --
var PDF_MODE = false;

function activarModoPDF() {
  trackEvent('click_pdf');
  PDF_MODE = true;
  var benv = document.getElementById('benv');
  if (benv) benv.textContent = '📄 Descargar mi reporte de evaluación';
  irLead();
}

function generarPDF(nom, ape, cedTxt, tel, email) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('El generador de PDF aún está cargando. Intenta en unos segundos.');
    return;
  }

  var btn = document.getElementById('benv');
  if (btn) { btn.textContent = 'Generando reporte…'; btn.disabled = true; }

  try {
    var JsPDF = window.jspdf.jsPDF;
    var doc = new JsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    var PW = 210;
    var mL = 18;
    var mR_pdf = 18;
    var cW = PW - mL - mR_pdf;
    var y = 0;

    var RED    = [192, 22, 28];
    var RED_L  = [254, 242, 242];
    var GRN    = [6, 95, 70];
    var GRN_L  = [240, 253, 244];
    var ORG    = [120, 53, 15];
    var ORG_BG = [255, 251, 235];
    var INK    = [26, 17, 16];
    var INK2   = [75, 66, 64];
    var INK3   = [122, 114, 112];
    var RULE   = [226, 222, 218];
    var BG     = [247, 244, 241];

    var refNum = 'PRC-' + new Date().getFullYear() + '-' + (LAST_CALC_ID || '').replace(/-/g, '').substring(0, 8).toUpperCase();
    var fecha  = new Date().toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
    var nombreCompleto = (nom || '') + (ape ? ' ' + ape : '');

    // ── Header ──
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, PW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('PrecalificateRD', mL, 10);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Perfect House SRL  ·  Santo Domingo, Rep. Dom.', mL, 15.5);
    doc.text('Tel: +1 (809) 775-3939  ·  precalificaterd.com', mL, 20);
    doc.setFontSize(7); doc.setTextColor(220, 180, 180);
    doc.text('No. DE REFERENCIA', PW - mR_pdf, 8.5, { align: 'right' });
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(refNum, PW - mR_pdf, 14, { align: 'right' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(210, 185, 185);
    doc.text(fecha, PW - mR_pdf, 19, { align: 'right' });

    y = 28;

    // ── Banner ──
    doc.setFillColor(ORG_BG[0], ORG_BG[1], ORG_BG[2]);
    doc.rect(0, y, PW, 7, 'F');
    doc.setDrawColor(252, 211, 77); doc.setLineWidth(0.3);
    doc.line(0, y + 7, PW, y + 7);
    doc.setTextColor(ORG[0], ORG[1], ORG[2]);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE EVALUACIÓN HIPOTECARIA PRELIMINAR — DOCUMENTO REFERENCIAL', PW / 2, y + 4.8, { align: 'center' });
    y = 35 + 4;

    // ── Recipient ──
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(nombreCompleto, mL, y); y += 5;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(INK3[0], INK3[1], INK3[2]);
    var recipLine = cedTxt + '   ·   WhatsApp: ' + tel;
    if (email) recipLine += '   ·   ' + email;
    doc.text(recipLine, mL, y); y += 4;
    doc.text('Santo Domingo, República Dominicana', mL, y); y += 7;
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.3);
    doc.line(mL, y, PW - mR_pdf, y); y += 5;

    // ── Saludo ──
    doc.setTextColor(INK2[0], INK2[1], INK2[2]);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    doc.text('Estimado/a ' + nom + ',', mL, y); y += 5.5;

    var p1Lines = doc.splitTextToSize('En atención a la evaluación preliminar realizada a través de la plataforma PrecalificateRD de Perfect House SRL, nos complace presentarle el siguiente reporte de evaluación hipotecaria basado en la información financiera suministrada por usted en fecha ' + fecha + '.', cW);
    doc.text(p1Lines, mL, y); y += p1Lines.length * 4.3 + 4;

    var p2Lines = doc.splitTextToSize('Este documento tiene carácter orientativo y no constituye una aprobación formal de crédito. Los resultados reflejan una estimación calculada con criterios similares a los utilizados por entidades financieras en la República Dominicana. Para iniciar un proceso formal de financiamiento, los ingresos declarados y demás informaciones suministradas deberán ser verificados y respaldados mediante la documentación.', cW);
    doc.text(p2Lines, mL, y); y += p2Lines.length * 4.3 + 6;

    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.line(mL, y, PW - mR_pdf, y); y += 6;

    function secHead(title, color) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(title, mL, y);
      doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(0.4);
      doc.line(mL, y + 1.5, PW - mR_pdf, y + 1.5);
      doc.setLineWidth(0.3); y += 7;
    }

    function fmtRD(v) { return 'RD$' + Math.round(v).toLocaleString('en-US'); }

    var empMap = { formal: 'Empleado formal (nómina fija)', independiente: 'Independiente / Freelance', empresario: 'Empresario', remesa: 'Diáspora', pension: 'Pensionado' };
    var antMap = { menos1: 'Menos de 1 año', '1a2': '1 – 2 años', '2a5': '2 – 5 años', mas5: 'Más de 5 años' };
    var antCredMap = { menos1: 'Menos de 1 año', '1a3': '1 – 3 años', '3a5': '3 – 5 años', mas5: 'Más de 5 años', nunca: 'Sin historial previo' };
    var tinmMap = { apartamento: 'Apartamento', casa: 'Casa / Villa', solar: 'Solar (terreno)', comercial: 'Propiedad comercial' };
    var paisMap = { DO: 'República Dominicana', US: 'Estados Unidos', PR: 'Puerto Rico', ES: 'España', CA: 'Canadá', PA: 'Panamá', EC: 'Ecuador', SV: 'El Salvador', BS: 'Bahamas', BB: 'Barbados', JM: 'Jamaica', TT: 'Trinidad y Tobago' };
    var tasaTxt = (TDOP * 12 * 100).toFixed(2) + '% anual';

    // I. Perfil del solicitante
    secHead('I.  PERFIL DEL SOLICITANTE', INK3);
    doc.autoTable({
      startY: y,
      body: [
        ['Edad', SD.edad + ' años'],
        ['País de residencia', paisMap[SD.pais] || SD.pais || 'República Dominicana'],
        ['Actividad económica', empMap[SD.emp] || SD.emp],
        ['Antigüedad laboral', antMap[SD.ant] || SD.ant],
        ['Ingreso mensual neto', fmtRD(SD.ingDOP)],
        ['Cuotas mensuales actuales', fmtRD(SD.deuDOP)],
        ['Historial de pagos', SD.atraw ? 'Con atrasos registrados' : 'Sin atrasos registrados'],
        ['Antigüedad crediticia', antCredMap[SD.antCred] || (SD.tuvoPres ? SD.antCred : 'No aplica')],
      ],
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: INK, lineColor: RULE, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: BG },
      columnStyles: { 0: { textColor: INK3, cellWidth: 58 }, 1: { fontStyle: 'bold' } },
      margin: { left: mL, right: mR_pdf },
    });
    y = doc.lastAutoTable.finalY + 8;

    var showE2pdf = !!(SD.e2 && SD.mrDOP > 0 && SD.e2.sc >= 80);
    var e1Sc = SD.e1.sc;
    var e1Col = e1Sc >= 80 ? GRN : e1Sc >= 70 ? [180, 100, 0] : RED;
    var e1Lbl = e1Sc >= 80 ? 'Alta Probabilidad' : e1Sc >= 70 ? 'Probabilidad Moderada' : 'Probabilidad Baja';
    var e1Verdict = e1Sc >= 80 ? 'Perfil viable con entidades financieras' : e1Sc >= 70 ? 'Requiere algunos ajustes' : 'Requiere ajustes en el perfil';

    var e1Rows = [
      ['Tipo de inmueble', tinmMap[SD.tinm] || 'Propiedad'],
      ['Valor del inmueble', fmtRD(SD.vinmDOP)],
      ['≈ en dólares', 'US$' + Math.round(SD.vinmDOP / TC).toLocaleString('en-US')],
      ['Inicial disponible', fmtRD(SD.iniDOP) + '\n(' + Math.round(SD.iniDOP / (SD.vinmDOP || 1) * 100) + '%)'],
      ['Monto a financiar', fmtRD(SD.prDOP)],
      ['Cuota mensual estimada', fmtRD(SD.e1.cDOP)],
      ['Tasa de referencia', tasaTxt],
      ['Plazo', '20 años'],
    ];

    if (showE2pdf) {
      // ── Side-by-side layout ──
      var colW = 84;
      var colGap = 6;
      var c1 = mL;
      var c2 = mL + colW + colGap;

      // Section headers
      function colHead(title, color, x) {
        var lines = doc.splitTextToSize(title, colW);
        doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(lines, x, y);
        var headH = lines.length * 3.8;
        doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(0.4);
        doc.line(x, y + headH, x + colW, y + headH);
        return headH;
      }
      var h1 = colHead('II.  ESCENARIO 1 — PROPIEDAD SOLICITADA', RED, c1);
      var h2 = colHead('III.  ESCENARIO 2 — PERFIL ÓPTIMO ACTUAL', GRN, c2);
      y += Math.max(h1, h2) + 5;

      var tabStartY = y;

      var e2Rows = [
        ['Tipo de inmueble', tinmMap[SD.tinm] || 'Propiedad'],
        ['Valor óptimo', fmtRD(SD.virDOP)],
        ['≈ en dólares', 'US$' + Math.round(SD.virDOP / TC).toLocaleString('en-US')],
        ['Inicial sugerida', fmtRD(SD.isiDOP) + '\n(' + Math.round(SD.isiDOP / (SD.virDOP || 1) * 100) + '%)'],
        ['Monto a financiar', fmtRD(SD.mrDOP)],
        ['Cuota mensual estimada', fmtRD(SD.e2.cDOP)],
        ['Tasa de referencia', tasaTxt],
        ['Plazo', '20 años'],
      ];

      var tblStyle = { fontSize: 7.5, cellPadding: { top: 2.3, bottom: 2.3, left: 3, right: 3 }, textColor: INK, lineColor: RULE, lineWidth: 0.2 };

      doc.autoTable({
        startY: tabStartY,
        body: e1Rows,
        theme: 'plain',
        styles: tblStyle,
        alternateRowStyles: { fillColor: RED_L },
        columnStyles: { 0: { textColor: INK3, cellWidth: 31 }, 1: { fontStyle: 'bold' } },
        margin: { left: c1, right: PW - c1 - colW },
        tableWidth: colW,
      });
      var e1FinalY = doc.lastAutoTable.finalY;

      doc.autoTable({
        startY: tabStartY,
        body: e2Rows,
        theme: 'plain',
        styles: tblStyle,
        alternateRowStyles: { fillColor: GRN_L },
        columnStyles: { 0: { textColor: INK3, cellWidth: 31 }, 1: { fontStyle: 'bold' } },
        margin: { left: c2, right: PW - c2 - colW },
        tableWidth: colW,
      });
      var e2FinalY = doc.lastAutoTable.finalY;

      y = Math.max(e1FinalY, e2FinalY) + 4;

      // Score pills side by side
      var pillH = 14;
      function drawPill(x, w, fillCol, sc, lbl, verdict, verdictCol) {
        doc.setFillColor(fillCol[0], fillCol[1], fillCol[2]);
        doc.roundedRect(x, y, w, pillH, 2, 2, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(INK2[0], INK2[1], INK2[2]);
        doc.text('Probabilidad estimada', x + 3, y + 4);
        doc.setFontSize(6.5); doc.setTextColor(INK3[0], INK3[1], INK3[2]);
        doc.text(lbl, x + 3, y + 7.5);
        doc.setFontSize(17); doc.setFont('helvetica', 'bold');
        doc.setTextColor(verdictCol[0], verdictCol[1], verdictCol[2]);
        doc.text(sc + '%', x + w - 3, y + 10, { align: 'right' });
      }
      drawPill(c1, colW, (e1Sc >= 80 ? GRN_L : RED_L), e1Sc, e1Lbl, e1Verdict, e1Col);
      drawPill(c2, colW, GRN_L, SD.e2.sc, 'Alta Probabilidad', 'Perfil viable con entidades financieras', GRN);

      y += pillH + 3;

      // Verdict text side by side
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.setTextColor(e1Col[0], e1Col[1], e1Col[2]);
      doc.text(e1Verdict, c1 + 3, y);
      doc.setTextColor(GRN[0], GRN[1], GRN[2]);
      doc.text('Perfil viable con entidades financieras', c2 + 3, y);
      y += 8;

    } else {
      // ── Full-width single scenario ──
      secHead('II.  ESCENARIO 1 — PROPIEDAD SOLICITADA', RED);
      doc.autoTable({
        startY: y,
        body: e1Rows,
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: INK, lineColor: RULE, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: RED_L },
        columnStyles: { 0: { textColor: INK3, cellWidth: 58 }, 1: { fontStyle: 'bold' } },
        margin: { left: mL, right: mR_pdf },
      });
      y = doc.lastAutoTable.finalY + 4;

      var pillFill = e1Sc >= 80 ? GRN_L : RED_L;
      doc.setFillColor(pillFill[0], pillFill[1], pillFill[2]);
      doc.roundedRect(mL, y, cW, 10, 2, 2, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(INK2[0], INK2[1], INK2[2]);
      doc.text('Probabilidad estimada', mL + 3, y + 4);
      doc.setFontSize(7); doc.setTextColor(INK3[0], INK3[1], INK3[2]);
      doc.text(e1Lbl, mL + 3, y + 7.5);
      doc.setFontSize(19); doc.setFont('helvetica', 'bold'); doc.setTextColor(e1Col[0], e1Col[1], e1Col[2]);
      doc.text(e1Sc + '%', PW - mR_pdf - 3, y + 7.8, { align: 'right' });
      y += 14;
    }

    var recLabel = showE2pdf ? 'IV.' : 'III.';
    if (y > 230) { doc.addPage(); y = 20; }
    secHead(recLabel + '  RECOMENDACIONES', ORG);

    var recs = [
      { n: '1', tit: 'Reducir endeudamiento', txt: 'Liquide o reduzca deudas actuales para aumentar su capacidad de pago.' },
      { n: '2', tit: 'Aumentar el inicial', txt: 'Incrementar el inicial del 20% al 30% reduciría el monto financiado y mejoraría directamente su probabilidad de aprobación.' },
      { n: '3', tit: 'Agregar un co-deudor', txt: 'Un co-deudor con ingresos verificables puede sumar entre 2% y 5% adicional a la probabilidad combinada.' },
    ];

    doc.setFillColor(ORG_BG[0], ORG_BG[1], ORG_BG[2]);
    var recStartY = y;
    var recTotalH = 0;
    recs.forEach(function(r) {
      var ls = doc.splitTextToSize(r.txt, cW - 14);
      recTotalH += ls.length * 4.2 + 10;
    });
    doc.roundedRect(mL, y, cW, recTotalH, 2, 2, 'F');
    doc.setDrawColor(252, 211, 77); doc.setLineWidth(0.6);
    doc.line(mL, y, mL, y + recTotalH);
    y += 4;

    recs.forEach(function(r) {
      doc.setFillColor(ORG[0], ORG[1], ORG[2]);
      doc.circle(mL + 5.5, y + 3, 2.8, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(r.n, mL + 5.5, y + 4, { align: 'center' });
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(r.tit, mL + 11, y + 3.5);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(INK2[0], INK2[1], INK2[2]);
      var ls = doc.splitTextToSize(r.txt, cW - 14);
      doc.text(ls, mL + 11, y + 7.5);
      y += ls.length * 4.2 + 10;
    });

    y = recStartY + recTotalH + 8;
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.3);
    doc.line(mL, y, PW - mR_pdf, y); y += 6;

    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(INK2[0], INK2[1], INK2[2]);
    var closingLines = doc.splitTextToSize('Quedamos a su disposición para acompañarle en el proceso de búsqueda, preparación del perfil e intermediación con las entidades financieras. En Perfect House SRL contamos con asesores hipotecarios especializados listos para orientarle sin costo adicional.', cW);
    doc.text(closingLines, mL, y); y += closingLines.length * 4.5 + 6;
    doc.text('Atentamente,', mL, y); y += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text('Perfect House SRL', mL, y); y += 5;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(INK3[0], INK3[1], INK3[2]);
    doc.text('Asesoría Hipotecaria Especializada', mL, y); y += 4;
    doc.text('precalificaterd.com  ·  +1 (809) 775-3939', mL, y); y += 10;

    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(mL, y, PW - mR_pdf, y); y += 4;
    doc.setFontSize(7); doc.setTextColor(INK3[0], INK3[1], INK3[2]);
    var legalLines = doc.splitTextToSize('Este documento fue generado automáticamente por PrecalificateRD y tiene carácter únicamente orientativo. No constituye una aprobación, oferta ni compromiso de financiamiento por parte de ninguna entidad bancaria ni de Perfect House SRL. Las tasas y condiciones son de referencia y pueden variar según la entidad financiera.', cW);
    doc.text(legalLines, mL, y); y += legalLines.length * 3.5 + 4;
    doc.text('Ref: ' + refNum, PW / 2, y, { align: 'center' });

    var fileName = 'reporte-hipotecario-' + nom.toLowerCase().replace(/\s+/g, '-') + '.pdf';
    doc.save(fileName);

  } catch (err) {
    console.error('PDF error:', err);
    alert('Ocurrió un error generando el PDF. Intenta nuevamente.');
  } finally {
    if (btn) { btn.textContent = '📄 Descargar mi reporte de evaluación'; btn.disabled = false; }
  }
}

// -- INICIALIZACION --
function initPrecal() {
  var modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === this) closeM();
    });
  }

  fetch('/api/ui-params').then(function(r) { return r.json(); }).then(function(d) {
    POPUP_ACTIVO = d.popupActivo !== false;
    applyUIParams(d.contadorVisible !== false);
  }).catch(function() {});

  setTimeout(loadForm, 300);
  fetchContadorReal();
  fetchSolicitudesReal();
}

if (typeof window !== 'undefined') {
  window.initPrecal = initPrecal;
}
