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
      // Calcular ancho de columnas uniformemente
      const colWidth = (doc.page.width - startX * 2) / columnas.length;

      // Dibujar cabeceras
      doc.fontSize(10).font('Helvetica-Bold');
      columnas.forEach((col, i) => {
        doc.text(col.header, startX + i * colWidth, y, { width: colWidth, align: 'left' });
      });
      
      y += 15;
      doc.moveTo(startX, y).lineTo(doc.page.width - startX, y).stroke();
      y += 10;

      // Dibujar filas
      doc.font('Helvetica').fontSize(9);
      datos.forEach(row => {
        if (y > doc.page.height - 50) {
          doc.addPage();
          y = 30;
        }
        columnas.forEach((col, i) => {
          let val = row[col.key];
          if (val === null || val === undefined) val = '—';
          doc.text(String(val), startX + i * colWidth, y, { width: colWidth, align: 'left' });
        });
        y += 15;
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
