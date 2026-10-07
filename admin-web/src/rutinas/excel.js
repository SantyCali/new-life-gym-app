// La planilla de rutina como Excel (.xlsx), con el mismo formato que la de
// papel: para imprimirla desde Excel o mandársela al socio. Se arma en el
// navegador; ExcelJS se carga recién al usarlo (pesa bastante).
import { armarPlanilla } from './planilla';

const NEGRO = 'FF111111';
const TINTA = 'FF1F3A8A';
const COLS = ['', 'DIA', 'ORDEN', 'SERIE', 'REPETICIÓN', 'CARGA', 'OBSERVACIÓN'];
const borde = { style: 'thin', color: { argb: NEGRO } };
const bordes = { top: borde, left: borde, bottom: borde, right: borde };

async function imagen(wb, url) {
  const r = await fetch(url);
  return wb.addImage({ buffer: await r.arrayBuffer(), extension: 'png' });
}

export async function descargarExcel({ rutina, nombreSocio }) {
  const { default: ExcelJS } = await import('exceljs');
  const { secciones, extras, dias } = armarPlanilla(rutina);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'New Life Gym';
  const ws = wb.addWorksheet('Rutina', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 },
    },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 30 }, { width: 7 }, { width: 8 }, { width: 7 }, { width: 12 }, { width: 10 }, { width: 38 }];

  const [sello, h] = await Promise.all([imagen(wb, '/planilla/sello.png'), imagen(wb, '/planilla/h-cabecera.png')]);

  let fila = 1;
  const texto = (celda, valor, estilo = {}) => {
    const c = ws.getCell(celda);
    c.value = valor;
    c.font = { name: 'Arial', size: 10, ...estilo.font };
    c.alignment = { vertical: 'middle', ...estilo.alignment };
    return c;
  };

  // ── Hoja 1: cabecera ────────────────────────────────────────────────────
  for (let i = 0; i < 9; i++) ws.getRow(fila + i).height = 15;
  ws.addImage(sello, { tl: { col: 0.15, row: fila - 1 + 0.1 }, ext: { width: 130, height: 130 } });
  ws.mergeCells(fila, 2, fila + 1, 5);
  texto(`B${fila}`, 'NEW LIFE GYM', { font: { name: 'Impact', size: 24 } });
  texto(`B${fila + 3}`, 'Pasaje Los Teros 1058', { font: { size: 11 } });
  texto(`B${fila + 4}`, 'Villa de Merlo - San Luis', { font: { size: 11 } });
  texto(`B${fila + 6}`, 'newlifemerlo (Facebook)', { font: { size: 10 } });
  // Recuadro del socio (columnas F-G).
  const datos = [['NOMBRE', nombreSocio], ['OBJETIVOS', rutina?.objetivos], ['OBSERVACIÓN', rutina?.observacion]];
  datos.forEach(([titulo, valor], i) => {
    const r = fila + i * 2;
    texto(`F${r}`, titulo, { font: { bold: true, size: 7 } });
    ws.mergeCells(r + 1, 6, r + 1, 7);
    const c = texto(`F${r + 1}`, valor ?? '', { font: { bold: true, size: 10, color: { argb: TINTA } } });
    c.border = { bottom: borde };
  });
  ws.mergeCells(fila + 6, 6, fila + 8, 7);
  texto(`F${fila + 6}`, 'ESTIMADO SOCIO: Recuerde tener su cuota al día para hacer efectiva la renovación de su rutina.', {
    font: { bold: true, size: 8 }, alignment: { wrapText: true, vertical: 'top' },
  });
  fila += 10;

  // ── Secciones ───────────────────────────────────────────────────────────
  const seccion = (s) => {
    const enc = ws.getRow(fila);
    enc.height = 18;
    COLS.forEach((t, i) => {
      const c = enc.getCell(i + 1);
      c.value = i === 0 ? s.titulo : t;
      c.font = { name: 'Arial Narrow', bold: true, size: i === 0 ? 11 : 9, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } };
      c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
      c.border = bordes;
    });
    fila++;
    for (const f of s.filas) {
      const r = ws.getRow(fila);
      r.height = 15;
      [f.etiqueta, f.dia, f.orden, f.serie, f.rep, f.carga, f.obs].forEach((v, i) => {
        const c = r.getCell(i + 1);
        c.value = v ?? '';
        const dato = i > 0 || f.libre;
        c.font = { name: 'Arial Narrow', size: i === 6 ? 9 : 10, bold: dato, color: { argb: dato ? TINTA : NEGRO } };
        c.alignment = { vertical: 'middle', horizontal: i === 0 || i === 6 ? 'left' : 'center', shrinkToFit: i === 6 };
        c.border = bordes;
      });
      fila++;
    }
    fila++; // separación entre secciones
  };

  secciones.filter((s) => s.hoja === 1).forEach(seccion);

  // ── Hoja 2 ──────────────────────────────────────────────────────────────
  ws.getRow(fila - 1).addPageBreak();
  for (let i = 0; i < 3; i++) ws.getRow(fila + i).height = 16;
  ws.addImage(h, { tl: { col: 0.1, row: fila - 1 + 0.1 }, ext: { width: 95, height: 54 } });
  ws.mergeCells(fila, 2, fila + 2, 4);
  texto(`B${fila}`, 'NEW LIFE GYM', { font: { name: 'Impact', size: 22 } });
  ws.mergeCells(fila, 5, fila + 2, 7);
  texto(`E${fila}`, '- Mantenga el orden de los elementos utilizados en el gimnasio.\n- Recuerde guardar su rutina una vez finalizada.\n- Su cuota al día nos permite brindarle un mejor servicio a nuestros socios.', {
    font: { size: 7 }, alignment: { wrapText: true },
  });
  fila += 4;

  secciones.filter((s) => s.hoja === 2).forEach(seccion);

  // Observaciones: días y ejercicios sin renglón propio.
  const lineas = [dias.join('   ·   '), ...extras].filter(Boolean);
  const alto = Math.max(5, lineas.length + 2);
  ws.mergeCells(fila, 1, fila + alto - 1, 7);
  const obs = ws.getCell(`A${fila}`);
  obs.value = {
    richText: [
      { text: 'OBSERVACIONES\n', font: { name: 'Arial Narrow', bold: true, size: 12 } },
      { text: lineas.join('\n'), font: { name: 'Arial', bold: true, size: 9, color: { argb: TINTA } } },
    ],
  };
  obs.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  obs.border = bordes;
  for (let i = 0; i < alto; i++) ws.getRow(fila + i).height = 15;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Rutina - ${(nombreSocio || 'socio').replace(/[\\/:*?"<>|]/g, '')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
