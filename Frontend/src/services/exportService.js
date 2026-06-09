// Frontend/src/services/exportService.js
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportarAExcel = (data, selectedLayers) => {
  const wb = XLSX.utils.book_new();

  // Consolidad sheet
  const wsData = data.map(row => {
    const newRow = { Fecha: new Date(row.date).toLocaleString() };
    selectedLayers.forEach(layer => {
      newRow[layer.charAt(0).toUpperCase() + layer.slice(1)] = row[layer] !== null && row[layer] !== undefined ? Number(row[layer].toFixed(2)) : 'N/A';
    });
    return newRow;
  });

  const ws = XLSX.utils.json_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Datos Consolidados');

  // One sheet per variable
  selectedLayers.forEach(layer => {
    const layerData = data.map(row => ({
      Fecha: new Date(row.date).toLocaleString(),
      [layer.charAt(0).toUpperCase() + layer.slice(1)]: row[layer] !== null && row[layer] !== undefined ? Number(row[layer].toFixed(2)) : 'N/A'
    }));
    const layerWs = XLSX.utils.json_to_sheet(layerData);
    XLSX.utils.book_append_sheet(wb, layerWs, layer.charAt(0).toUpperCase() + layer.slice(1));
  });

  XLSX.writeFile(wb, 'reporte_historico.xlsx');
};

export const exportarAExcelMasivo = (dataMasiva, selectedLayers, mainRegionName) => {
  const wb = XLSX.utils.book_new();
  
  // Tab maestro estructurado jerárquicamente
  const wsData = [];
  
  dataMasiva.forEach(location => {
    const subRegionName = location.name;
    location.data.forEach(row => {
      const fecha = new Date(row.date).toLocaleString();
      selectedLayers.forEach(layer => {
        const val = row[layer] !== null && row[layer] !== undefined ? Number(row[layer].toFixed(2)) : 'N/A';
        wsData.push({
          SubRegion: subRegionName,
          Latitud: location.lat.toFixed(4),
          Longitud: location.lon.toFixed(4),
          Variable: layer.charAt(0).toUpperCase() + layer.slice(1),
          'Fecha/Hora': fecha,
          Valor: val
        });
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(wsData);
  
  // Nombre de hoja seguro (max 31 chars)
  const safeName = mainRegionName ? mainRegionName.replace(/[^a-zA-Z0-9]/g, ' ') : 'Masivo';
  const tabName = safeName.substring(0, 31).trim();
  
  XLSX.utils.book_append_sheet(wb, ws, tabName || 'Datos Consolidados');

  const safeFilename = mainRegionName ? mainRegionName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'masivo';
  XLSX.writeFile(wb, `reporte_masivo_${safeFilename}.xlsx`);
};

export const exportarAPDF = (data, selectedLayers, base64Graph) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Reporte Histórico de Variables Climáticas', 14, 22);

  if (base64Graph) {
    doc.addImage(base64Graph, 'PNG', 14, 30, 180, 80);
  }

  const tableColumn = ["Fecha", ...selectedLayers.map(l => l.charAt(0).toUpperCase() + l.slice(1))];
  const tableRows = [];

  data.forEach(row => {
    const rowData = [
      new Date(row.date).toLocaleString(),
      ...selectedLayers.map(layer => row[layer] !== null && row[layer] !== undefined ? row[layer].toFixed(2) : 'N/A')
    ];
    tableRows.push(rowData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: base64Graph ? 120 : 30,
  });

  doc.save('reporte_historico.pdf');
};
