import { getFileExtension, getMimeType } from '../utils.js';
import { ffmpegState } from '../state.js';
import { loadFFmpeg, fetchFile } from './ffmpeg-shared.js';

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

function qualityToCRF(quality, codec) {
  // quality 100 = best (low CRF), quality 10 = worst (high CRF)
  if (codec === 'libx264') {
    return Math.round(51 - (quality / 100) * 41); // CRF 10–51
  }
  // VP9: CRF 0–63
  return Math.round(63 - (quality / 100) * 53); // CRF 10–63
}

function getVideoCodecArgs(targetFormat, options = {}) {
  const quality = options.quality || 80;

  switch (targetFormat) {
    case 'mp4': {
      const crf = qualityToCRF(quality, 'libx264');
      return [
        '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf),
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
      ];
    }
    case 'webm': {
      const crf = qualityToCRF(quality, 'libvpx-vp9');
      return [
        '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0',
        '-c:a', 'libvorbis', '-b:a', '128k',
      ];
    }
    default:
      return ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-b:a', '128k'];
  }
}

async function convertToGif(inputName) {
  const paletteName = 'palette.png';
  const outputName = 'output.gif';

  await ffmpegState.instance.exec([
    '-i', inputName,
    '-vf', 'fps=10,scale=320:-1:flags=lanczos,palettegen',
    '-y', paletteName,
  ]);

  await ffmpegState.instance.exec([
    '-i', inputName,
    '-i', paletteName,
    '-lavfi', 'fps=10,scale=320:-1:flags=lanczos[x];[x][1:v]paletteuse',
    '-y', outputName,
  ]);

  const outputData = await ffmpegState.instance.readFile(outputName);

  await ffmpegState.instance.deleteFile(paletteName);
  await ffmpegState.instance.deleteFile(outputName);

  return outputData;
}

export async function convertVideo(file, targetFormat, options = {}) {
  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(`Video file is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is 500MB.`);
  }

  const loaded = await loadFFmpeg();
  if (!loaded) {
    throw new Error('Failed to load FFmpeg. Please try again.');
  }

  try {
    const inputData = await fetchFile(file);
    const inputExt = getFileExtension(file.name);
    const inputName = `input.${inputExt}`;

    await ffmpegState.instance.writeFile(inputName, inputData);

    let outputData;

    if (targetFormat === 'gif') {
      outputData = await convertToGif(inputName);
    } else {
      const outputName = `output.${targetFormat}`;
      const codecArgs = getVideoCodecArgs(targetFormat, options);
      await ffmpegState.instance.exec(['-i', inputName, ...codecArgs, '-y', outputName]);
      outputData = await ffmpegState.instance.readFile(outputName);
      await ffmpegState.instance.deleteFile(outputName);
    }

    await ffmpegState.instance.deleteFile(inputName);

    const mimeType = targetFormat === 'gif' ? 'image/gif' : getMimeType(targetFormat);
    const blob = new Blob([outputData.buffer], { type: mimeType });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  } catch (error) {
    console.error('[FFmpeg] Video conversion error:', error);
    throw new Error(`Video conversion failed: ${error.message}`);
  }
}
