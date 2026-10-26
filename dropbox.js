// Conexion directa con Dropbox (OAuth2 PKCE, sin servidor y sin secreto).
(function () {
  const LS = { token: 'cubo.token', refresh: 'cubo.refresh', expira: 'cubo.expira', verif: 'cubo.verifier' };
  const redirect = () => window.CONFIG.REDIRECT_URI || (location.origin + location.pathname.replace(/index\.html$/, ''));
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // Dropbox-API-Arg necesita ASCII: los acentos van como \uXXXX
  const arg = o => JSON.stringify(o).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

  // Se prepara la llave por adelantado: iPhone solo deja abrir Dropbox si el toque abre la pagina al instante.
  let lista = null;
  async function preparar() {
    // Se reutiliza la llave guardada: si la app se cierra mientras pegas el codigo, sigue valiendo.
    let v = localStorage.getItem(LS.verif);
    if (!v) { v = b64url(crypto.getRandomValues(new Uint8Array(48))); localStorage.setItem(LS.verif, v); }
    const ch = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
    const base = { client_id: window.CONFIG.DROPBOX_APP_KEY, response_type: 'code', code_challenge: ch,
      code_challenge_method: 'S256', token_access_type: 'offline' };
    const u = 'https://www.dropbox.com/oauth2/authorize?';
    lista = { codigo: u + new URLSearchParams(base), redir: u + new URLSearchParams({ ...base, redirect_uri: redirect() }) };
  }

  // conCodigo: Dropbox muestra un codigo para copiar y pegar (sirve dentro de la app de pantalla de inicio)
  function entrar(conCodigo) {
    if (!lista) return false;
    if (conCodigo) { if (!window.open(lista.codigo, '_blank')) location.href = lista.codigo; }
    else location.href = lista.redir;
    return true;
  }

  async function token(body) {
    const r = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', body: new URLSearchParams(body) });
    if (!r.ok) throw new Error('No se pudo entrar a Dropbox (' + r.status + ')');
    const j = await r.json();
    localStorage.setItem(LS.token, j.access_token);
    localStorage.setItem(LS.expira, String(Date.now() + (j.expires_in || 14400) * 1000 - 60000));
    if (j.refresh_token) localStorage.setItem(LS.refresh, j.refresh_token);
  }

  // Si regresamos de Dropbox con ?code=..., termina de entrar
  async function terminarEntrada() {
    const p = new URLSearchParams(location.search);
    if (!p.get('code')) return false;
    history.replaceState(null, '', location.pathname);
    await token({ grant_type: 'authorization_code', code: p.get('code'), client_id: window.CONFIG.DROPBOX_APP_KEY,
      code_verifier: localStorage.getItem(LS.verif) || '', redirect_uri: redirect() });
    localStorage.removeItem(LS.verif);
    return true;
  }
  async function entrarConCodigo(codigo) {
    await token({ grant_type: 'authorization_code', code: codigo.trim(), client_id: window.CONFIG.DROPBOX_APP_KEY,
      code_verifier: localStorage.getItem(LS.verif) || '' });
    localStorage.removeItem(LS.verif);
  }

  const conectado = () => !!localStorage.getItem(LS.refresh);
  function salir() { Object.values(LS).forEach(k => localStorage.removeItem(k)); }

  async function acceso() {
    if (!localStorage.getItem(LS.token) || Date.now() > +(localStorage.getItem(LS.expira) || 0))
      await token({ grant_type: 'refresh_token', refresh_token: localStorage.getItem(LS.refresh), client_id: window.CONFIG.DROPBOX_APP_KEY });
    return localStorage.getItem(LS.token);
  }

  async function llamar(url, opts, reintento) {
    opts.headers = Object.assign({ Authorization: 'Bearer ' + await acceso() }, opts.headers);
    const r = await fetch(url, opts);
    if (r.status === 401 && !reintento) { localStorage.removeItem(LS.token); return llamar(url, opts, true); }
    return r;
  }
  async function rpc(ruta, cuerpo) {
    const r = await llamar('https://api.dropboxapi.com/2/' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { }
    if (!r.ok) { const e = new Error((j && j.error_summary) || t || ('Error ' + r.status)); e.status = r.status; e.resumen = (j && j.error_summary) || ''; throw e; }
    return j;
  }

  async function listar(carpeta, recursivo) {
    let j = await rpc('files/list_folder', { path: carpeta, recursive: !!recursivo, limit: 2000 });
    const todo = [...j.entries];
    while (j.has_more) { j = await rpc('files/list_folder/continue', { cursor: j.cursor }); todo.push(...j.entries); }
    return todo;
  }

  async function bajarTexto(ruta) {
    let meta;
    try { meta = await rpc('files/get_metadata', { path: ruta }); }
    catch (e) { if ((e.resumen || '').includes('not_found')) return { texto: '', rev: null }; throw e; }
    const r = await llamar('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { 'Dropbox-API-Arg': arg({ path: meta.rev ? 'rev:' + meta.rev : ruta }) } });
    if (!r.ok) throw new Error('No se pudo leer ' + ruta);
    return { texto: new TextDecoder('utf-8').decode(await r.arrayBuffer()), rev: meta.rev };
  }

  // Sube el texto. Con rev: solo si nadie lo cambio mientras tanto (si no, devuelve false para volver a unir).
  async function subirTexto(ruta, texto, rev) {
    const modo = rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' };
    const r = await llamar('https://content.dropboxapi.com/2/files/upload', { method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': arg({ path: ruta, mode: modo, autorename: false, mute: true }) },
      body: new TextEncoder().encode(texto) });
    if (r.status === 409) return false;
    if (!r.ok) throw new Error('No se pudo guardar en Dropbox (' + r.status + ')');
    return true;
  }

  async function miniatura(ruta) {
    const r = await llamar('https://content.dropboxapi.com/2/files/get_thumbnail_v2', { method: 'POST',
      headers: { 'Dropbox-API-Arg': arg({ resource: { '.tag': 'path', path: ruta }, format: 'jpeg', size: 'w256h256', mode: 'fitone_bestfit' }) } });
    if (!r.ok) return null;
    return URL.createObjectURL(await r.blob());
  }

  const enlace = async ruta => (await rpc('files/get_temporary_link', { path: ruta })).link;

  window.Dropbox = { preparar, entrar, entrarConCodigo, terminarEntrada, conectado, salir, listar, bajarTexto, subirTexto, miniatura, enlace, rpc };
})();
