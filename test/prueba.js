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
// Si existe, compara con un CSV escrito por la app de la PC (C#)
const fs = require('fs'), ruta = __dirname + '/csv-de-la-pc.csv';
if (fs.existsSync(ruta)) P('CSV de la PC: ida y vuelta exacta', () => { const t = fs.readFileSync(ruta, 'utf8'); eq(L.escribirCsv(L.leerCsv(t)), t); });
console.log(fallas ? `${fallas} FALLAS de ${n}` : `TODO BIEN (${n} pruebas)`); process.exit(fallas ? 1 : 0);
