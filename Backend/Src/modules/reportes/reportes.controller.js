const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const logger = require('../../utils/logger');
const { success, error } = require('../../utils/response');

const generarReporte = async (req, res) => {
  try {
    const { formato, titulo, columnas, datos } = req.body;

    if (!datos || !Array.isArray(datos) || !columnas || !Array.isArray(columnas)) {
      return error(res, 'Datos o columnas inválidas', 400);
    }

    if (formato === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte_meteo_advance.pdf"');
      doc.pipe(res);

      // --- BRANDING HEADER GRADIENT ---
      const headerGrad = doc.linearGradient(0, 0, doc.page.width, 0);
      headerGrad.stop(0, '#4338CA'); // Deep Indigo
      headerGrad.stop(1, '#A855F7'); // Bright Purple
      doc.rect(0, 0, doc.page.width, 140).fill(headerGrad);
      
      // Title
      doc.fillColor('#FFFFFF').fontSize(32).font('Helvetica-Bold').text('Reporte', 40, 40);
      doc.fillColor('#FFFFFF').fontSize(32).font('Helvetica-Bold').text('Analítico', 40, 75);

      // Logo (Vector Cloud) on the right
      doc.save();
      doc.translate(doc.page.width - 110, 40);
      doc.scale(0.5);
      doc.path('M 48 24 A 24 24 0 0 0 2 24 A 16 16 0 0 0 16 40 L 80 40 A 16 16 0 0 0 80 8 A 20 20 0 0 0 48 24 Z').fill('#FFFFFF');
      doc.restore();

      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('MeteoAdvance', doc.page.width - 200, 70, { width: 160, align: 'right' });
      doc.fillColor('#E0E7FF').fontSize(9).font('Helvetica').text('Proyecto de Meteorología', doc.page.width - 200, 88, { width: 160, align: 'right' });

      // --- DESCRIPTION PARAGRAPH ---
      doc.fillColor('#4B5563').fontSize(9).font('Helvetica');
      const introText = 'Este documento presenta el resumen analítico detallado de las condiciones atmosféricas actuales e históricas registradas por la plataforma MeteoAdvance. Los datos están consolidados para facilitar la toma de decisiones meteorológicas.';
      doc.text(introText, 40, 160, { width: doc.page.width - 80, align: 'justify' });

      let y = 210;
      const startX = 40;
      const pageWidth = doc.page.width - startX * 2;
      const colWidths = columnas.map(() => pageWidth / columnas.length);

      // --- TABLE HEADER (Pill Shape) ---
      const drawTableHeader = (startY) => {
        const pillGrad = doc.linearGradient(startX, startY, startX + pageWidth, startY);
        pillGrad.stop(0, '#6D28D9'); // Violet
        pillGrad.stop(1, '#9333EA'); // Purple
        
        doc.roundedRect(startX, startY, pageWidth, 28, 14).fill(pillGrad);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
        let cx = startX;
        columnas.forEach((col, i) => {
          doc.text(col.header, cx + 12, startY + 9, { width: colWidths[i] - 24, align: 'left' });
          cx += colWidths[i];
        });
        return startY + 36;
      };

      y = drawTableHeader(y);

      // --- TABLE ROWS ---
      doc.font('Helvetica').fontSize(8.5);
      let isEven = false;

      datos.forEach(row => {
        const rowHeights = columnas.map((col, i) => doc.heightOfString(String(row[col.key] || '—'), { width: colWidths[i] - 24 }));
        const maxHeight = Math.max(...rowHeights, 16);

        if (y + maxHeight > doc.page.height - 100) {
          doc.addPage();
          y = 40;
          y = drawTableHeader(y);
          doc.font('Helvetica').fontSize(8.5);
        }

        if (isEven) {
          doc.rect(startX, y, pageWidth, maxHeight + 12).fill('#F9FAFB');
        }
        
        doc.fillColor('#4B5563');
        let rowX = startX;
        columnas.forEach((col, i) => {
          let val = row[col.key];
          if (val === null || val === undefined) val = '—';
          doc.text(String(val), rowX + 12, y + 6, { width: colWidths[i] - 24, align: 'left' });
          rowX += colWidths[i];
        });
        
        y += maxHeight + 12;
        doc.moveTo(startX, y).lineTo(doc.page.width - startX, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
        isEven = !isEven;
      });

      // --- FOOTER (Purple bar) ---
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        
        const footerGrad = doc.linearGradient(0, doc.page.height - 40, doc.page.width, doc.page.height - 40);
        footerGrad.stop(0, '#4338CA');
        footerGrad.stop(1, '#A855F7');
        doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(footerGrad);
        
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text(`MeteoAdvance`, 40, doc.page.height - 25, { align: 'left' });
        
        doc.fontSize(8).font('Helvetica').fillColor('#E0E7FF');
        doc.text(`Página ${i + 1} de ${pages.count}`, startX, doc.page.height - 25, { width: pageWidth, align: 'right' });
      }

      doc.end();

    } else if (formato === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Reporte');

      // Configurar columnas
      sheet.columns = columnas.map(col => ({
        header: col.header,
        key: col.key,
        width: 15
      }));

      // Estilizar cabecera
      sheet.getRow(1).font = { bold: true };

      // Agregar filas
      datos.forEach(row => {
        sheet.addRow(row);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte.xlsx"');

      await workbook.xlsx.write(res);
      res.end();

    } else {
      error(res, 'Formato no soportado (use "pdf" o "excel")', 400);
    }
  } catch (err) {
    logger.error('Error al generar reporte:', err);
    error(res, 'Error interno al generar el reporte', 500);
  }
};

module.exports = {
  generarReporte
};
