import { getFileExtension, getMimeType } from '../utils.js';

function decodeHeic(file) {
  return heic2any({ blob: file, toType: 'image/png' })
    .then(blob => Array.isArray(blob) ? blob[0] : blob);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas;
}

function encodeBmp(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4D);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelDataSize, true);

  for (let y = 0; y < height; y++) {
    const rowStart = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowStart + x * 3;
      view.setUint8(dstIdx, pixels[srcIdx + 2]);
      view.setUint8(dstIdx + 1, pixels[srcIdx + 1]);
      view.setUint8(dstIdx + 2, pixels[srcIdx]);
    }
  }

  return new Blob([buf], { type: 'image/bmp' });
}

function encodeTiff(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const tiffData = UTIF.encodeImage(rgba, width, height);
  return new Blob([tiffData], { type: 'image/tiff' });
}

async function decodeTiffToCanvas(file) {
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  UTIF.decodeImage(buf, ifds[0]);
  const firstPage = ifds[0];
  const rgba = UTIF.toRGBA8(firstPage);
  const canvas = document.createElement('canvas');
  canvas.width = firstPage.width;
  canvas.height = firstPage.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(firstPage.width, firstPage.height);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function encodeIco(canvas) {
  const sizes = [32, 16];
  const pngs = sizes.map((size) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.getContext('2d').drawImage(canvas, 0, 0, size, size);
    const dataUrl = c.toDataURL('image/png');
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { size, data: bytes };
  });

  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * pngs.length;
  let offset = headerSize + dirSize;
  const totalSize = offset + pngs.reduce((sum, p) => sum + p.data.length, 0);
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  // ICONDIR header
  view.setUint16(0, 0, true);      // reserved
  view.setUint16(2, 1, true);      // type: 1 = ICO
  view.setUint16(4, pngs.length, true);

  // ICONDIRENTRY for each image + copy PNG data
  const u8 = new Uint8Array(buf);
  pngs.forEach((png, i) => {
    const dirOff = headerSize + i * dirEntrySize;
    view.setUint8(dirOff, png.size < 256 ? png.size : 0);      // width
    view.setUint8(dirOff + 1, png.size < 256 ? png.size : 0);  // height
    view.setUint8(dirOff + 2, 0);   // color palette
    view.setUint8(dirOff + 3, 0);   // reserved
    view.setUint16(dirOff + 4, 1, true);  // color planes
    view.setUint16(dirOff + 6, 32, true); // bits per pixel
    view.setUint32(dirOff + 8, png.data.length, true);
    view.setUint32(dirOff + 12, offset, true);
    u8.set(png.data, offset);
    offset += png.data.length;
  });

  return new Blob([buf], { type: 'image/x-icon' });
}

export async function convertImage(file, targetFormat, quality = 80) {
  const ext = getFileExtension(file.name);
  let canvas;

  if (ext === 'heic' || ext === 'heif') {
    const decoded = await decodeHeic(file);
    const url = URL.createObjectURL(decoded);
    try {
      canvas = imageToCanvas(await loadImage(url));
    } finally {
      URL.revokeObjectURL(url);
    }
  } else if (ext === 'tiff' || ext === 'tif') {
    canvas = await decodeTiffToCanvas(file);
  } else {
    const url = URL.createObjectURL(file);
    try {
      canvas = imageToCanvas(await loadImage(url));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  let outputBlob;
  if (targetFormat === 'ico') {
    outputBlob = encodeIco(canvas);
  } else if (targetFormat === 'bmp') {
    outputBlob = encodeBmp(canvas);
  } else if (targetFormat === 'tiff') {
    outputBlob = encodeTiff(canvas);
  } else {
    const mimeType = getMimeType(targetFormat);
    const qualityValue = quality / 100;
    outputBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Conversion failed')),
        mimeType,
        qualityValue,
      );
    });
  }

  return { blob: outputBlob, originalSize: file.size, convertedSize: outputBlob.size };
}
