import { getFileExtension, readFileAsText } from '../utils.js';

export async function convertSpreadsheet(file, targetFormat) {
  const srcExt = getFileExtension(file.name);
  let workbook;

  if (srcExt === 'csv' || srcExt === 'tsv') {
    const text = await readFileAsText(file);
    workbook = XLSX.read(text, { type: 'string' });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array' });
  }

  if (targetFormat === 'csv') {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const output = XLSX.utils.sheet_to_csv(sheet);
    const blob = new Blob([output], { type: 'text/csv' });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  }

  if (targetFormat === 'json') {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    const output = JSON.stringify(data, null, 2);
    const blob = new Blob([output], { type: 'application/json' });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  }

  if (targetFormat === 'xlsx') {
    const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxData], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  }

  throw new Error(`Unsupported spreadsheet output format: ${targetFormat}`);
}
