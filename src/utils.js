export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getFileExtension(filename) {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
}

export function getMimeType(extension) {
  const mimeTypes = {
    jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    tiff: 'image/tiff', tif: 'image/tiff', svg: 'image/svg+xml',
    heic: 'image/heic', heif: 'image/heif', ico: 'image/x-icon',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
    mp4: 'video/mp4', webm: 'video/webm',
    html: 'text/html', md: 'text/markdown',
    json: 'application/json', yaml: 'text/yaml', yml: 'text/yaml',
    xml: 'application/xml', txt: 'text/plain', csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
