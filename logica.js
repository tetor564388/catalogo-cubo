// Logica pura del Catalogo CUBO (igual que la app de la PC). Sin Dropbox ni pantalla: se prueba con node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logica = factory();
})(this, function () {
  const R = { PorRevisar: 'Por revisar', Aprobado: 'Aprobado', NoMeGusta: 'No me gusta', Vieja: 'Vieja', Referencia: 'Referencia' };
  const VISTAS = ['Por revisar', 'Aprobado', 'No me gusta', 'Viejas', 'Referencias', 'Todo'];
  const ESTIMADAS = [18, 20, 5, 31, 21, 20, 28, 11];
  const EXT = {
    Video: ['.mp4', '.mov', '.mkv', '.webm'], Audio: ['.mp3', '.wav', '.m4a'],
    Imagen: ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'], Guion: ['.pdf'],
  };
  const CSV_NOMBRE = 'revisiones.csv', CARPETA_APROBADO = 'aprobado';
  const CARPETAS_REF = ['referencia', 'referencias', 'imagenes de apoyo', 'imagen de apoyo'];
  const COLS = ['archivo', 'serie', 'episodio', 'escena', 'toma', 'version', 'resultado', 'nota', 'fecha'];

  const pad = (n, w) => String(n).padStart(w, '0');
  const sin = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ext = p => { const n = p.split('/').pop(); const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i).toLowerCase() : ''; };
  const nombre = p => p.split('/').pop();

  function tipoDe(p) { const x = ext(p); for (const t in EXT) if (EXT[t].includes(x)) return t; return null; }

  const PATRON = /^([A-Za-z][A-Za-z0-9]*)_EP(\d{1,2})(?:_E(\d{1,3})([A-Za-z]?)(?:_toma(\d{1,3}))?)?(?:_v(\d{1,3}))?$/i;
  function leerNombre(p) {
    let n = nombre(p); const i = n.lastIndexOf('.'); if (i > 0) n = n.slice(0, i); n = n.trim();
    const m = PATRON.exec(n); if (!m) return null;
    const ep = parseInt(m[2], 10), e = m[3] !== undefined ? parseInt(m[3], 10) : 1;
    if (ep < 1 || e < 1) return null;
    return {
      serie: m[1].toUpperCase(), episodio: 'EP' + pad(ep, 2),
      escena: m[3] !== undefined ? 'E' + pad(e, 3) + (m[4] || '').toUpperCase() : '',
      toma: m[5] !== undefined ? parseInt(m[5], 10) : null, version: m[6] !== undefined ? parseInt(m[6], 10) : null,
    };
  }

  function porCarpeta(p) {
    const partes = p.replace(/\\/g, '/').split('/'); partes.pop();
    return partes.some(x => CARPETAS_REF.includes(sin(x).trim().toLowerCase()));
  }

  // Archivos que la app muestra: medios, fuera de Aprobado/
  function esMedio(rel) { return tipoDe(rel) !== null && !rel.toLowerCase().startsWith(CARPETA_APROBADO + '/'); }

  // ===== CSV =====
  function leerCsv(texto) {
    if (!texto) return [];
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    const regs = []; let reg = [], campo = '', q = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (q) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
      else if (c === '"') q = true;
      else if (c === ',') { reg.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; reg.push(campo); campo = ''; regs.push(reg); reg = []; }
      else campo += c;
    }
    if (campo.length || reg.length) { reg.push(campo); regs.push(reg); }
    if (!regs.length) return [];
    const cab = regs[0].map(x => x.trim().toLowerCase());
    if (cab.indexOf('archivo') < 0 || cab.indexOf('resultado') < 0) return [];
    const out = [];
    for (const r of regs.slice(1)) {
      const o = {}; COLS.forEach(k => { const j = cab.indexOf(k); o[k] = j >= 0 && j < r.length ? r[j] : ''; });
      o.archivo = o.archivo.trim(); o.resultado = o.resultado.trim(); o.fecha = o.fecha.trim();
      if (o.archivo) out.push(o);
    }
    return out;
  }
  const Q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""').replace(/\r\n|\n|\r/g, ' ') + '"';
  function escribirCsv(filas) {
    let s = '\uFEFF' + COLS.join(',') + '\r\n';
    for (const f of filas) s += COLS.map(k => Q(f[k])).join(',') + '\r\n';
    return s;
  }
  function fechaAhora(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`;
  }

  // ===== Catalogo =====
  // archivos: [{rel, ...extra}], filas: del CSV. Devuelve items con su resultado.
  function construir(archivos, filas, cambios) {
    const porRuta = new Map(); for (const f of filas || []) porRuta.set(f.archivo.toLowerCase(), f);
    const items = archivos.filter(a => esMedio(a.rel)).map(a => {
      const f = porRuta.get(a.rel.toLowerCase());
      const n = leerNombre(a.rel);
      const it = Object.assign({}, a, {
        tipo: tipoDe(a.rel), nombre: nombre(a.rel),
        serie: n ? n.serie : '', episodio: n ? n.episodio : '', escena: n ? n.escena : '',
        toma: n ? n.toma : null, version: n ? n.version : null,
        revision: '', nota: '', refManual: false, fecha: '',
      });
      if (f) {
        // la PC puede haber clasificado a mano: se respeta lo del CSV
        it.serie = f.serie; it.episodio = f.episodio; it.escena = f.escena;
        it.toma = f.toma === '' ? null : parseInt(f.toma, 10); it.version = f.version === '' ? null : parseInt(f.version, 10);
        if (f.resultado === R.Aprobado || f.resultado === R.NoMeGusta) it.revision = f.resultado;
        if (f.resultado === R.NoMeGusta) it.nota = f.nota;
        if (f.resultado === R.Referencia && !porCarpeta(a.rel)) it.refManual = true;
        it.fecha = f.fecha;
      }
      const c = cambios && cambios[a.rel.toLowerCase()];
      if (c && (!it.fecha || c.fecha >= it.fecha)) { it.revision = c.revision; it.nota = c.nota || ''; it.fecha = c.fecha; it.pendiente = true; }
      return it;
    });
    calcularResultados(items);
    return items;
  }

  const esRef = it => it.refManual || porCarpeta(it.rel);
  function calcularResultados(items) {
    const grupos = new Map();
    for (const it of items) {
      if (esRef(it) || !it.serie || !it.episodio || it.version == null || isNaN(it.version)) continue;
      const k = [it.serie, it.episodio, it.escena, it.toma == null ? '' : it.toma, it.tipo].join('|').toUpperCase();
      if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(it);
    }
    const viejas = new Set();
    for (const g of grupos.values()) { const max = Math.max(...g.map(x => x.version)); g.forEach(x => { if (x.version < max) viejas.add(x); }); }
    for (const it of items)
      it.resultado = esRef(it) ? R.Referencia : it.revision === R.Aprobado ? R.Aprobado : it.revision === R.NoMeGusta ? R.NoMeGusta : viejas.has(it) ? R.Vieja : R.PorRevisar;
    return items;
  }

  function aFilas(items, ahora) {
    return items.slice().sort((a, b) => a.rel.toLowerCase() < b.rel.toLowerCase() ? -1 : 1).map(it => ({
      archivo: it.rel, serie: it.serie, episodio: it.episodio, escena: it.escena,
      toma: it.toma == null || isNaN(it.toma) ? '' : String(it.toma), version: it.version == null || isNaN(it.version) ? '' : String(it.version),
      resultado: it.resultado, nota: it.resultado === R.NoMeGusta ? it.nota : '', fecha: it.fecha || ahora,
    }));
  }

  // Une el CSV recien bajado de Dropbox con los cambios hechos en el telefono (lo mas nuevo gana).
  function fusionar(archivos, filasRemotas, cambios, ahora) {
    return escribirCsv(aFilas(construir(archivos, filasRemotas, cambios), ahora || fechaAhora()));
  }

  function incluye(vista, resultado) {
    switch (vista) {
      case 'Por revisar': return resultado === R.PorRevisar;
      case 'Aprobado': return resultado === R.Aprobado;
      case 'No me gusta': return resultado === R.NoMeGusta;
      case 'Viejas': return resultado === R.Vieja;
      case 'Referencias': return resultado === R.Referencia;
      default: return true;
    }
  }
  function coincide(it, texto) {
    if (!texto || !texto.trim()) return true;
    const todo = sin(`${it.rel} ${it.serie} ${it.episodio} ${it.escena} ${it.resultado} ${it.nota}`).toLowerCase();
    return texto.split(/\s+/).filter(Boolean).every(p => todo.includes(sin(p).toLowerCase()));
  }
  // ===== Fechas (v1.7): la fecha es la de modificacion del archivo en Dropbox =====
  const ORDENES = ['Episodio y escena', 'Más nuevos primero', 'Más viejos primero'];
  const FILTROS_FECHA = ['Todo', 'Hoy', 'Últimos 7 días'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const soloDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diasEntre = (f, ahora) => Math.round((soloDia(ahora) - soloDia(f)) / 86400000);
  const diaCorto = (f, ahora) => `${f.getDate()} ${MESES[f.getMonth()]}` + (f.getFullYear() !== ahora.getFullYear() ? ' ' + f.getFullYear() : '');
  function textoFecha(ms, ahora) {
    if (!ms) return ''; const f = new Date(ms); ahora = ahora || new Date(); const h = f.getHours() % 12 || 12;
    return `${diaCorto(f, ahora)}, ${h}:${pad(f.getMinutes(), 2)} ${f.getHours() < 12 ? 'am' : 'pm'}`;
  }
  function diaDe(ms, ahora) {
    if (!ms) return 'Sin fecha'; const f = new Date(ms); ahora = ahora || new Date(); const d = diasEntre(f, ahora);
    return d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : diaCorto(f, ahora);
  }
  function pasaFecha(filtro, ms, ahora) {
    if (filtro === 'Hoy') return !!ms && diasEntre(new Date(ms), ahora || new Date()) === 0;
    if (filtro === 'Últimos 7 días') return !!ms && diasEntre(new Date(ms), ahora || new Date()) < 7;
    return true;
  }
  function filtrar(items, f, ahora) {
    const vis = items.filter(it => incluye(f.vista || 'Por revisar', it.resultado) &&
      (!f.episodio || (f.episodio === '-' ? !it.episodio : it.episodio === f.episodio)) &&
      (!f.tipo || it.tipo === f.tipo) && coincide(it, f.texto) && pasaFecha(f.fecha, it.modificado, ahora));
    if (f.orden === ORDENES[1] || f.orden === ORDENES[2]) {
      const s = f.orden === ORDENES[1] ? -1 : 1;
      return vis.sort((a, b) => s * ((a.modificado || 0) - (b.modificado || 0)) || a.rel.localeCompare(b.rel));
    }
    return vis.sort((a, b) => (a.episodio + '|' + a.escena + '|' + a.rel).localeCompare(b.episodio + '|' + b.escena + '|' + b.rel));
  }
  // Separa la lista ordenada por dia: [{dia:'Hoy', items:[...]}, ...]
  function agruparPorDia(lista, ahora) {
    const g = [];
    for (const it of lista) { const d = diaDe(it.modificado, ahora); if (!g.length || g[g.length - 1].dia !== d) g.push({ dia: d, items: [] }); g[g.length - 1].items.push(it); }
    return g;
  }

  const numero = e => { const m = /\d+/.exec(e || ''); return m ? parseInt(m[0], 10) : 0; };
  // Progreso: escenas con al menos un archivo Aprobado (sin referencias)
  function progreso(items) {
    const eps = new Map();
    ESTIMADAS.forEach((n, i) => eps.set('CUBO|EP' + pad(i + 1, 2), { serie: 'CUBO', episodio: 'EP' + pad(i + 1, 2), estimadas: n, escenas: new Map() }));
    for (const it of items) {
      if (esRef(it) || !it.serie || !it.episodio || !it.escena) continue;
      const k = it.serie.toUpperCase() + '|' + it.episodio;
      if (!eps.has(k)) eps.set(k, { serie: it.serie.toUpperCase(), episodio: it.episodio, estimadas: 0, escenas: new Map() });
      const e = eps.get(k).escenas; const s = e.get(it.escena) || { escena: it.escena, archivos: 0, aprobada: false };
      s.archivos++; if (it.resultado === R.Aprobado) s.aprobada = true; e.set(it.escena, s);
    }
    return [...eps.values()].sort((a, b) => (a.serie + a.episodio).localeCompare(b.serie + b.episodio)).map(e => {
      const escenas = [...e.escenas.values()].sort((a, b) => numero(a.escena) - numero(b.escena) || a.escena.localeCompare(b.escena));
      const listas = escenas.filter(s => s.aprobada).length, total = Math.max(e.estimadas, escenas.length);
      return { serie: e.serie, episodio: e.episodio, total, listas, conArchivos: escenas.length, porcentaje: total ? Math.min(100, Math.round(100 * listas / total)) : 0, escenas };
    });
  }

  return { R, VISTAS, ESTIMADAS, CSV_NOMBRE, tipoDe, leerNombre, porCarpeta, esMedio, leerCsv, escribirCsv, fechaAhora, construir, calcularResultados, aFilas, fusionar, filtrar, progreso, sin, ORDENES, FILTROS_FECHA, textoFecha, diaDe, pasaFecha, agruparPorDia };
});
