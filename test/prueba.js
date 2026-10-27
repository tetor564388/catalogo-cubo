const L = require('../logica.js'); const assert = require('assert');
let n = 0, fallas = 0; const P = (t, f) => { n++; try { f(); console.log('[OK] ' + t); } catch (e) { fallas++; console.log('[FALLA] ' + t + ': ' + e.message); } };
const eq = assert.deepStrictEqual;
P('nombre completo', () => eq(L.leerNombre('CUBO_EP01_E012_toma02_v1.mp4'), { serie: 'CUBO', episodio: 'EP01', escena: 'E012', toma: 2, version: 1 }));
P('con letra', () => eq(L.leerNombre('CUBO_EP04_E012A_toma01_v3.mov'), { serie: 'CUBO', episodio: 'EP04', escena: 'E012A', toma: 1, version: 3 }));
P('minusculas', () => eq(L.leerNombre('cubo_ep1_e5a_toma1_v2.png'), { serie: 'CUBO', episodio: 'EP01', escena: 'E005A', toma: 1, version: 2 }));
P('sin toma ni version', () => eq(L.leerNombre('CUBO_EP08_E154.wav'), { serie: 'CUBO', episodio: 'EP08', escena: 'E154', toma: null, version: null }));
P('sin escena', () => eq(L.leerNombre('CUBO_EP01_v2.pdf'), { serie: 'CUBO', episodio: 'EP01', escena: '', toma: null, version: 2 }));
P('carpeta en ruta', () => eq(L.leerNombre('EP01/escenas/CUBO_EP01_E001_toma01_v1.mp4').escena, 'E001'));
for (const mal of ['video final.mp4', 'CUBO_E012_toma02_v1.mp4', 'CUBO_EP01_toma02.mp4', 'CUBO_EP01_E012_toma02_v1_final.mp4', 'CUBO_EP00_E012.mp4', 'CUBO_EP01_E000.mp4', 'CUBO_EP01_E012AB.mp4', '_EP01_E012.mp4', 'CUBO-EP01-E012.mp4'])
  P('no coincide ' + mal, () => eq(L.leerNombre(mal), null));
P('heic', () => eq(['a.HEIC', 'b.heif', 'IMG_1.heic'].map(L.tipoDe), ['Imagen', 'Imagen', 'Imagen']));
P('tipos', () => eq(['a.MP4', 'a.m4a', 'a.webp', 'a.pdf', 'a.txt', 'revisiones.csv'].map(L.tipoDe), ['Video', 'Audio', 'Imagen', 'Guion', null, null]));
P('referencias por carpeta', () => { assert(L.porCarpeta('Imágenes de Apoyo/x.png')); assert(L.porCarpeta('EP01/REFERENCIAS/x.png')); assert(!L.porCarpeta('Referencias.png')); assert(!L.porCarpeta('EP01/x.png')); });
P('ignora Aprobado/', () => { assert(!L.esMedio('Aprobado/CUBO_EP01_E001_v1.png')); assert(!L.esMedio('aprobado/x.mp4')); assert(L.esMedio('EP01/Aprobado/x.mp4') === true); });

const archivos = ['CUBO_EP01_E001_v1.png', 'CUBO_EP01_E001_v2.png', 'CUBO_EP01_E001_v2.mp4', 'CUBO_EP01_E001_toma02_v1.png', 'CUBO_EP01_v1.pdf', 'CUBO_EP01_v2.pdf',
  'Referencias/cara.png', 'suelta.png', 'CUBO_EP02_E030_v1.png', 'revisiones.csv', 'Aprobado/CUBO_EP01_E001_v2.png'].map(rel => ({ rel }));
P('viejas', () => {
  const it = L.construir(archivos, []); const r = Object.fromEntries(it.map(i => [i.rel, i.resultado]));
  eq(it.length, 9);
  eq(r['CUBO_EP01_E001_v1.png'], 'Vieja'); eq(r['CUBO_EP01_E001_v2.png'], 'Por revisar'); eq(r['CUBO_EP01_E001_v2.mp4'], 'Por revisar');
  eq(r['CUBO_EP01_E001_toma02_v1.png'], 'Por revisar'); eq(r['CUBO_EP01_v1.pdf'], 'Vieja'); eq(r['Referencias/cara.png'], 'Referencia'); eq(r['suelta.png'], 'Por revisar');
});
const csvPc = '\uFEFFarchivo,serie,episodio,escena,toma,version,resultado,nota,fecha\r\n' +
  '"CUBO_EP01_E001_v1.png","CUBO","EP01","E001","","1","Aprobado","","2026-10-24 10:00"\r\n' +
  '"suelta.png","CUBO","EP02","","","","Referencia","","2026-10-23 09:00"\r\n' +
  '"cubo_ep02_e030_v1.png","CUBO","EP02","E030","","1","No me gusta","la cara, ""rara""","2026-10-24 10:00"\r\n' +
  '"borrado.png","","","","","","Aprobado","","2026-10-24 10:00"\r\n';
P('csv leer', () => { const f = L.leerCsv(csvPc); eq(f.length, 4); eq(f[2].nota, 'la cara, "rara"'); eq(f[0].fecha, '2026-10-24 10:00'); });
P('csv ida y vuelta', () => { const f = L.leerCsv(csvPc); const t = L.escribirCsv(f); eq(t, csvPc); eq(L.leerCsv(t), f); });
P('csv vacio o malo', () => { eq(L.leerCsv(''), []); eq(L.leerCsv('hola\nmundo'), []); });
P('respeta lo de la PC', () => {
  const it = L.construir(archivos, L.leerCsv(csvPc)); const g = rel => it.find(i => i.rel === rel);
  eq(g('CUBO_EP01_E001_v1.png').resultado, 'Aprobado'); eq(g('suelta.png').resultado, 'Referencia'); eq(g('suelta.png').episodio, 'EP02');
  eq(g('CUBO_EP02_E030_v1.png').resultado, 'No me gusta'); eq(g('CUBO_EP02_E030_v1.png').nota, 'la cara, "rara"');
});
P('fusionar: lo mas nuevo gana y quedan todos los archivos', () => {
  const cambios = { 'cubo_ep02_e030_v1.png': { revision: 'Aprobado', nota: '', fecha: '2026-10-24 11:00' },
    'cubo_ep01_e001_v1.png': { revision: '', nota: '', fecha: '2026-10-24 09:00' },
    'cubo_ep01_e001_v2.png': { revision: 'No me gusta', nota: 'muy oscuro', fecha: '2026-10-24 11:00' } };
  const f = L.leerCsv(L.fusionar(archivos, L.leerCsv(csvPc), cambios, '2026-10-24 11:00'));
  const g = a => f.find(x => x.archivo === a);
  eq(f.length, 9); assert(!g('borrado.png')); assert(!g('revisiones.csv'));
  eq(g('CUBO_EP02_E030_v1.png').resultado, 'Aprobado'); eq(g('CUBO_EP02_E030_v1.png').nota, '');
  eq(g('CUBO_EP01_E001_v1.png').resultado, 'Aprobado'); // el cambio del telefono era mas viejo
  eq(g('CUBO_EP01_E001_v2.png').resultado, 'No me gusta'); eq(g('CUBO_EP01_E001_v2.png').nota, 'muy oscuro'); eq(g('CUBO_EP01_E001_v2.png').fecha, '2026-10-24 11:00');
  eq(g('suelta.png').resultado, 'Referencia'); eq(g('Referencias/cara.png').resultado, 'Referencia');
});
P('quitar revision', () => {
  const f = L.leerCsv(L.fusionar(archivos, L.leerCsv(csvPc), { 'cubo_ep01_e001_v1.png': { revision: '', nota: '', fecha: '2026-10-24 12:00' } }));
  eq(f.find(x => x.archivo === 'CUBO_EP01_E001_v1.png').resultado, 'Vieja');
});
P('filtros', () => {
  const it = L.construir(archivos, L.leerCsv(csvPc));
  eq(L.filtrar(it, { vista: 'Por revisar' }).length, 4); eq(L.filtrar(it, { vista: 'Viejas' }).length, 1);
  eq(L.filtrar(it, { vista: 'Todo', tipo: 'Guion' }).length, 2); eq(L.filtrar(it, { vista: 'Todo', episodio: 'EP02' }).length, 2);
  eq(L.filtrar(it, { vista: 'Todo', texto: 'raRA' }).length, 1); eq(L.filtrar(it, { vista: 'Referencias' }).length, 2);
});
P('progreso', () => {
  const it = L.construir(archivos, L.leerCsv(csvPc)); const p = L.progreso(it);
  eq(p.length, 8); eq(p.map(x => x.total), [18, 20, 5, 31, 21, 20, 28, 11]);
  eq(p[0].listas, 1); eq(p[0].conArchivos, 1); eq(p[1].listas, 0); eq(p[1].conArchivos, 1);
});
// ===== Fechas (v1.7) =====
{
  const ahora = new Date(2026, 9, 26, 15, 0), ms = (...a) => new Date(...a).getTime();
  P('texto fecha', () => eq(L.textoFecha(ms(2026, 9, 26, 14, 15), ahora), '26 oct, 2:15 pm'));
  P('texto 12am y otro año', () => eq([L.textoFecha(ms(2026, 0, 3, 0, 5), ahora), L.textoFecha(ms(2025, 11, 31, 12, 0), ahora)], ['3 ene, 12:05 am', '31 dic 2025, 12:00 pm']));
  P('dia Hoy/Ayer/fecha', () => eq([ms(2026, 9, 26, 0, 1), ms(2026, 9, 25, 23, 59), ms(2026, 9, 24, 9)].map(x => L.diaDe(x, ahora)), ['Hoy', 'Ayer', '24 oct']));
  P('filtro fecha', () => {
    assert(L.pasaFecha('Hoy', ms(2026, 9, 26, 1), ahora)); assert(!L.pasaFecha('Hoy', ms(2026, 9, 25, 23), ahora));
    assert(L.pasaFecha('Últimos 7 días', ms(2026, 9, 20), ahora)); assert(!L.pasaFecha('Últimos 7 días', ms(2026, 9, 19, 23), ahora));
    assert(L.pasaFecha('Todo', 0, ahora)); assert(!L.pasaFecha('Hoy', 0, ahora));
  });
  const its = L.construir([['CUBO_EP02_E001_v1.png', ms(2026, 9, 24, 9)], ['CUBO_EP01_E001_v1.png', ms(2026, 9, 26, 8)], ['CUBO_EP01_E002_v1.mp4', ms(2026, 9, 26, 14)], ['CUBO_EP01_E003_v1.mp4', ms(2026, 9, 25, 10)]].map(([rel, modificado]) => ({ rel, modificado })), []);
  const nombres = l => l.map(i => i.rel.slice(5, 14));
  P('orden episodio (default)', () => eq(nombres(L.filtrar(its, {}, ahora)), ['EP01_E001', 'EP01_E002', 'EP01_E003', 'EP02_E001']));
  P('orden nuevos', () => eq(nombres(L.filtrar(its, { orden: 'Más nuevos primero' }, ahora)), ['EP01_E002', 'EP01_E001', 'EP01_E003', 'EP02_E001']));
  P('orden viejos', () => eq(nombres(L.filtrar(its, { orden: 'Más viejos primero' }, ahora)), ['EP02_E001', 'EP01_E003', 'EP01_E001', 'EP01_E002']));
  P('filtro Hoy + tipo', () => eq(nombres(L.filtrar(its, { fecha: 'Hoy', tipo: 'Video' }, ahora)), ['EP01_E002']));
  P('agrupar por dia', () => eq(L.agruparPorDia(L.filtrar(its, { orden: 'Más nuevos primero' }, ahora), ahora).map(g => g.dia + ':' + g.items.length), ['Hoy:2', 'Ayer:1', '24 oct:1']));
}
// ===== Asignaciones (v1.8) =====
{
  const arch = ['CUBO_EP01_E001_toma01_v1.mp4', 'voz niña.mp3', 'CUBO_EP02_E005_v1.mp4'].map(rel => ({ rel }));
  const fila = (archivo, o) => Object.assign({ archivo, serie: 'CUBO', episodio: 'EP01', escena: 'E001', estado: 'Generando', etiquetas: '', notas: '', referencia: '', fecha: '2026-10-27 09:00' }, o);
  P('asig ida y vuelta comillas/acentos/comas/saltos', () => {
    const f = [fila('voz niña.mp3', { etiquetas: 'cielo, "azul", niño', notas: 'línea 1\nlínea, 2', referencia: 'si' })];
    const t = L.escribirAsig(f); assert(t.startsWith('\uFEFFarchivo,serie,episodio,escena,estado,etiquetas,notas,referencia,fecha\r\n'));
    assert(t.includes('"voz niña.mp3","CUBO","EP01","E001","Generando","cielo, ""azul"", niño","línea 1\nlínea, 2","si","2026-10-27 09:00"'));
    eq(L.leerAsig(t), f); eq(L.escribirAsig(L.leerAsig(t)), t);
  });
  P('asig formato igual a la PC (C#)', () => {
    const pc = '\uFEFFarchivo,serie,episodio,escena,estado,etiquetas,notas,referencia,fecha\r\n"CUBO_EP01_E001_toma01_v1.mp4","CUBO","EP01","E001","Generando","cielo, ""azul"", niño","línea 1\nlínea, 2","no","2026-10-27 09:00"\r\n';
    eq(L.escribirAsig(L.leerAsig(pc)), pc);
  });
  P('normalizar escena/episodio', () => { eq([L.normEscena('12'), L.normEscena('e12a'), L.normEscena(''), L.normEscena('doce'), L.normEscena('0')], ['E012', 'E012A', '', null, null]); eq([L.normEpisodio('3'), L.normEpisodio('ep7'), L.normEpisodio('x')], ['EP03', 'EP07', null]); });
  P('gana lo mas nuevo y no se pierden filas de la PC', () => {
    const rem = [fila('voz niña.mp3', { etiquetas: 'pc', fecha: '2026-10-27 10:00' }), fila('Otra/no-existe.mp4', {}), fila('CUBO_EP02_E005_v1.mp4', { etiquetas: 'pc nuevo', fecha: '2026-10-27 12:00' })];
    const loc = { 'voz niña.mp3': fila('voz niña.mp3', { etiquetas: 'iphone', fecha: '2026-10-27 11:00' }), 'cubo_ep02_e005_v1.mp4': fila('CUBO_EP02_E005_v1.mp4', { etiquetas: 'iphone viejo', fecha: '2026-10-27 11:00' }) };
    const u = L.leerAsig(L.fusionarAsig(rem, loc)); eq(u.length, 3);
    eq(u.find(f => f.archivo === 'voz niña.mp3').etiquetas, 'iphone'); eq(u.find(f => f.archivo === 'CUBO_EP02_E005_v1.mp4').etiquetas, 'pc nuevo');
    assert(u.some(f => f.archivo === 'Otra/no-existe.mp4'));
  });
  P('construir aplica asignacion', () => {
    const it = L.construir(arch, [], {}, [fila('voz niña.mp3', { serie: 'cubo', episodio: '3', escena: '12a', estado: 'En revision', etiquetas: 'voz', notas: 'n', referencia: 'si' })]);
    const v = it.find(x => x.rel === 'voz niña.mp3'); eq([v.serie, v.episodio, v.escena, v.estado, v.etiquetas, v.notas, v.resultado], ['CUBO', 'EP03', 'E012A', 'En revision', 'voz', 'n', 'Referencia']);
    eq(it.find(x => x.rel.startsWith('CUBO_EP01')).estado, 'Generando');
  });
  P('sin episodio no hay escena; referencia no', () => {
    const v = L.construir(arch, [], {}, [fila('CUBO_EP01_E001_toma01_v1.mp4', { episodio: '', escena: 'E009', referencia: 'no' })])[0];
    eq([v.serie, v.episodio, v.escena, v.resultado], ['CUBO', '', '', 'Por revisar']);
    eq(L.filaAsig(Object.assign({}, v, { escena: 'E004' }), 'x').escena, '');
  });
  const rev = (archivo, resultado, fecha) => ({ archivo, serie: 'CUBO', episodio: 'EP01', escena: 'E001', toma: '1', version: '1', resultado, nota: resultado === 'No me gusta' ? 'feo' : '', fecha });
  const A = 'CUBO_EP01_E001_toma01_v1.mp4';
  P('estado Listo mas nuevo = Aprobado', () => { const v = L.construir(arch, [], {}, [fila(A, { estado: 'Listo', fecha: '2026-10-27 10:00' })])[0]; eq([v.estado, v.resultado], ['Listo', 'Aprobado']); });
  P('aprobado mas nuevo = Listo', () => { const v = L.construir(arch, [rev(A, 'Aprobado', '2026-10-27 11:00')], {}, [fila(A, { estado: 'Generando', fecha: '2026-10-27 10:00' })])[0]; eq([v.estado, v.resultado], ['Listo', 'Aprobado']); });
  P('no me gusta mas nuevo saca de Listo', () => { const v = L.construir(arch, [rev(A, 'No me gusta', '2026-10-27 11:00')], {}, [fila(A, { estado: 'Listo', fecha: '2026-10-27 10:00' })])[0]; eq([v.estado, v.resultado], ['Generando', 'No me gusta']); });
  P('En revision mas nuevo quita aprobado', () => {
    const v = L.construir(arch, [rev(A, 'Aprobado', '2026-10-27 09:00')], {}, [fila(A, { estado: 'En revision', fecha: '2026-10-27 10:00' })])[0]; eq([v.estado, v.resultado], ['En revision', 'Por revisar']);
    // y revisiones.csv que sube el iPhone lo refleja
    assert(L.fusionar(arch, [rev(A, 'Aprobado', '2026-10-27 09:00')], {}, '2026-10-27 10:05', [fila(A, { estado: 'En revision', fecha: '2026-10-27 10:00' })]).includes('"' + A + '","CUBO","EP01","E001","1","1","Por revisar"'));
  });
  P('cambio local pendiente gana a remoto viejo', () => {
    const v = L.construir(arch, [], {}, [fila(A, { etiquetas: 'pc', fecha: '2026-10-27 09:00' })], { [A.toLowerCase()]: fila(A, { etiquetas: 'iphone', fecha: '2026-10-27 09:30' }) })[0];
    eq(v.etiquetas, 'iphone'); assert(v.pendiente);
  });
  P('buscar por etiquetas', () => eq(L.filtrar(L.construir(arch, [], {}, [fila(A, { etiquetas: 'volvo' })]), { vista: 'Todo', texto: 'volvo' }).length, 1));
}
// Si existe, compara con un CSV escrito por la app de la PC (C#)
const fs = require('fs'), ruta = __dirname + '/csv-de-la-pc.csv';
if (fs.existsSync(ruta)) P('CSV de la PC: ida y vuelta exacta', () => { const t = fs.readFileSync(ruta, 'utf8'); eq(L.escribirCsv(L.leerCsv(t)), t); });
const rutaA = __dirname + '/asig-de-la-pc.csv';
if (fs.existsSync(rutaA)) P('asignaciones.csv de la PC: ida y vuelta exacta', () => { const t = fs.readFileSync(rutaA, 'utf8'); const f = L.leerAsig(t); eq(f.length, 2); eq(f.find(x => x.archivo === 'voz niña.mp3').notas, 'línea 1\nlínea, 2'); eq(L.escribirAsig(f), t); });
console.log(fallas ? `${fallas} FALLAS de ${n}` : `TODO BIEN (${n} pruebas)`); process.exit(fallas ? 1 : 0);
