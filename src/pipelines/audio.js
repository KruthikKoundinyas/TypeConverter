import { getFileExtension, getMimeType } from '../utils.js';
import { ffmpegState } from '../state.js';
import { loadFFmpeg, fetchFile } from './ffmpeg-shared.js';

function getAudioCodecArgs(outputFormat, bitrate) {
  switch (outputFormat) {
    case 'mp3':  return ['-codec:a', 'libmp3lame', '-b:a', bitrate];
    case 'ogg':  return ['-codec:a', 'libvorbis', '-b:a', bitrate];
    case 'flac': return ['-codec:a', 'flac'];
    case 'aac':  return ['-codec:a', 'aac', '-b:a', bitrate];
    case 'm4a':  return ['-codec:a', 'aac', '-b:a', bitrate, '-f', 'ipod'];
    case 'wav':  return ['-codec:a', 'pcm_s16le'];
    default:     return ['-codec:a', 'pcm_s16le'];
  }
}

export async function convertAudioWithFFmpeg(file, outputFormat, bitrate = '128000') {
  const loaded = await loadFFmpeg();
  if (!loaded) {
    throw new Error('Failed to load FFmpeg. Please try again.');
  }

  try {
    const inputData = await fetchFile(file);
    const inputExt = getFileExtension(file.name);
    const inputName = `input.${inputExt}`;
    const outExt = outputFormat === 'm4a' ? 'm4a' : outputFormat;
    const outputName = `output.${outExt}`;

    await ffmpegState.instance.writeFile(inputName, inputData);

    const codecArgs = getAudioCodecArgs(outputFormat, bitrate);
    await ffmpegState.instance.exec(['-i', inputName, ...codecArgs, outputName]);

    const outputData = await ffmpegState.instance.readFile(outputName);

    await ffmpegState.instance.deleteFile(inputName);
    await ffmpegState.instance.deleteFile(outputName);

    const mimeType = getMimeType(outputFormat);
    const blob = new Blob([outputData.buffer], { type: mimeType });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  } catch (error) {
    console.error('[FFmpeg] Conversion error:', error);
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
}
