import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from 'docx';
import JSZip from 'jszip';

export async function exportToExcel(data: any[][] | string, fileName: string) {
  const aoa = Array.isArray(data) ? data : [[data]];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export async function exportToCSV(data: any[][] | string, fileName: string) {
  const aoa = Array.isArray(data) ? data : [[data]];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToPDF(text: string, fileName: string) {
  const doc = new jsPDF();
  const splitText = doc.splitTextToSize(text, 180);
  doc.text(splitText, 10, 10);
  doc.save(`${fileName}.pdf`);
}

export async function exportToDocx(text: string, fileName: string, tableData?: any[][]) {
  const children: any[] = [
    new Paragraph({
      children: [new TextRun(text)],
    }),
  ];

  if (tableData) {
    const rows = tableData.map(row => 
      new TableRow({
        children: row.map(cell => 
          new TableCell({
            children: [new Paragraph(String(cell))],
            width: { size: 100 / row.length, type: WidthType.PERCENTAGE }
          })
        )
      })
    );
    
    children.push(new Table({ rows }));
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.docx`;
  link.click();
}

export async function exportToJSON(data: any, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.json`;
  link.click();
}

export async function exportBulkToZip(files: { name: string, content: Blob }[]) {
  const zip = new JSZip();
  files.forEach(file => {
    zip.file(file.name, file.content);
  });
  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = `processed_documents_${new Date().getTime()}.zip`;
  link.click();
}
