import { getFileExtension } from '../utils.js';

let pdfjsLib = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  return pdfjsLib;
}

async function docxToText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return new Blob([result.value], { type: 'text/plain' });
}

async function docxToHtml(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Converted Document</title></head>
<body>${result.value}</body>
</html>`;
  return new Blob([html], { type: 'text/html' });
}

async function pdfToText(file) {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    pages.push(pageText);
  }

  const text = pages.join('\n\n');
  return new Blob([text], { type: 'text/plain' });
}

async function pdfToHtml(file) {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageDivs = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    pageDivs.push(`<div class="page"><h2>Page ${i}</h2><p>${pageText}</p></div>`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Converted PDF</title>
<style>.page { margin-bottom: 2em; padding-bottom: 1em; border-bottom: 1px solid #ccc; }</style>
</head>
<body>${pageDivs.join('\n')}</body>
</html>`;
  return new Blob([html], { type: 'text/html' });
}

const UNSUPPORTED_FORMATS = ['doc', 'rtf', 'odt', 'epub'];

export async function convertDocument(file, targetFormat) {
  const ext = getFileExtension(file.name);

  if (UNSUPPORTED_FORMATS.includes(ext)) {
    throw new Error(
      `${ext.toUpperCase()} conversion is not supported in the browser. ` +
      `Try converting to DOCX first using Microsoft Word or LibreOffice.`
    );
  }

  let blob;

  if (ext === 'docx') {
    if (targetFormat === 'txt') {
      blob = await docxToText(file);
    } else if (targetFormat === 'html') {
      blob = await docxToHtml(file);
    } else {
      throw new Error(`DOCX to ${targetFormat.toUpperCase()} is not supported.`);
    }
  } else if (ext === 'pdf') {
    if (targetFormat === 'txt') {
      blob = await pdfToText(file);
    } else if (targetFormat === 'html') {
      blob = await pdfToHtml(file);
    } else {
      throw new Error(`PDF to ${targetFormat.toUpperCase()} is not supported.`);
    }
  } else {
    throw new Error(`${ext.toUpperCase()} conversion is not supported.`);
  }

  return { blob, originalSize: file.size, convertedSize: blob.size };
}
