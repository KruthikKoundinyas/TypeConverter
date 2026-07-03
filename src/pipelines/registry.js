import { getFileExtension } from '../utils.js';

export const PIPELINES = {
  image: {
    label: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'svg', 'ico', 'heic', 'heif', 'raw', 'tga'],
    outputs: [
      { ext: 'jpeg', label: 'JPEG' },
      { ext: 'png', label: 'PNG' },
      { ext: 'webp', label: 'WEBP' },
      { ext: 'gif', label: 'GIF' },
      { ext: 'bmp', label: 'BMP' },
      { ext: 'tiff', label: 'TIFF' },
    ],
  },
  audio: {
    label: 'Audio',
    extensions: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'],
    outputs: [
      { ext: 'mp3', label: 'MP3' },
      { ext: 'wav', label: 'WAV' },
      { ext: 'ogg', label: 'OGG' },
      { ext: 'flac', label: 'FLAC' },
      { ext: 'aac', label: 'AAC' },
      { ext: 'm4a', label: 'M4A' },
    ],
  },
  video: {
    label: 'Video',
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    outputs: [
      { ext: 'mp4', label: 'MP4' },
      { ext: 'webm', label: 'WEBM' },
      { ext: 'gif', label: 'GIF (animated)' },
    ],
  },
  document: {
    label: 'Documents',
    extensions: ['pdf', 'doc', 'docx', 'rtf', 'odt', 'epub'],
    outputs: [
      { ext: 'pdf', label: 'PDF' },
      { ext: 'txt', label: 'Plain Text' },
      { ext: 'html', label: 'HTML' },
    ],
  },
  spreadsheet: {
    label: 'Spreadsheets',
    extensions: ['csv', 'xls', 'xlsx', 'tsv'],
    outputs: [
      { ext: 'csv', label: 'CSV' },
      { ext: 'json', label: 'JSON' },
      { ext: 'xlsx', label: 'XLSX' },
    ],
  },
  presentation: {
    label: 'Presentations',
    extensions: ['ppt', 'pptx', 'odp'],
    outputs: [
      { ext: 'pdf', label: 'PDF' },
    ],
  },
  code: {
    label: 'Code / Text',
    extensions: ['html', 'htm', 'md', 'markdown', 'json', 'yaml', 'yml', 'xml', 'txt'],
    outputs: [
      { ext: 'html', label: 'HTML' },
      { ext: 'md', label: 'Markdown' },
      { ext: 'json', label: 'JSON' },
      { ext: 'yaml', label: 'YAML' },
      { ext: 'xml', label: 'XML' },
      { ext: 'txt', label: 'Plain Text' },
    ],
  },
  archive: {
    label: 'Archives',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2'],
    outputs: [
      { ext: 'zip', label: 'ZIP' },
      { ext: 'tar', label: 'TAR' },
      { ext: 'gz', label: 'GZ' },
    ],
  },
};

export const PIPELINE_ICONS = {
  image: '\u{1F5BC}', audio: '\u{1F3B5}', video: '\u{1F3AC}', document: '\u{1F4C4}',
  spreadsheet: '\u{1F4CA}', presentation: '\u{1F4BD}', code: '\u{1F4DD}', archive: '\u{1F4E6}',
};

const EXT_TO_PIPELINE = {};
for (const [key, p] of Object.entries(PIPELINES)) {
  for (const ext of p.extensions) {
    if (!EXT_TO_PIPELINE[ext]) EXT_TO_PIPELINE[ext] = key;
  }
}

const MIME_TO_PIPELINE = {
  'image/': 'image',
  'audio/': 'audio',
  'video/': 'video',
};

export function detectPipeline(file) {
  const ext = getFileExtension(file.name);
  if (ext && EXT_TO_PIPELINE[ext]) return EXT_TO_PIPELINE[ext];
  const mime = file.type || '';
  for (const [prefix, pipeline] of Object.entries(MIME_TO_PIPELINE)) {
    if (mime.startsWith(prefix)) return pipeline;
  }
  return null;
}

export function getPipelineOutputs(pipelineKey) {
  return PIPELINES[pipelineKey]?.outputs || [];
}

export function isFormatValidForPipeline(pipelineKey, format) {
  return getPipelineOutputs(pipelineKey).some(o => o.ext === format);
}
