import { getFileExtension, getMimeType } from '../utils.js';
import { ffmpegState, elements } from '../state.js';

async function loadFFmpeg() {
  if (ffmpegState.loaded) return true;
  if (ffmpegState.loading) {
    while (ffmpegState.loading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return ffmpegState.loaded;
  }

  ffmpegState.loading = true;

  try {
    const convertBtn = elements.convertBtn;
    if (convertBtn) {
      convertBtn.innerHTML = `
        <span>Loading engine...</span>
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
        </svg>
      `;
      convertBtn.disabled = true;
    }

    const FFmpegClass = window.FFmpeg.FFmpeg;
    ffmpegState.instance = new FFmpegClass();

    ffmpegState.instance.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    ffmpegState.instance.on('progress', ({ progress }) => {
      console.log(`[FFmpeg] Progress: ${Math.round(progress * 100)}%`);
      if (convertBtn) {
        convertBtn.innerHTML = `<span>Converting ${Math.round(progress * 100)}%</span>`;
      }
    });

    await ffmpegState.instance.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
    });

    ffmpegState.loaded = true;
    return true;
  } catch (error) {
    console.error('[FFmpeg] Failed to load:', error);
    ffmpegState.loaded = false;
    return false;
  } finally {
    ffmpegState.loading = false;
  }
}

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
  const { fetchFile } = window.FFmpegUtil;

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
