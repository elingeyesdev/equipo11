const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const generarReporte = async (req, res) => {
  try {
    const { formato, titulo, columnas, datos } = req.body;

    if (!datos || !Array.isArray(datos) || !columnas || !Array.isArray(columnas)) {
      return res.status(400).json({ error: 'Datos o columnas inválidas' });
    }

    if (formato === 'pdf') {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte.pdf"');
      doc.pipe(res);

      // Título
      doc.fontSize(18).text(titulo || 'Reporte de Historial', { align: 'center' });
      doc.moveDown(2);

      let y = doc.y;
      const startX = 30;
      const pageWidth = doc.page.width - startX * 2;
      
      // Definir anchos proporcionales: Fecha (28%), Ciudad (20%), Métricas (resto)
      const colWidths = columnas.map((col, i) => {
        if (i === 0) return pageWidth * 0.28; // Fecha y Hora
        if (i === 1) return pageWidth * 0.18; // Ciudad
        return (pageWidth * 0.54) / (columnas.length - 2); // Métricas
      });

      // Dibujar cabeceras
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333');
      let currentX = startX;
      columnas.forEach((col, i) => {
        doc.text(col.header, currentX, y, { width: colWidths[i], align: 'left' });
        currentX += colWidths[i];
      });
      
      y += 18;
      doc.moveTo(startX, y).lineTo(doc.page.width - startX, y).strokeColor('#dddddd').stroke();
      y += 10;

      // Dibujar filas
      doc.font('Helvetica').fontSize(8.5).fillColor('#444444');
      datos.forEach(row => {
        // Calcular el alto máximo de la fila actual
        const rowHeights = columnas.map((col, i) => doc.heightOfString(String(row[col.key] || '—'), { width: colWidths[i] }));
        const maxHeight = Math.max(...rowHeights, 14);

        if (y + maxHeight > doc.page.height - 50) {
          doc.addPage();
          y = 30;
        }

        let rowX = startX;
        columnas.forEach((col, i) => {
          let val = row[col.key];
          if (val === null || val === undefined) val = '—';
          doc.text(String(val), rowX, y, { width: colWidths[i], align: 'left' });
          rowX += colWidths[i];
        });
        y += maxHeight + 4; // Espacio entre filas
      });

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
      res.status(400).json({ error: 'Formato no soportado (use "pdf" o "excel")' });
    }
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({ error: 'Error interno al generar el reporte' });
  }
};

module.exports = {
  generarReporte
};
