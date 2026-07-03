import { getFileExtension } from '../utils.js';

export async function convertArchive(file, targetFormat) {
  const srcExt = getFileExtension(file.name);

  if (srcExt === 'zip' && targetFormat === 'zip') {
    return { blob: file, originalSize: file.size, convertedSize: file.size };
  }

  if (srcExt === 'zip') {
    const buffer = await file.arrayBuffer();
    const srcZip = await JSZip.loadAsync(buffer);

    if (targetFormat === 'zip') {
      const newZip = new JSZip();
      for (const [name, entry] of Object.entries(srcZip.files)) {
        if (!entry.dir) {
          const data = await entry.async('uint8array');
          newZip.file(name, data);
        }
      }
      const blob = await newZip.generateAsync({ type: 'blob' });
      return { blob, originalSize: file.size, convertedSize: blob.size };
    }
  }

  if (targetFormat === 'zip') {
    const zip = new JSZip();
    const buffer = await file.arrayBuffer();
    zip.file(file.name, buffer);
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  }

  throw new Error(
    `Archive conversion from .${srcExt} to .${targetFormat} is not yet supported`,
  );
}
