(function () {
  const L = window.Logica, D = window.Dropbox, $ = id => document.getElementById(id);
  const LS_CARPETA = 'cubo.carpeta', LS_CAMBIOS = 'cubo.cambios', LS_FILTROS = 'cubo.filtros';
  let carpeta = localStorage.getItem(LS_CARPETA) || window.CONFIG.CARPETA_POR_DEFECTO;
  let archivos = [], filas = [], items = [], actual = null, cargando = false;
  let cambios = JSON.parse(localStorage.getItem(LS_CAMBIOS) || '{}'); // revisiones hechas aqui que falta subir
  const filtros = Object.assign({ vista: 'Por revisar', episodio: '', tipo: '', texto: '' }, JSON.parse(localStorage.getItem(LS_FILTROS) || '{}'));
  const ICONO = { Video: '🎬', Audio: '🎧', Imagen: '🖼️', Guion: '📄' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clase = r => 'pastilla r-' + r.split(' ')[0];
  const rutaCompleta = rel => carpeta.replace(/\/$/, '') + '/' + rel;

  function aviso(t, error, seg) {
    const a = $('aviso'); if (!t) { a.classList.add('oculto'); return; }
    a.textContent = t; a.className = 'aviso' + (error ? ' error' : ''); clearTimeout(aviso.t);
    if (seg) aviso.t = setTimeout(() => a.classList.add('oculto'), seg * 1000);
  }
  function pantalla(id) {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.toggle('oculto', p.id !== id));
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('activo', b.dataset.p === id));
    $('btnRefrescar').classList.toggle('oculto', id === 'pEntrar');
    document.querySelector('nav').classList.toggle('oculto', id === 'pEntrar');
    if (id === 'pProgreso') pintarProgreso();
    if (id === 'pAjustes') $('carpetaActual').textContent = carpeta;
  }
  const guardarCambios = () => localStorage.setItem(LS_CAMBIOS, JSON.stringify(cambios));

  // ===== Cargar =====
  async function cargar() {
    if (cargando) return; cargando = true; aviso('Leyendo tu carpeta…');
    try {
      const entradas = await D.listar(carpeta, true);
      const base = carpeta.replace(/\/$/, '').toLowerCase() + '/';
      archivos = entradas.filter(e => e['.tag'] === 'file' && e.path_lower.startsWith(base))
        .map(e => ({ rel: e.path_display.slice(base.length), ruta: e.path_display, tam: e.size }))
        .filter(a => L.esMedio(a.rel));
      filas = L.leerCsv((await D.bajarTexto(rutaCompleta(L.CSV_NOMBRE))).texto);
      reconstruir();
      if (Object.keys(cambios).length) await subir();
      else aviso(`Listo: ${archivos.length} archivos.`, false, 3);
    } catch (e) {
      if ((e.resumen || '').includes('not_found')) { aviso('No encuentro la carpeta. Elige tu carpeta Cubo en Ajustes.', true); pantalla('pAjustes'); abrirExplorador(''); }
      else aviso('No se pudo leer Dropbox. Revisa tu internet y aprieta ⟳. (' + e.message + ')', true);
    } finally { cargando = false; }
  }
  function reconstruir() {
    items = L.construir(archivos, filas, cambios);
    const eps = [...new Set(items.map(i => i.episodio).filter(Boolean))].sort();
    $('fEpisodio').innerHTML = '<option value="">Todos los episodios</option>' + eps.map(e => `<option>${esc(e)}</option>`).join('') + '<option value="-">Sin episodio</option>';
    $('fEpisodio').value = filtros.episodio;
    pintarLista();
    if (!$('pProgreso').classList.contains('oculto')) pintarProgreso();
  }

  // Sube revisiones.csv: baja el ultimo, une con lo de aqui (lo mas nuevo gana) y lo reemplaza solo si nadie lo cambio.
  async function subir() {
    aviso('Guardando en Dropbox…');
    try {
      for (let intento = 0; intento < 4; intento++) {
        const r = await D.bajarTexto(rutaCompleta(L.CSV_NOMBRE));
        const remotas = L.leerCsv(r.texto);
        const texto = L.fusionar(archivos, remotas, cambios);
        if (await D.subirTexto(rutaCompleta(L.CSV_NOMBRE), texto, r.rev)) {
          filas = L.leerCsv(texto); cambios = {}; guardarCambios(); reconstruir();
          aviso('Guardado ✓ (la PC y los agentes ya lo ven)', false, 3); return;
        }
      }
      throw new Error('el archivo cambió muchas veces');
    } catch (e) { aviso('Se guardó en el iPhone, pero no en Dropbox todavía. Se intenta otra vez al apretar ⟳. (' + e.message + ')', true); }
  }

  // ===== Lista =====
  let observador = null; const cacheMini = new Map(); let enCola = 0; const cola = [];
  function pedirMini(it, img) {
    if (cacheMini.has(it.ruta)) { const u = cacheMini.get(it.ruta); if (u) mostrarMini(img, u); return; }
    cola.push([it, img]); siguiente();
  }
  function mostrarMini(cont, u) { cont.innerHTML = `<img src="${u}" alt="">`; }
  function siguiente() {
    while (enCola < 4 && cola.length) {
      const [it, cont] = cola.shift(); enCola++;
      D.miniatura(it.ruta).catch(() => null).then(u => { cacheMini.set(it.ruta, u); if (u) mostrarMini(cont, u); enCola--; siguiente(); });
    }
  }
  function pintarLista() {
    const vis = L.filtrar(items, filtros);
    $('cuenta').textContent = `${vis.length} de ${items.length} archivos`;
    if (observador) observador.disconnect();
    observador = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; observador.unobserve(e.target);
      const it = items[+e.target.dataset.i]; if (it) pedirMini(it, e.target.querySelector('.mini'));
    }), { rootMargin: '300px' });
    $('lista').innerHTML = vis.length ? vis.map(it => `<li data-i="${items.indexOf(it)}">
      <div class="mini">${ICONO[it.tipo]}</div>
      <div class="txt"><div class="n">${esc(it.nombre)}</div>
      <div class="s">${esc([it.episodio, it.escena, it.toma != null ? 'toma ' + it.toma : '', it.version != null ? 'v' + it.version : ''].filter(Boolean).join(' · ') || 'Sin episodio')}</div>
      <span class="${clase(it.resultado)}">${esc(it.resultado)}${it.pendiente ? ' ·' : ''}</span></div></li>`).join('')
      : '<p class="suave" style="text-align:center;padding:30px">Nada por aquí 🎉</p>';
    $('lista').querySelectorAll('li').forEach(li => {
      li.onclick = () => abrir(items[+li.dataset.i]);
      const it = items[+li.dataset.i]; if (it.tipo === 'Imagen' || it.tipo === 'Video') observador.observe(li);
    });
  }

  // ===== Ver archivo =====
  async function abrir(it) {
    actual = it; $('detalle').classList.remove('oculto'); document.body.style.overflow = 'hidden';
    $('dNombre').textContent = it.nombre;
    $('dInfo').textContent = [it.episodio, it.escena, it.toma != null ? 'toma ' + it.toma : '', it.version != null ? 'versión ' + it.version : '', it.tipo].filter(Boolean).join(' · ') + (it.rel.includes('/') ? '\n' + it.rel : '');
    $('dNota').value = it.revision === L.R.NoMeGusta ? it.nota : '';
    pintarEstado();
    const m = $('dMedio'); m.innerHTML = '<p class="suave">Cargando…</p>';
    try {
      const u = await D.enlace(it.ruta); if (actual !== it) return;
      if (it.tipo === 'Imagen') m.innerHTML = `<img src="${u}" alt="">`;
      else if (it.tipo === 'Video') m.innerHTML = `<video src="${u}" controls playsinline preload="metadata"></video>`;
      else if (it.tipo === 'Audio') m.innerHTML = `<audio src="${u}" controls preload="metadata"></audio>`;
      else m.innerHTML = `<a href="${u}" target="_blank" rel="noopener">📄 Abrir el guion (PDF)</a>`;
      const v = m.querySelector('video'); if (v) v.onerror = () => { m.innerHTML = `<a href="${u}" target="_blank" rel="noopener">🎬 Este video no se puede ver aquí. Toca para abrirlo.</a>`; };
    } catch (e) { m.innerHTML = '<p class="suave">No se pudo abrir el archivo.</p>'; }
  }
  function pintarEstado() {
    const it = actual; $('dEstado').className = clase(it.resultado); $('dEstado').textContent = it.resultado;
    const ref = it.resultado === L.R.Referencia;
    ['btnAprobar', 'btnNoMeGusta', 'dNota'].forEach(id => $(id).classList.toggle('oculto', ref));
    $('btnQuitar').classList.toggle('oculto', ref || !it.revision);
    $('dNotaVieja').classList.toggle('oculto', !(it.revision === L.R.NoMeGusta && it.nota));
    $('dNotaVieja').textContent = 'Nota: ' + it.nota;
  }
  function cerrar() {
    $('detalle').classList.add('oculto'); $('dMedio').innerHTML = ''; document.body.style.overflow = ''; actual = null;
  }
  async function revisar(revision) {
    const it = actual; let nota = '';
    if (revision === L.R.NoMeGusta) {
      nota = $('dNota').value.trim();
      if (!nota) { $('dNota').focus(); aviso('Escribe qué no te gustó, para que los agentes sepan qué cambiar.', true, 4); return; }
    }
    cambios[it.rel.toLowerCase()] = { revision, nota, fecha: L.fechaAhora() }; guardarCambios();
    reconstruir(); actual = items.find(x => x.rel === it.rel) || it; pintarEstado();
    cerrar(); await subir();
  }

  // ===== Progreso =====
  function pintarProgreso() {
    const ps = L.progreso(items);
    const tot = ps.reduce((a, p) => a + p.total, 0), ok = ps.reduce((a, p) => a + p.listas, 0);
    $('progreso').innerHTML = `<h2>Toda la serie: ${ok} de ${tot} escenas aprobadas</h2>` + ps.map(p => `<div class="ep">
      <div class="fila"><span>${esc(p.episodio)}</span><span>${p.listas} / ${p.total} · ${p.porcentaje}%</span></div>
      <div class="barraP"><div style="width:${p.porcentaje}%"></div></div>
      <div class="suave" style="font-size:13px">${p.conArchivos} escenas con archivos</div>
      <div class="escenas">${p.escenas.map(s => `<span class="${s.aprobada ? 'ok' : ''}">${esc(s.escena.replace(/^E0*/, ''))}</span>`).join('')}</div></div>`).join('');
  }

  // ===== Elegir carpeta =====
  let expRuta = '';
  async function abrirExplorador(ruta) {
    expRuta = ruta; $('explorador').classList.remove('oculto'); $('expRuta').textContent = ruta || 'Dropbox';
    $('expLista').innerHTML = '<li class="suave">Cargando…</li>';
    try {
      const es = (await D.listar(ruta, false)).filter(e => e['.tag'] === 'folder').sort((a, b) => a.name.localeCompare(b.name));
      const arriba = ruta ? `<li data-r="${esc(ruta.slice(0, ruta.lastIndexOf('/')))}">⬆️ Subir</li>` : '';
      $('expLista').innerHTML = arriba + es.map(e => `<li data-r="${esc(e.path_display)}">📁 ${esc(e.name)}</li>`).join('');
      $('expLista').querySelectorAll('li[data-r]').forEach(li => li.onclick = () => abrirExplorador(li.dataset.r));
    } catch (e) { $('expLista').innerHTML = '<li>No se pudo abrir esta carpeta.</li>'; }
  }

  // ===== Inicio =====
  function conectarEventos() {
    $('fVista').innerHTML = L.VISTAS.map(v => `<option>${v}</option>`).join('');
    for (const [id, k] of [['fVista', 'vista'], ['fEpisodio', 'episodio'], ['fTipo', 'tipo'], ['fTexto', 'texto']]) {
      $(id).value = filtros[k];
      $(id).addEventListener(id === 'fTexto' ? 'input' : 'change', () => { filtros[k] = $(id).value; localStorage.setItem(LS_FILTROS, JSON.stringify(filtros)); pintarLista(); });
    }
    document.querySelectorAll('nav button').forEach(b => b.onclick = () => pantalla(b.dataset.p));
    $('btnEntrar').onclick = () => {
      if (!window.CONFIG.DROPBOX_APP_KEY || window.CONFIG.DROPBOX_APP_KEY.startsWith('PEGAR')) { aviso('Falta la llave de Dropbox en config.js.', true); return; }
      // Dentro de la app de pantalla de inicio se usa el codigo (Safari no regresa a la app sola)
      const enApp = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
      if (!D.entrar(enApp)) { aviso('Espera un segundo y vuelve a tocar.', true); D.preparar(); return; }
      if (enApp) $('cajaCodigo').classList.remove('oculto');
    };
    $('btnCodigo').onclick = async () => {
      try { await D.entrarConCodigo($('codigo').value); pantalla('pRevisar'); cargar(); }
      catch (e) { aviso('Ese código no funcionó. Aprieta "Entrar con Dropbox" otra vez.', true); }
    };
    $('btnRefrescar').onclick = cargar;
    $('btnCerrar').onclick = cerrar;
    $('btnAprobar').onclick = () => revisar(L.R.Aprobado);
    $('btnNoMeGusta').onclick = () => revisar(L.R.NoMeGusta);
    $('btnQuitar').onclick = () => revisar('');
    $('btnCambiarCarpeta').onclick = () => abrirExplorador(carpeta.slice(0, carpeta.lastIndexOf('/')));
    $('btnCancelarCarpeta').onclick = () => $('explorador').classList.add('oculto');
    $('btnUsarCarpeta').onclick = () => {
      if (!expRuta) { aviso('Elige una carpeta.', true, 3); return; }
      carpeta = expRuta; localStorage.setItem(LS_CARPETA, carpeta); $('explorador').classList.add('oculto');
      $('carpetaActual').textContent = carpeta; cacheMini.clear(); pantalla('pRevisar'); cargar();
    };
    $('btnSalir').onclick = () => { if (confirm('¿Salir de Dropbox en este iPhone?')) { D.salir(); location.reload(); } };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && D.conectado() && !actual) cargar(); });
  }

  async function iniciar() {
    conectarEventos();
    try { await D.terminarEntrada(); } catch (e) { aviso(e.message, true); }
    if (!D.conectado()) { try { await D.preparar(); } catch (e) { aviso('No se pudo preparar la entrada a Dropbox.', true); } pantalla('pEntrar'); return; }
    pantalla('pRevisar'); cargar();
  }
  iniciar();
})();
